import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import { provisionOrgForUser } from "@/lib/auth/provision";

export type MemberRole = "owner" | "accountant" | "viewer";

export type Context = {
  orgId: string;
  userId: string | null;
  /** The user's role in the org; null when unauthenticated / not a member. */
  role: MemberRole | null;
};

export async function createContext({ req }: FetchCreateContextFnOptions): Promise<Context> {
  let userId: string | null = null;
  let sessionUser: { id: string; name?: string | null; email?: string | null } | null = null;
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      userId = session.user.id;
      sessionUser = { id: session.user.id, name: session.user.name, email: session.user.email };
    }
  } catch {}

  // Unauthenticated requests keep a harmless default; protected procedures
  // require a user anyway, so this org is never used to read data.
  let orgId = "advertout";
  let role: MemberRole | null = null;

  if (userId && sessionUser) {
    // Authenticated users resolve to THEIR OWN org — never inherit the default.
    // An empty orgId simply returns no rows, which is safe; it never leaks
    // another org's data.
    orgId = "";
    try {
      const [m] = await db
        .select({ orgId: memberships.orgId, role: memberships.role })
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .orderBy(memberships.createdAt)
        .limit(1);
      if (m) {
        orgId = m.orgId;
        role = m.role as MemberRole;
      } else {
        // New sign-up with no org yet — give them their own.
        orgId = await provisionOrgForUser(sessionUser);
        role = "owner";
      }
    } catch {
      // Keep orgId="" (empty, safe) rather than falling back to a shared org.
    }
  }

  return { orgId, userId, role };
}
