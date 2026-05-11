import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { zohoConnections } from "@/lib/db/schema";
import { refreshAggregate } from "@/lib/zoho/aggregator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron handler — every 5 min, refreshes the Zoho aggregate cache for
 * every connected Zoho org. Widgets read the cache, so freshness lags by at
 * most one cycle.
 *
 * Multi-tenant: walks the `zoho_connections` table; one cache entry per
 * (orgId, zohoOrgId). If two FinAI orgs map to the same Zoho org we'd refresh
 * twice — fine, the second is a no-op against Zoho's cache headers.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    return NextResponse.json({ skipped: "Zoho OAuth app not configured" });
  }

  const connections = await db.select().from(zohoConnections);
  if (connections.length === 0) {
    return NextResponse.json({ skipped: "No Zoho connections", refreshed: 0 });
  }

  const start = Date.now();
  const results = await Promise.allSettled(connections.map((c) => refreshAggregate(c)));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results
    .map((r, i) => (r.status === "rejected" ? { connectionId: connections[i].id, error: String(r.reason) } : null))
    .filter(Boolean);

  return NextResponse.json({
    ok: failed.length === 0,
    durationMs: Date.now() - start,
    refreshed: ok,
    failed,
  });
}
