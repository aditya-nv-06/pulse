import type { NextFunction, Request, Response } from "express"
import { prisma } from "../db.js"
import { getSessionCookie, sessionHash } from "../lib/session.js"

export type AuthRequest = Request & { userId?: string }

export const requireAuth = async (request: AuthRequest, response: Response, next: NextFunction) => {
  const token = getSessionCookie(request.headers.cookie)
  if (!token) {
    response.status(401).json({ error: "Authentication required" })
    return
  }
  const session = await prisma.session.findFirst({
    where: { tokenHash: sessionHash(token), expiresAt: { gt: new Date() } },
    include: { user: true },
  })
  if (!session) {
    response.status(401).json({ error: "Session expired" })
    return
  }
  request.userId = session.userId
  next()
}

export const handleError = (error: unknown, response: Response) => {
  console.error(error)
  response.status(500).json({ error: "Something went wrong" })
}
