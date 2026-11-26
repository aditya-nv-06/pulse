import type { Workspace } from "@prisma/client"

type PublicFeature = {
  id: string
  title: string
  description: string
  author: string
  status: string
  createdAt: string
}

export const isGoogleAppsScriptWebhook = (value: string) => {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.hostname === "script.google.com" &&
      /^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname)
    )
  } catch {
    return false
  }
}

export const sendGoogleSheetsFeature = async (
  webhookUrl: string,
  workspace: Pick<Workspace, "name" | "slug">,
  post: PublicFeature,
) => {
  if (!isGoogleAppsScriptWebhook(webhookUrl))
    throw new Error("Google Sheets webhook URL is invalid")
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "feature.created",
      workspace: { name: workspace.name, slug: workspace.slug },
      feature: {
        id: post.id,
        title: post.title,
        description: post.description,
        author: post.author,
        status: post.status,
        createdAt: post.createdAt,
        boardUrl: `/board/${workspace.slug}`,
      },
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`Google Sheets webhook responded with HTTP ${response.status}`)
}
