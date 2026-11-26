#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

npm ci --prefix client
npm ci --prefix server
npm --prefix client run build
npm --prefix server run cf:check
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/pulse npm --prefix server run db:generate
