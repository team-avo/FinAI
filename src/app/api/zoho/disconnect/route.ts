import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { zohoConnections } from "@/lib/db/schema";
import { getSessionOrg } from "@/lib/auth/session-org";
import { revokeRefreshToken } from "@/lib/zoho/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Remove the current user's Zoho connection for their org and best-effort
 * revoke the refresh token at Zoho. POST-only to prevent CSRF via GET.
 */
export async function POST(req: NextRequest) {
  const sess = await getSessionOrg(req);
  if (!sess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select()
    .from(zohoConnections)
    .where(
      and(eq(zohoConnections.userId, sess.userId), eq(zohoConnections.orgId, sess.orgId)),
    )
    .limit(1);

  if (!row) return NextResponse.json({ ok: true, alreadyDisconnected: true });

  await db
    .delete(zohoConnections)
    .where(
      and(eq(zohoConnections.userId, sess.userId), eq(zohoConnections.orgId, sess.orgId)),
    );

  // Fire-and-forget revoke — DB row is gone either way.
  revokeRefreshToken(row.refreshToken).catch(() => {});

  return NextResponse.json({ ok: true });
}
