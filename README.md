## Multi‑Tenant Org/Team/Roles Infrastructure

A Node + TypeScript + Express API implementing a production‑minded, multi‑tenant foundation with organizations, teams, RBAC, invites, and auditing. Data is stored in Postgres using Drizzle ORM. Swagger UI and a Postman collection are provided.

### Features

- Multi‑tenant org boundary with strict isolation
- Orgs, Teams, Users, Org Memberships, Team Memberships, Role Types
- RBAC with minimal permission matrix (OrgAdmin, TeamManager, Member, Auditor)
- Email‑based invites with expiration and idempotent acceptance
- Audit events for all mutating endpoints
- OpenAPI spec with Swagger UI and a Postman collection

### Setup

1. Prereqs: Node 18+, Postgres (Neon/local), npm
2. Copy env: `cp .env.example .env` and update `DATABASE_URL`
3. Install deps: `npm install`

### Database: Setup & Migrations

- Configure Drizzle (`drizzle.config.ts`) already points to `src/db/schema.ts`
- Generate SQL (optional): `npm run drizzle:generate`
- Apply schema to DB: `npm run drizzle:push`

Alternatively, you can run the provided initial SQL in `drizzle/` directly.

### Database: Seeding

- Seed sample data and print an invite token: `npm run seed`
- Seed includes Orgs (Acme, Globex), Teams, Users (Alice, Bob, Carol, Dan), Memberships, and a pending invite for Eve.

### Scripts

- `dev`: run the API with hot‑reload (tsx)
- `build`: type‑check and compile to `dist`
- `start`: run compiled server
- `drizzle:generate`: generate SQL migrations from schema
- `drizzle:push`: apply schema to the database
- `drizzle:migrate`: run migrations (if using generated migrations)
- `seed`: seed database with scenario

### Run the API Server

1. Start dev server: `npm run dev`
2. Health check: GET `http://localhost:3000/health`

Auth model (dev): pass `x-user-id` header. Org scope is derived from the route param `:orgId` and validated against the caller's memberships.

### API Usage (Swagger & Postman)

- Swagger UI: open `http://localhost:3000/docs` (served from `docs/openapi.yaml`)
- Postman: import `docs/postman_collection.json`
  - Set environment variables: `baseUrl`, `alice`, `bob`, `acmeId`, `globexId`, `acmePartnershipsId`, `inviteToken`

You can also use `docs/requests.http` for quick requests in compatible editors.

### Key Endpoints

- POST `/orgs` → create org (creator becomes OrgAdmin)
- POST `/orgs/{orgId}/teams` → create team
- GET `/orgs/{orgId}/teams` → list teams (paginated)
- POST `/orgs/{orgId}/invites` → create invite (email, role, optional team)
- POST `/invites/{token}/accept` → accept invite (creates user if needed, assigns memberships)
- POST `/orgs/{orgId}/members/{userId}/role` → change org role (idempotent)
- GET `/orgs/{orgId}/members` → list members with roles (paginated)

### Docs & Diagrams

- OpenAPI: `docs/openapi.yaml`
- ER Diagram (Mermaid): `docs/erd.mmd`
- Architecture notes: `docs/architecture.md` (summary of rationale, RBAC, privacy, idempotency, scaling, rollout)