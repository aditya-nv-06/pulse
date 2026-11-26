import crypto from "node:crypto"
import { Router } from "express"
import { z } from "zod"
import { config } from "../config.js"
import { prisma } from "../db.js"
import { handleError } from "../middleware/auth.js"
import { sendMagicLink } from "../services/email.js"
import { getSessionCookie, sessionHash } from "../lib/session.js"
import { hasMailServer } from "../lib/email-domain.js"

export const authRouter = Router()
const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  returnTo: z.string().optional(),
})
const requestsByIp = new Map<string, number[]>()
const windowMs = 60 * 60 * 1000
const maxRequests = 5
const maxIpRequests = 20
const maxIpBuckets = 10_000

const hashToken = sessionHash
const sessionCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "lax" as const,
  path: "/",
}
const safeReturnTo = (value: string | null | undefined) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard/posts"
const allowedByRate = (bucket: Map<string, number[]>, key: string) => {
  const now = Date.now()
  const recent = (bucket.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs)
  const allowed = recent.length < maxIpRequests
  if (allowed) recent.push(now)
  bucket.delete(key)
  if (bucket.size >= maxIpBuckets) {
    const oldestKey = bucket.keys().next().value
    if (oldestKey) bucket.delete(oldestKey)
  }
  bucket.set(key, recent)
  return allowed
}

authRouter.post("/request-link", async (request, response) => {
  try {
    const parsed = emailSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: "Enter a valid email address" })
      return
    }
    const { email } = parsed.data
    const ip = request.get("cf-connecting-ip") || request.ip || "unknown"
    if (!allowedByRate(requestsByIp, ip)) {
      response
        .status(429)
        .setHeader("Retry-After", "3600")
        .json({ code: "RATE_LIMITED", error: "Too many sign-in requests. Please try again later." })
      return
    }

    const domain = email.slice(email.lastIndexOf("@") + 1)
    let domainAcceptsMail: boolean
    try {
      domainAcceptsMail = await hasMailServer(domain)
    } catch (error) {
      console.error("Email domain validation is temporarily unavailable", error)
      response.status(503).json({
        error: "We couldn't verify this email address right now. Please try again shortly.",
      })
      return
    }
    if (!domainAcceptsMail) {
      response.status(400).json({
        error: "This email domain can't receive email. Check the address and try again.",
      })
      return
    }

    const now = new Date()
    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = hashToken(rawToken)
    const tokenCreated = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`
      const recentRequests = await transaction.magicLinkToken.count({
        where: { email, createdAt: { gte: new Date(now.getTime() - windowMs) } },
      })
      if (recentRequests >= maxRequests) return false
      await transaction.magicLinkToken.updateMany({
        where: { email, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      await transaction.magicLinkToken.create({
        data: {
          email,
          tokenHash,
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
          returnTo: safeReturnTo(parsed.data.returnTo),
        },
      })
      return true
    })
    if (!tokenCreated) {
      response.status(429).setHeader("Retry-After", "3600").json({
        code: "RATE_LIMITED",
        error:
          "For security, sign-in links are limited to five requests per email each hour. Try again later.",
      })
      return
    }
    let emailAccepted: boolean
    try {
      emailAccepted = await sendMagicLink(email, rawToken, safeReturnTo(parsed.data.returnTo))
    } catch (error) {
      await prisma.magicLinkToken.updateMany({
        where: { tokenHash, usedAt: null },
        data: { usedAt: new Date() },
      })
      console.error("Brevo did not accept the sign-in email", error)
      response.status(502).json({
        error: "We couldn't send your sign-in email. Please check the address and try again later.",
      })
      return
    }
    response.status(emailAccepted ? 202 : 200).json({
      message: emailAccepted
        ? "Brevo accepted your sign-in email for delivery. Check your inbox, spam, and promotions folders."
        : "Development mode: the sign-in link was written to the server console.",
    })
  } catch (error) {
    handleError(error, response)
  }
})

authRouter.get("/verify", async (request, response) => {
  try {
    response.setHeader("Cache-Control", "no-store")
    response.setHeader("Referrer-Policy", "no-referrer")
    const rawToken = String(request.query.token ?? "")
    const tokenHash = hashToken(rawToken)
    const now = new Date()
    const result = await prisma.$transaction(async (transaction) => {
      const magicLink = await transaction.magicLinkToken.findUnique({ where: { tokenHash } })
      if (!magicLink || magicLink.usedAt || magicLink.expiresAt <= now) return null
      const consumed = await transaction.magicLinkToken.updateMany({
        where: { id: magicLink.id, usedAt: null },
        data: { usedAt: now },
      })
      if (consumed.count !== 1) return null
      const user = await transaction.user.upsert({
        where: { email: magicLink.email },
        update: {},
        create: { email: magicLink.email, name: magicLink.email.split("@")[0] ?? null },
      })
      const workspace = await transaction.workspace.findFirst({
        where: { ownerId: user.id },
        select: { id: true },
      })
      if (!workspace) {
        await transaction.workspace.create({
          data: {
            name: `${user.name ?? "My"} workspace`,
            slug: `workspace-${user.id.slice(-8)}`,
            ownerId: user.id,
          },
        })
      }
      const rawSession = crypto.randomBytes(32).toString("hex")
      await transaction.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawSession),
          expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      })
      return { rawSession, returnTo: magicLink.returnTo }
    })
    if (!result) {
      response.status(401).send("This magic link is invalid, expired, or already used.")
      return
    }
    response.cookie("pulse_session", result.rawSession, {
      ...sessionCookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    })
    response.redirect(`${config.appUrl}${safeReturnTo(result.returnTo)}`)
  } catch (error) {
    handleError(error, response)
  }
})

authRouter.post("/logout", async (request, response) => {
  const session = getSessionCookie(request.headers.cookie)
  if (session) await prisma.session.deleteMany({ where: { tokenHash: hashToken(session) } })
  response.clearCookie("pulse_session", sessionCookieOptions)
  response.json({ ok: true })
})
