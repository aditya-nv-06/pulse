import { Resend } from "resend"
import { config } from "../config.js"

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null

export const sendMagicLink = async (
  email: string,
  token: string,
  returnTo = "/dashboard/posts",
) => {
  const url = `${config.appUrl}/api/auth/verify?token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(returnTo)}`
  if (!resend) {
    console.info(`Magic link for ${email}: ${url}`)
    return
  }
  await resend.emails.send({
    from: config.resendFrom,
    to: email,
    subject: "Your Pulse sign-in link",
    html: `<p>Sign in to Pulse:</p><p><a href="${url}">Open your workspace</a></p><p>This link expires after use.</p>`,
  })
}

export const sendFounderMeetingRequestNotice = async (request: {
  founderEmail: string
  requesterName: string
  requesterEmail: string
  featureTitle: string
  featureDescription: string
  workspaceName: string
  workspaceSlug: string
  postId: string
}) => {
  if (!resend) return false
  const escapeHtml = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (character) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
        character,
    )
  const reviewUrl = `${config.appUrl}/dashboard/posts/${encodeURIComponent(request.postId)}?workspace=${encodeURIComponent(request.workspaceSlug)}`
  await resend.emails.send({
    from: config.resendFrom,
    to: request.founderEmail,
    replyTo: request.requesterEmail,
    subject: `Meeting requested: ${request.featureTitle}`,
    html: `<p>${escapeHtml(request.requesterName)} (${escapeHtml(request.requesterEmail)}) would like to meet about a feature request in ${escapeHtml(request.workspaceName)}.</p><p><strong>${escapeHtml(request.featureTitle)}</strong></p><p>${escapeHtml(request.featureDescription)}</p><p><a href="${escapeHtml(reviewUrl)}">Review feature request and requester details</a></p>`,
  })
  return true
}
