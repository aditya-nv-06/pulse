#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_database_url="postgresql://postgres:postgres@127.0.0.1:5432/pulse"
cd "$repo_root"

npm ci --prefix client
DATABASE_URL="$build_database_url" npm ci --prefix server
npm --prefix client run build
npm --prefix server run cf:check
DATABASE_URL="$build_database_url" npm --prefix server run db:generate
