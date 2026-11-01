import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";

export type MemberRole = "owner" | "accountant" | "viewer";

/**
 * Deterministically resolve a user's PRIMARY org from their memberships.
 *
 * A user can belong to several orgs. We must pick ONE stable org for every
 * request so the whole app shows the same org's data — never a random one.
 * Order of preference: role (owner first), then the oldest membership, then the
 * org id as a final tiebreaker.
 *
 * This replaces an earlier `orderBy(createdAt).limit(1)` with no tiebreaker: for
 * a user in two orgs that could resolve a DIFFERENT org from one request to the
 * next, so e.g. the dashboard and the invoices page would render different orgs.
 *
 * Returns null when the user has no membership yet (caller provisions one).
 */
export async function resolvePrimaryOrg(
  userId: string,
): Promise<{ orgId: string; role: MemberRole } | null> {
  const [m] = await db
    .select({ orgId: memberships.orgId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .orderBy(
      sql`CASE ${memberships.role} WHEN 'owner' THEN 0 WHEN 'accountant' THEN 1 ELSE 2 END`,
      asc(memberships.createdAt),
      asc(memberships.orgId),
    )
    .limit(1);
  return m ? { orgId: m.orgId, role: m.role as MemberRole } : null;
}
