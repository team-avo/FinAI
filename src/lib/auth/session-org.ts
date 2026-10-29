import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import { provisionOrgForUser } from "./provision";

/**
 * Resolve the authenticated user's org for a raw API-route Request — the
 * route-handler equivalent of the tRPC context. Returns null when there's no
 * valid session. Mirrors context.ts: a user always resolves to THEIR own org
 * (provisioning one if needed), never a shared default.
 */
export async function getSessionOrg(req: Request): Promise<{ userId: string; orgId: string } | null> {
  let user: { id: string; name?: string | null; email?: string | null } | null = null;
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      user = { id: session.user.id, name: session.user.name, email: session.user.email };
    }
  } catch {
    return null;
  }
  if (!user) return null;

  const [m] = await db
    .select({ orgId: memberships.orgId })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .orderBy(memberships.createdAt)
    .limit(1);

  const orgId = m?.orgId ?? (await provisionOrgForUser(user));
  return { userId: user.id, orgId };
}
