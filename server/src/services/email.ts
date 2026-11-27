import { config } from "../config.js"

type EmailMessage = {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export const sendEmail = async ({ to, subject, html, replyTo }: EmailMessage) => {
  if (!config.brevoApiKey) {
    if (config.isProduction) throw new Error("BREVO_API_KEY is not configured")
    return false
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.brevoApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Pulse", email: config.brevoSenderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    }),
  })

  const result = (await response.json().catch(() => null)) as {
    messageId?: string
    message?: string
    code?: string
  } | null
  if (!response.ok) {
    throw new Error(
      `Brevo rejected email (${response.status}): ${result?.message ?? result?.code ?? response.statusText}`,
    )
  }
  if (!result?.messageId) {
    throw new Error("Brevo returned success without an email message ID")
  }
  return true
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  )

export const sendShippedPostNotice = async (message: {
  to: string
  requesterName?: string | null
  postTitle: string
  workspaceName: string
}) => {
  const greeting = message.requesterName ? `Hi ${escapeHtml(message.requesterName)},` : "Hello,"
  return sendEmail({
    to: message.to,
    subject: `Shipped: ${message.postTitle}`,
    html: `<p>${greeting}</p><p><strong>${escapeHtml(message.postTitle)}</strong> has shipped in ${escapeHtml(message.workspaceName)}.</p><p>Thanks for helping shape the product.</p><p><small>Unsubscribe: email the workspace owner to stop receiving product updates.</small></p>`,
  })
}

export const sendMagicLink = async (
  email: string,
  token: string,
  returnTo = "/dashboard/posts",
) => {
  const url = `${config.appUrl}/api/auth/verify?token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(returnTo)}`
  if (!config.brevoApiKey && !config.isProduction) {
    console.info(`Magic link for ${email}: ${url}`)
    return false
  }
  return sendEmail({
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
  if (!config.brevoApiKey) {
    if (config.isProduction) {
      throw new Error("BREVO_API_KEY is not configured")
    }
    return false
  }
  const escapeHtml = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (character) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
        character,
    )
  const reviewUrl = `${config.appUrl}/dashboard/posts/${encodeURIComponent(request.postId)}?workspace=${encodeURIComponent(request.workspaceSlug)}`
  return sendEmail({
    to: request.founderEmail,
    subject: `Meeting requested: ${request.featureTitle}`,
    replyTo: request.requesterEmail,
    html: `<p>${escapeHtml(request.requesterName)} (${escapeHtml(request.requesterEmail)}) would like to meet about a feature request in ${escapeHtml(request.workspaceName)}.</p><p><strong>${escapeHtml(request.featureTitle)}</strong></p><p>${escapeHtml(request.featureDescription)}</p><p><a href="${escapeHtml(reviewUrl)}">Review feature request and requester details</a></p>`,
  })
}
