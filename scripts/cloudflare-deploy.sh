#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Add DATABASE_URL as a secret under Workers Builds > Build variables and secrets}"
: "${BREVO_API_KEY:?Add BREVO_API_KEY as a secret under Workers Builds > Build variables and secrets}"
: "${RAZORPAY_KEY_ID:?Add RAZORPAY_KEY_ID as a secret under Workers Builds > Build variables and secrets}"
: "${RAZORPAY_KEY_SECRET:?Add RAZORPAY_KEY_SECRET as a secret under Workers Builds > Build variables and secrets}"

if [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" && -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required when CLOUDFLARE_ACCOUNT_ID is set" >&2
  exit 1
fi
if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" && -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID is required when CLOUDFLARE_API_TOKEN is set" >&2
  exit 1
fi
if [[ -z "${XAI_API_KEY:-}" && -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Add XAI_API_KEY or both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN as build secrets" >&2
  exit 1
fi

secrets_file="$(mktemp)"
trap 'rm -f "$secrets_file"' EXIT

node - "$secrets_file" <<'NODE'
const fs = require("node:fs");

const [, , filePath] = process.argv;
fs.writeFileSync(
  filePath,
  JSON.stringify({
    DATABASE_URL: process.env.DATABASE_URL,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    ...(process.env.CLOUDFLARE_ACCOUNT_ID
      ? {
          CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
          CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
        }
      : {}),
    ...(process.env.XAI_API_KEY ? { XAI_API_KEY: process.env.XAI_API_KEY } : {}),
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  }),
  { mode: 0o600 },
);
NODE

./server/node_modules/.bin/wrangler deploy \
  --config wrangler.jsonc \
  --secrets-file "$secrets_file"
