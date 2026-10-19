import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";

export type MemberRole = "owner" | "accountant" | "viewer";

export type Context = {
  orgId: string;
  userId: string | null;
  /** The user's role in the org; null when unauthenticated / not a member. */
  role: MemberRole | null;
};

export async function createContext({ req }: FetchCreateContextFnOptions): Promise<Context> {
  const orgId = "advertout";
  let userId: string | null = null;

  try {
    const session = await auth.api.getSession({ headers: req.headers });
    userId = session?.user?.id ?? null;
  } catch {}

  let role: MemberRole | null = null;
  if (userId) {
    try {
      const [m] = await db
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
        .limit(1);
      role = (m?.role as MemberRole | undefined) ?? null;
    } catch {}
  }

  return { orgId, userId, role };
}
