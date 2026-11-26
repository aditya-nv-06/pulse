#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Add DATABASE_URL as a secret under Workers Builds > Build variables and secrets}"
: "${BREVO_API_KEY:?Add BREVO_API_KEY as a secret under Workers Builds > Build variables and secrets}"

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
  }),
  { mode: 0o600 },
);
NODE

./server/node_modules/.bin/wrangler deploy \
  --config wrangler.jsonc \
  --secrets-file "$secrets_file"
