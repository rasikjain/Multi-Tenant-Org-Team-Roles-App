import "dotenv/config";
import { db, pool } from "../src/db/client";
import { organizations, teams, users, roleTypes, memberships, invites, teamMemberships } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

// Seed initial data for testing and development
// Run with `ts-node scripts/seed.ts`

// Ensure standard roles exist for the org, return the requested one
async function ensureRole(orgId: string, name: "OrgAdmin" | "TeamManager" | "Member" | "Auditor") {

  const caps = {
    OrgAdmin: { canOrgManage: true, canTeamManage: true, canTeamWrite: true, canReadAll: true },
    TeamManager: { canOrgManage: false, canTeamManage: true, canTeamWrite: true, canReadAll: true },
    Member: { canOrgManage: false, canTeamManage: false, canTeamWrite: true, canReadAll: true },
    Auditor: { canOrgManage: false, canTeamManage: false, canTeamWrite: false, canReadAll: true },
  }[name];

  let [role] = await db.select().from(roleTypes).where(and(eq(roleTypes.orgId, orgId), eq(roleTypes.name, name)));

  if (!role) {
    [role] = await db.insert(roleTypes).values({ orgId, name, ...caps }).returning();
  }

  return role;
}

// Main seeding function
async function main() {
  console.log("Seeding data...");
  
  // Orgs
  const [acme] = await db.insert(organizations).values({ name: "Acme", slug: "acme" }).onConflictDoNothing().returning();
  const acmeId = acme?.id ?? (await db.select().from(organizations).where(eq(organizations.slug, "acme")))[0].id;

  const [globex] = await db.insert(organizations).values({ name: "Globex", slug: "globex" }).onConflictDoNothing().returning();
  const globexId = globex?.id ?? (await db.select().from(organizations).where(eq(organizations.slug, "globex")))[0].id;

  // Teams
  const [acmeSales] = await db.insert(teams).values({ orgId: acmeId, name: "Sales", slug: "sales" }).onConflictDoNothing().returning();
  const acmeSalesId = acmeSales?.id ?? (await db.select().from(teams).where(and(eq(teams.orgId, acmeId), eq(teams.slug, "sales"))))[0].id;
  
  const [acmePartnerships] = await db.insert(teams).values({ orgId: acmeId, name: "Partnerships", slug: "partnerships" }).onConflictDoNothing().returning();
  const acmePartnershipsId = acmePartnerships?.id ?? (await db.select().from(teams).where(and(eq(teams.orgId, acmeId), eq(teams.slug, "partnerships"))))[0].id;
  
  await db.insert(teams).values({ orgId: globexId, name: "CS", slug: "cs" }).onConflictDoNothing();
  await db.insert(teams).values({ orgId: globexId, name: "Ops", slug: "ops" }).onConflictDoNothing();

  // Users
  const usersSeed = [
    { email: "alice@example.com", name: "Alice" },
    { email: "bob@example.com", name: "Bob" },
    { email: "carol@example.com", name: "Carol" },
    { email: "dan@example.com", name: "Dan" },
  ];
  
  for (const u of usersSeed) await db.insert(users).values(u).onConflictDoNothing();
  
  const byEmail = async (email: string) => (await db.select().from(users).where(eq(users.email, email)))[0];
  const alice = await byEmail("alice@example.com");
  const bob = await byEmail("bob@example.com");
  const carol = await byEmail("carol@example.com");
  const dan = await byEmail("dan@example.com");

  // Roles per org
  const acmeAdmin = await ensureRole(acmeId, "OrgAdmin");
  const acmeManager = await ensureRole(acmeId, "TeamManager");
  const acmeMember = await ensureRole(acmeId, "Member");
  const acmeAuditor = await ensureRole(acmeId, "Auditor");
  const globexAdmin = await ensureRole(globexId, "OrgAdmin");

  // Memberships
  await db.insert(memberships).values({ orgId: acmeId, userId: alice.id, roleId: acmeAdmin.id }).onConflictDoNothing();
  await db.insert(memberships).values({ orgId: acmeId, userId: bob.id, roleId: acmeMember.id }).onConflictDoNothing();
  await db.insert(memberships).values({ orgId: acmeId, userId: carol.id, roleId: acmeAuditor.id }).onConflictDoNothing();
  await db.insert(memberships).values({ orgId: globexId, userId: dan.id, roleId: globexAdmin.id }).onConflictDoNothing();

  // Team memberships
  await db.insert(teamMemberships).values({ orgId: acmeId, teamId: acmePartnershipsId, userId: alice.id, roleId: acmeManager.id }).onConflictDoNothing();
  await db.insert(teamMemberships).values({ orgId: acmeId, teamId: acmeSalesId, userId: bob.id, roleId: acmeMember.id }).onConflictDoNothing();

  // Pending invite for eve@example.com to Acme/Sales (Member)
  const token = randomUUID();
  
  await db.insert(invites).values({ orgId: acmeId, teamId: acmeSalesId, email: "eve@example.com", token, roleId: acmeMember.id, expiresAt: new Date(Date.now() + 72 * 3600 * 1000) }).onConflictDoNothing();
  console.log("Pending invite token for Eve:", token);

  console.log("Seed complete.");
}

main().finally(async () => {
  await pool.end();
});

