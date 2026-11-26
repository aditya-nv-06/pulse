import { Router } from "express"
import { z } from "zod"
import { config } from "../config.js"
import { handleError, requireAuth } from "../middleware/auth.js"

export const aiRouter = Router()
aiRouter.use(requireAuth)

const imageSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  resolution: z.enum(["1k", "2k"]).default("1k"),
})

aiRouter.post("/image", async (request, response) => {
  try {
    const parsed = imageSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: "Provide a valid image prompt and resolution" })
      return
    }
    if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
      response.status(503).json({ error: "Cloudflare AI is not configured on the server" })
      return
    }
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/ai/run/${config.cloudflareImageModel}`
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.cloudflareApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
    })
    if (!upstream.ok) {
      const detail = await upstream.text()
      console.error("Cloudflare image generation failed", upstream.status, detail)
      response
        .status(upstream.status === 401 || upstream.status === 403 ? 502 : 503)
        .json({ error: "Cloudflare image generation failed" })
      return
    }
    const contentType = upstream.headers.get("content-type") ?? ""
    if (contentType.includes("image/")) {
      response.setHeader("Content-Type", contentType)
      response.send(Buffer.from(await upstream.arrayBuffer()))
      return
    }
    const payload = (await upstream.json()) as { success?: boolean; result?: { image?: string } }
    if (!payload.success || !payload.result?.image) {
      response.status(502).json({ error: "Cloudflare returned no image" })
      return
    }
    response.json({ image: `data:image/png;base64,${payload.result.image}` })
  } catch (error) {
    handleError(error, response)
  }
})
