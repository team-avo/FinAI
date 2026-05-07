import { NextResponse } from "next/server";
import { refreshAggregate } from "@/lib/zoho/aggregator";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow up to 60s for the full sweep

/**
 * Vercel Cron handler — fires every 5 min, refreshes the Zoho aggregate
 * and writes it to Redis. Widgets read from cache, so freshness lags
 * by at most one cycle.
 *
 * Auth: Vercel Cron sends an Authorization header with CRON_SECRET if set.
 * We accept either that or a no-auth invocation (Vercel only allows the
 * cron path from inside their network anyway).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Skip silently if Zoho isn't configured (preview deploys).
  if (!process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_CLIENT_ID) {
    return NextResponse.json({ skipped: "Zoho not configured" });
  }

  try {
    const start = Date.now();
    const data = await refreshAggregate();
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      generatedAt: data.generatedAt,
      counts: {
        invoices: data.invoices.all.length,
        expenses: data.expensesData.all.length,
        customers: data.customers.all.length,
        bankAccounts: data.cash.accounts.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
