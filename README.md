# Pulse

Pulse is a product feedback platform with public feedback boards and a workspace dashboard for managing requests, votes, changelogs, analytics, and architecture blueprints.

## Project layout

- `client/` — React, TypeScript, and Vite frontend.
- `server/` — Express API, Prisma ORM, and PostgreSQL schema/migrations.
- `PRODUCTION.md` — deployment and production environment guide.

## Requirements

- Node.js 22 or newer and npm.
- PostgreSQL for the API.
- Resend credentials for email sign-in links. AI and Razorpay integrations are optional.

## Local development

1. Install dependencies and create local environment files:

   ```sh
   cd server && npm ci && cp .env.example .env
   cd ../client && npm ci && cp .env.example .env
   ```

2. Set `DATABASE_URL` in `server/.env` to your local PostgreSQL database. `CLIENT_ORIGIN` and `APP_URL` should point to `http://localhost:5173` for local development. To receive magic-link emails locally, set `RESEND_API_KEY` and a valid `RESEND_FROM` sender.

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
