# Pulse

Pulse is a product feedback platform with public feedback boards and a workspace dashboard for managing requests, votes, changelogs, analytics, and architecture blueprints.

## Project layout

- `client/` — React, TypeScript, and Vite frontend.
- `server/` — Express API, Prisma ORM, and PostgreSQL schema/migrations.
- `PRODUCTION.md` — deployment and production environment guide.

## Requirements

- Node.js 22 or newer and npm.
- PostgreSQL for the API.
- Brevo credentials for email sign-in links. AI and Razorpay integrations are optional.

## Local development

1. Install dependencies and create local environment files:

   ```sh
   cd server && npm ci && cp .env.example .env
   cd ../client && npm ci && cp .env.example .env
   ```

2. Set `DATABASE_URL` in `server/.env` to your local PostgreSQL database. `CLIENT_ORIGIN` and `APP_URL` should point to `http://localhost:5173` for local development. To send magic-link emails locally, set `BREVO_API_KEY` and a verified `BREVO_SENDER_EMAIL` in Brevo.

3. Create or update the local schema and generate Prisma Client:

   ```sh
   cd server
   npm run db:generate
   npm run db:push
   ```

   To populate the demo workspace, set `SEED_DEMO=true` in `server/.env`.

4. Start the API and frontend in separate terminals:

   ```sh
   cd server && npm run dev
   ```

   ```sh
   cd client && npm run dev
   ```

The Vite development server proxies `/api` to `http://localhost:4000`. The API health endpoint is available at `http://localhost:4000/api/health`.

## Deploying to Cloudflare Workers

For a local Wrangler deployment, create the ignored root file `.wrangler-secrets` with only the production secrets Wrangler should upload:

```dotenv
DATABASE_URL="your Neon connection string"
BREVO_API_KEY="your Brevo API key"
```

Then run `npm run cf:deploy` from `server/`. This invokes Wrangler with `--secrets-file ../.wrangler-secrets`. Keep this file out of Git.

For Cloudflare Workers Builds, add `DATABASE_URL` and `BREVO_API_KEY` as **build secrets** under the Worker’s **Settings → Builds → Build variables and secrets**. These are separate from the Worker’s runtime Variables and Secrets. Set the deploy command to:

```sh
bash scripts/cloudflare-deploy.sh
```

The script writes those two build secrets to a temporary JSON file and passes it to Wrangler with `--secrets-file`; it removes the file when deployment finishes. Cloudflare documents build variables and secrets as values available only to the build environment, and Wrangler supports JSON secrets files for deployment.

## Code quality

Run these from `client/` and `server/` as needed:

```sh
npm run format
npm run format:check
npm run build
```

The frontend also has `npm run lint`. GitHub Actions runs formatting checks, frontend lint/build, Prisma Client generation, schema validation, and the API TypeScript build for pushes and pull requests.

## Database migrations

The checked-in SQL migrations under `server/prisma/migrations/` are the source of truth for deployed database changes. Apply them to a deployment database with:

```sh
cd server && npm run db:migrate:deploy
```

Use `db:push` only for local development. See [PRODUCTION.md](PRODUCTION.md) for deployment setup and existing-database guidance.
