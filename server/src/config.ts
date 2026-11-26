import "dotenv/config"

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}
export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFrom: process.env.RESEND_FROM ?? "Pulse <onboarding@resend.dev>",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayPlanId: process.env.RAZORPAY_PLAN_ID ?? "",
  xaiApiKey: process.env.XAI_API_KEY ?? "",
  xaiModel: process.env.XAI_MODEL ?? "grok-4-1-fast-reasoning",
  xaiBaseUrl: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
  cloudflareModel: process.env.CLOUDFLARE_AI_MODEL ?? "@cf/meta/llama-3.1-8b-instruct",
  cloudflareImageModel:
    process.env.CLOUDFLARE_IMAGE_MODEL ?? "black-forest-labs/flux-3-image-klein",
}

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  throw new Error("PORT must be a valid TCP port")
}

if (config.isProduction) {
  for (const [name, value] of [
    ["CLIENT_ORIGIN", config.clientOrigin],
    ["APP_URL", config.appUrl],
  ] as const) {
    if (value.startsWith("REPLACE_WITH_")) {
      throw new Error(`${name} must be set to the deployed HTTPS origin`)
    }
    let url: URL
    try {
      url = new URL(value)
    } catch {
      throw new Error(`${name} must be a valid absolute URL in production`)
    }
    if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      throw new Error(`${name} must use a public HTTPS URL in production`)
    }
  }
  if (!config.resendApiKey)
    throw new Error(
      "RESEND_API_KEY is required in production so sign-in links are delivered by email",
    )
  if (
    config.resendFrom.includes("onboarding@resend.dev") ||
    config.resendFrom.startsWith("REPLACE_WITH_")
  ) {
    throw new Error("Set RESEND_FROM to a verified sender domain in production")
  }
}
