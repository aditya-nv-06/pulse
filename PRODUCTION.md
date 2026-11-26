# Production deployment

Pulse runs as a Vite static frontend, an Express API, and a PostgreSQL database. The frontend and API can be deployed separately, but the API must be reachable over HTTPS and configured to allow the frontend origin.

## API service

Deploy `server/` with Node.js 22 or newer. Install dependencies with `npm ci`, generate Prisma Client with `npm run db:generate`, build with `npm run build`, then start with `npm start`. Set these environment variables in the hosting provider's secret/configuration panel:

- `NODE_ENV=production`
- `DATABASE_URL`: managed PostgreSQL connection string. Require TLS if the provider supports it.
- `CLIENT_ORIGIN`: exact public frontend origin, for example `https://pulse.example.com` (no trailing slash).
- `APP_URL`: public frontend origin used in sign-in links and redirects. Route `/api` on this origin to this API, or change the email link handling before using a separate API hostname.
- `RESEND_API_KEY` and `RESEND_FROM`: a Resend API key and sender address on a verified domain.
- `PORT`: supplied by most hosting platforms; Pulse listens on `0.0.0.0`.

Razorpay variables (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and, for subscriptions, `RAZORPAY_PLAN_ID`) are needed only when enabling payments. Set matching live-mode credentials on the API and public key ID on the frontend. AI integrations are optional; configure `XAI_API_KEY` and/or `CLOUDFLARE_ACCOUNT_ID` plus `CLOUDFLARE_API_TOKEN` for the features that use them.

The API's `/api/health` endpoint checks database connectivity and returns HTTP 503 when PostgreSQL is unavailable. Use it for the hosting provider's readiness check. The demo workspace is never seeded in production. For local demos, set `SEED_DEMO=true` with `NODE_ENV=development`.

## Database rollout

The initial PostgreSQL migration is in `server/prisma/migrations`. For a new database, run `npm run db:migrate:deploy` from `server/` before starting the API. For later schema changes, create and review a migration in development, commit it, and run the same deploy command as a release step. Do not use `db:push` against production databases.

Back up the database before the first rollout and keep the backup/restore procedure documented with your database provider. The app does not automatically migrate or seed a production database during startup.

## Frontend

Deploy `client/` as a static site. Run `npm ci` and `npm run build`; publish `dist/`. Set `VITE_API_URL=/api` when the frontend host or reverse proxy forwards `/api` to the API. For a separately hosted API, set `VITE_API_URL` to its full HTTPS URL ending in `/api` and configure `CLIENT_ORIGIN` to the frontend's exact origin. Set `VITE_RAZORPAY_KEY_ID` only to the public key ID when payments are enabled. Vite variables are embedded in public JavaScript; never put secrets in `VITE_*` variables.

Configure SPA fallback so client-side routes serve `index.html`, forward `/api/*` to the API when using a shared origin, and enable HTTPS for both services. Keep `.env` files out of source control and rotate any credential that has been committed or exposed.

## Cloudflare Workers deployment

The repo also includes a single Worker deployment that serves the Vite frontend and Express API from the same origin. This keeps the current session cookie setup same-origin. The API uses the existing PostgreSQL database through Cloudflare Hyperdrive; it does not migrate data or change the database schema.

1. If you deploy through Cloudflare Workers Builds, its build token handles deployment auth. For local Wrangler deploys, either authenticate with `cd server && npx wrangler login` after unsetting `CLOUDFLARE_API_TOKEN`, or use an account API token with `CLOUDFLARE_ACCOUNT_ID` set.
2. Create a Hyperdrive configuration in the Cloudflare dashboard for the existing PostgreSQL database. Copy its ID into `hyperdrive[0].id` in `wrangler.jsonc`. Keep the Neon connection string in Cloudflare's Hyperdrive configuration rather than committing it.
3. Find your account's `workers.dev` subdomain in Workers & Pages. The origin for this Worker is `https://pulse.<your-subdomain>.workers.dev`. Replace the `CLIENT_ORIGIN` and `APP_URL` placeholders with that origin, and set `RESEND_FROM` to an address on a verified Resend domain.
4. Add `RESEND_API_KEY` as a Worker secret in the Cloudflare dashboard (or use `npx wrangler secret put RESEND_API_KEY` from `server/`). Add Razorpay and AI credentials as secrets only if those integrations are enabled.
5. From `server/`, run `npm run cf:deploy`. The script validates the deployment config, builds the client, generates types and Prisma Client, and deploys the Worker. It does not run database migrations.

For Cloudflare Workers Builds connected to GitHub, configure these in **Workers & Pages → your Worker → Settings → Builds**:

- Build command: `bash scripts/cloudflare-build.sh`
- Deploy command: `./server/node_modules/.bin/wrangler deploy --config wrangler.jsonc`

The build script installs both packages, creates `client/dist`, validates the Worker settings, and generates Prisma Client using a dummy build-only URL. It never connects to a database. The deploy command then packages the prepared assets and Worker code.

The default Hyperdrive ID and public origin in `wrangler.jsonc` are placeholders. The deploy script refuses to run until you replace them. Cloudflare Workers Free currently includes 100,000 requests per day, a 10 ms CPU limit per request, and 100,000 Hyperdrive queries per day. External providers such as Resend, Razorpay, Neon, and AI APIs have separate pricing and limits.
