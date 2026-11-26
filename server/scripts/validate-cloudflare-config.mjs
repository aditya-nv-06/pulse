import { readFileSync } from "node:fs"

const rawConfig = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8")
const config = JSON.parse(rawConfig.replace(/,\s*([}\]])/g, "$1"))
const errors = []

for (const name of ["CLIENT_ORIGIN", "APP_URL"]) {
  const value = config.vars?.[name]
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.hostname.includes("replace")) {
      errors.push(`${name} must be set to the Worker's public HTTPS origin`)
    }
  } catch {
    errors.push(`${name} must be set to a valid HTTPS URL`)
  }
}

if (config.vars?.CLIENT_ORIGIN !== config.vars?.APP_URL) {
  errors.push(
    "CLIENT_ORIGIN and APP_URL must match because the app and API share one Worker origin",
  )
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.vars?.BREVO_SENDER_EMAIL ?? "")) {
  errors.push("BREVO_SENDER_EMAIL must be a valid sender address configured in Brevo")
}

for (const secretName of [
  "DATABASE_URL",
  "BREVO_API_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
]) {
  if (!config.secrets?.required?.includes(secretName)) {
    errors.push(`Declare ${secretName} in secrets.required in wrangler.jsonc`)
  }
}

if (errors.length) {
  console.error("Cloudflare deployment config is incomplete:")
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
}
