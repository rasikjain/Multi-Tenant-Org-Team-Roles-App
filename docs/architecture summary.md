## Architecture rationale

- **Tenant boundary**: Every row referencing `organizations.id`; all queries include `orgId` or derive it from membership
- **Strict isolation**: Middleware resolves caller’s `orgId` from membership; routes require param `:orgId` to match
- **Trade-offs**:
  - Simpler app-logic isolation vs. extra joins to enforce scope
  - Org-scoped roles + team-scoped roles add flexibility but more checks

## Permission matrix

| Role | org:manage | team:manage | team:write | read:all |
|---|---|---|---|---|
| OrgAdmin | true | true | true | true |
| TeamManager | false | true | true | true |
| Member | false | false | true | true |
| Auditor | false | false | false | true |

Notes:
- **OrgAdmin**: full control at org and team level
- **TeamManager**: manage members in their teams, write in team
- **Member**: contribute within assigned teams
- **Auditor**: read-only across the org

## Data privacy & leakage prevention

- **Org scoping middleware**: Infers `orgId` from `:orgId` or first membership; rejects users not in the org
- **Central guard**: `requireOrgParamMatch` denies cross-org access before handlers
- **DB-level discipline**: All selects/updates filter by `orgId`; team rows also carry `orgId` for cross-checks
- **Soft deletes**: `deletedAt` respected to hide retired tenants/teams

## Idempotency & concurrency

- **Upserts**: Unique constraints with `onConflict` for memberships, team memberships, and invites
- **Invite acceptance**: Re-entrant; creates user if missing, updates membership if exists
- **Role changes**: Idempotent update driven by unique `(orgId,userId)`
- **Tokens**: Unique `invites.token`; expiration enforced at acceptance

## Cost & scale

- **Indexes**: Unique on `organizations.slug`, `(teams.orgId, teams.slug)`, `(memberships.orgId, memberships.userId)`, `(team_memberships.teamId, team_memberships.userId)`, `invites.token`
- **Pagination**: `limit/offset` with caps; stable ordering can be added (e.g., by created_at)
- **N+1 avoidance**: Server-side joins for member listings (users+roles+membership)
- **Hotspots**: Writes to audit table; keep narrow columns, batch/async acceptable later
- **Connection pooling**: `pg` Pool + Neon-compatible

## Rollout plan

- **Phase 1 (MVP)**: Core org/team/membership/invite; header auth; audit; OpenAPI + Swagger
- **Phase 2 (Hardening)**: Add created_by fields, row-level policies if using PG RLS, rate limits
- **Phase 3 (Observability)**: Structured logging, metrics, tracing, slow query analysis
- **SCIM/SSO next**:
  - SSO: OIDC login to map identity → user; first-login org assignment by invite or admin
  - SCIM: Provisioning endpoints to create/patch/deprovision users and group-to-team sync; idempotent PUT/PATCH with externalId mapping

