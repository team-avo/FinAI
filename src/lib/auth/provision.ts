import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { memberships, organizations } from "@/lib/db/schema";

/**
 * Ensure a user has their own organization. Idempotent: returns the user's
 * existing org if they already have a membership, otherwise creates a fresh one
 * (owner membership + a seeded chart of accounts).
 *
 * This is what makes the app multi-tenant — each signed-up user lands in their
 * OWN books instead of a shared org. The org id is derived from the user id so
 * concurrent first-requests converge on the same org instead of racing to
 * create duplicates.
 */
export async function provisionOrgForUser(user: {
  id: string;
  name?: string | null;
  email?: string | null;
}): Promise<string> {
  const [existing] = await db
    .select({ orgId: memberships.orgId })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);
  if (existing) return existing.orgId;

  const orgId = `org_${user.id}`;
  const base = user.name?.trim() || user.email?.split("@")[0] || "My business";
  const name = base.slice(0, 60);

  await db.insert(organizations).values({ id: orgId, name }).onConflictDoNothing();

  const [m] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, user.id)))
    .limit(1);
  if (!m) {
    await db.insert(memberships).values({ orgId, userId: user.id, role: "owner" });
  }

  // Seed a chart of accounts so the ledger works. Dynamic import avoids any
  // load-time cycle with the seed module.
  try {
    const { ensureOrgSeeded } = await import("@/lib/db/seed");
    await ensureOrgSeeded(orgId);
  } catch (e) {
    console.error("ensureOrgSeeded failed for", orgId, e);
  }

  return orgId;
}
