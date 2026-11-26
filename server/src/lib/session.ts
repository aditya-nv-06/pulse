import crypto from "node:crypto"

export const sessionHash = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex")
export const getSessionCookie = (cookieHeader: string | undefined) =>
  cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("pulse_session="))
    ?.split("=")[1]
