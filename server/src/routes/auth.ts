import crypto from "node:crypto"
import { Router } from "express"
import { z } from "zod"
import { config } from "../config.js"
import { prisma } from "../db.js"
import { handleError } from "../middleware/auth.js"
import { sendMagicLink } from "../services/email.js"
import { getSessionCookie, sessionHash } from "../lib/session.js"

export const authRouter = Router()
const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  returnTo: z.string().optional(),
})
const requestsByEmail = new Map<string, number[]>()
const requestsByIp = new Map<string, number[]>()
const windowMs = 60 * 60 * 1000
const maxRequests = 5

const hashToken = sessionHash
const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
}
const safeReturnTo = (value: string | null | undefined) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard/posts"
const allowedByRate = (bucket: Map<string, number[]>, key: string) => {
  const now = Date.now()
  const recent = (bucket.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs)
  if (recent.length >= maxRequests) {
    bucket.set(key, recent)
    return false
  }
  recent.push(now)
  bucket.set(key, recent)
  return true
}

authRouter.post("/request-link", async (request, response) => {
  try {
    const parsed = emailSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: "Enter a valid email address" })
      return
    }
    const { email } = parsed.data
    const ip = request.ip ?? "unknown"
    if (!allowedByRate(requestsByEmail, email) || !allowedByRate(requestsByIp, ip)) {
      response.json({ message: "Check your email for a sign-in link." })
      return
    }

    const now = new Date()
    const activeToken = await prisma.magicLinkToken.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: now } },
    })
    if (!activeToken) {
      const rawToken = crypto.randomBytes(32).toString("hex")
      await prisma.magicLinkToken.create({
        data: {
          email,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
          returnTo: safeReturnTo(parsed.data.returnTo),
        },
      })
      await sendMagicLink(email, rawToken, safeReturnTo(parsed.data.returnTo))
    }
    response.json({ message: "Check your email for a sign-in link." })
  } catch (error) {
    handleError(error, response)
  }
})

authRouter.get("/verify", async (request, response) => {
  try {
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
