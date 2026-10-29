import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { memberships, organizations } from "@/lib/db/schema";

/**
 * The orgs background jobs should run for: every org that has at least one
 * member (a real tenant with someone to notify). Excludes data-only orgs with
 * no users (e.g. ones that exist only to contribute to the Trust Graph).
 */
export async function getActiveOrgIds(): Promise<string[]> {
  const rows = await db.selectDistinct({ orgId: memberships.orgId }).from(memberships);
  return rows.map((r) => r.orgId);
}

export async function getActiveOrgs(): Promise<{ id: string; name: string }[]> {
  return db
    .selectDistinct({ id: organizations.id, name: organizations.name })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId));
}
