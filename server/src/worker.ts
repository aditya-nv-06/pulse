import { httpServerHandler } from "cloudflare:node"
import { app } from "./app.js"
import { config } from "./config.js"
import { createPrismaClient, runWithPrismaClient } from "./db.js"
import { runWithExecutionContext } from "./lib/background.js"

app.listen(config.port)
const apiHandler = httpServerHandler({ port: config.port })
const limitedResponse = (message: string) =>
  Response.json(
    { code: "RATE_LIMITED", error: message },
    { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
  )
const emailDigest = async (email: string) => {
  const bytes = new TextEncoder().encode(email)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname

    try {
      const siteIp = request.headers.get("cf-connecting-ip") ?? "unknown"
      const siteLimit = await env.SITE_RATE_LIMITER.limit({ key: `ip:${siteIp}` })
      if (!siteLimit.success)
        return limitedResponse(
          "This connection has sent too many requests. Please wait a minute and try again.",
        )

      if (path.startsWith("/api/")) {
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown"
        const apiLimit = await env.API_RATE_LIMITER.limit({ key: `ip:${ip}` })
        if (!apiLimit.success)
          return limitedResponse("Too many requests. Please wait a minute and try again.")

        if (path === "/api/auth/request-link" && request.method === "POST") {
          const body = (await request
            .clone()
            .json()
            .catch(() => null)) as { email?: unknown } | null
          const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
          if (email && email.length <= 320) {
            const [ipLimit, emailKey] = await Promise.all([
              env.MAGIC_LINK_IP_RATE_LIMITER.limit({ key: `ip:${ip}` }),
              emailDigest(email),
            ])
            if (!ipLimit.success)
              return limitedResponse(
                "Too many sign-in requests from this connection. Try again in a minute.",
              )
            const emailLimit = await env.MAGIC_LINK_EMAIL_RATE_LIMITER.limit({ key: emailKey })
            if (!emailLimit.success)
              return limitedResponse(
                "A sign-in link was requested recently. Check your inbox or try again in a minute.",
              )
          }
        }
      }
    } catch (error) {
      console.error("Cloudflare rate limiting failed", error)
      return Response.json(
        {
          code: "TEMPORARILY_UNAVAILABLE",
          error: "Pulse is temporarily unable to process requests. Please try again shortly.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      )
    }

    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request)

    const client = createPrismaClient(env.DATABASE_URL)
    try {
      const apiRequest = request as Parameters<NonNullable<typeof apiHandler.fetch>>[0]
      return await runWithExecutionContext(ctx, () =>
        runWithPrismaClient(client, () => apiHandler.fetch!(apiRequest, env, ctx)),
      )
    } finally {
      await client.$disconnect()
    }
  },
} satisfies ExportedHandler<Env>
