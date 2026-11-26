import { readFileSync } from "node:fs"

const config = JSON.parse(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"))
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

if (
  !config.vars?.RESEND_FROM ||
  config.vars.RESEND_FROM.includes("onboarding@resend.dev") ||
  config.vars.RESEND_FROM.startsWith("REPLACE_WITH_")
) {
  errors.push("RESEND_FROM must be a sender address on a verified Resend domain")
}

const hyperdriveId = config.hyperdrive?.[0]?.id
if (!/^[a-f0-9]{32}$/i.test(hyperdriveId ?? "")) {
  errors.push("Set hyperdrive[0].id to the 32-character ID created in your Cloudflare account")
}

if (errors.length) {
  console.error("Cloudflare deployment config is incomplete:")
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
}
