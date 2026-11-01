import { auth } from "@/lib/auth";
import { provisionOrgForUser } from "./provision";
import { resolvePrimaryOrg } from "./resolve-org";

/**
 * Resolve the authenticated user's org for a raw API-route Request — the
 * route-handler equivalent of the tRPC context. Returns null when there's no
 * valid session. Mirrors context.ts: a user always resolves to THEIR own org
 * (provisioning one if needed), never a shared default.
 */
export async function getSessionOrg(
  req: Request,
): Promise<{ userId: string; orgId: string } | null> {
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

  // Deterministic primary-org resolution (see resolvePrimaryOrg) — the same org
  // the tRPC context resolves, so route handlers and the app never disagree.
  const m = await resolvePrimaryOrg(user.id);
  const orgId = m?.orgId ?? (await provisionOrgForUser(user));
  return { userId: user.id, orgId };
}
