import { httpServerHandler } from "cloudflare:node"
import { app } from "./app.js"
import { config } from "./config.js"
import { createPrismaClient, runWithPrismaClient } from "./db.js"

app.listen(config.port)
const apiHandler = httpServerHandler({ port: config.port })

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request)

    const client = createPrismaClient(env.HYPERDRIVE.connectionString)
    try {
      const apiRequest = request as Parameters<NonNullable<typeof apiHandler.fetch>>[0]
      return await runWithPrismaClient(client, () => apiHandler.fetch!(apiRequest, env, ctx))
    } finally {
      await client.$disconnect()
    }
  },
} satisfies ExportedHandler<Env>
