import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { memberships, roleTypes, teams, teamMemberships } from "../db/schema";

// Caller with userId and orgId
export type Caller = {
  userId: string;
  orgId: string;
};

// Permissions derived from roles in the org
export type Permissions = {
  canOrgManage: boolean;
  canTeamManage: boolean;
  canTeamWrite: boolean;
  canReadAll: boolean;
};

// Get aggregated permissions for caller in their org
export async function getOrgPermissions(caller: Caller): Promise<Permissions> {
  const rows = await db.select({
    canOrgManage: roleTypes.canOrgManage,
    canTeamManage: roleTypes.canTeamManage,
    canTeamWrite: roleTypes.canTeamWrite,
    canReadAll: roleTypes.canReadAll,
  }).from(memberships)
    .innerJoin(roleTypes, eq(memberships.roleId, roleTypes.id))
    .where(and(eq(memberships.orgId, caller.orgId), eq(memberships.userId, caller.userId)));

  const agg = rows.reduce<Permissions>((acc, r) => ({
    canOrgManage: acc.canOrgManage || r.canOrgManage,
    canTeamManage: acc.canTeamManage || r.canTeamManage,
    canTeamWrite: acc.canTeamWrite || r.canTeamWrite,
    canReadAll: acc.canReadAll || r.canReadAll,
  }), { canOrgManage: false, canTeamManage: false, canTeamWrite: false, canReadAll: false });
  
  return agg;
}

// Ensure caller has org management permissions
export async function ensureOrgManage(caller: Caller) {
  const p = await getOrgPermissions(caller);
  if (!p.canOrgManage) throw new Error("FORBIDDEN_ORG_MANAGE");
}

// Ensure caller has team management permissions, and belongs to the team if not org admin
export async function ensureTeamManage(caller: Caller, teamId: string) {
  const p = await getOrgPermissions(caller);
  if (p.canOrgManage) return;

  if (!p.canTeamManage)
    throw new Error("FORBIDDEN_TEAM_MANAGE");

  // additionally ensure the caller belongs to that team if not org admin
  const rows = await db.select().from(teamMemberships)
    .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
    .where(and(eq(teamMemberships.userId, caller.userId), eq(teamMemberships.teamId, teamId), eq(teamMemberships.orgId, caller.orgId)));

  if (rows.length === 0)
    throw new Error("FORBIDDEN_TEAM_SCOPE");
}

// Ensure caller has read permissions in the org
export async function ensureReadInOrg(caller: Caller) {
  const p = await getOrgPermissions(caller);

  if (!(p.canReadAll || p.canTeamWrite || p.canTeamManage || p.canOrgManage)) {
    throw new Error("FORBIDDEN_READ");
  }
}

