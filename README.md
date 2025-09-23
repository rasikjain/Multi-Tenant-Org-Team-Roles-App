## Multi-Tenant Org/Team/Roles Infrastructure

Stack: Node + TypeScript, Express, Postgres (Neon-compatible), Drizzle ORM.

### Setup

1. Copy `.env.example` to `.env` and adjust values.
2. Install deps: `npm install`
3. Generate and push schema: `npm run drizzle:generate && npm run drizzle:push`
4. Seed data: `npm run seed`
5. Start dev server: `npm run dev` (http://localhost:3000)

### Scripts

- `dev`: Run dev server with reload
- `build`: Type-check and compile
- `start`: Run compiled server
- `drizzle:generate|push|migrate`: Manage migrations
- `seed`: Seed orgs, teams, users, invites

### OpenAPI

See `src/openapi.yaml`. You can use `docs/requests.http` for quick testing.

### ERD

See `docs/erd.svg`.

