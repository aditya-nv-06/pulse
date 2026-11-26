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
