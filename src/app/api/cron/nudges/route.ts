import { type NextRequest, NextResponse } from "next/server";
import { rebuildSupplierNetworkStats } from "@/lib/accounting/reports/supplier-trust";
import { runNudges } from "@/lib/ai/nudges";
import { getActiveOrgIds } from "@/lib/db/active-orgs";
import { seedCurrentMonthLedger } from "@/lib/demo/current-month-ledger";
import { logActivity } from "@/lib/trpc/routers/activity";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel Cron: once a day. For EVERY active org, creates in-app notifications
// for GST deadlines, the 30-Nov ITC cliff, and overdue receivables (deduped by
// period).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orgIds = await getActiveOrgIds();
    const results: unknown[] = [];
    for (const orgId of orgIds) {
      try {
        const result = await runNudges(orgId);
        await logActivity({
          orgId,
          actor: "cron",
          action: "cron:nudges",
          entityType: "notification",
          output: result,
        }).catch(() => {});
        results.push({ orgId, ...result });
      } catch (error) {
        console.error("Nudges cron error for org", orgId, error);
        results.push({ orgId, error: true });
      }
    }
    // Rebuild the cross-business Trust Graph once per day (global, not per-org).
    let networkStored = 0;
    try {
      networkStored = await rebuildSupplierNetworkStats();
    } catch (error) {
      console.error("Trust Graph rebuild error:", error);
    }

    // Keep the demo org's current-month P&L evergreen: the one-shot seed anchors
    // the ledger to the month it ran in, so without a daily re-anchor the
    // Dashboard MTD empties out when the calendar month rolls over.
    let demoLedger: unknown = null;
    if (process.env.SEED_DEMO_DATA === "1") {
      try {
        demoLedger = await seedCurrentMonthLedger("advertout");
      } catch (error) {
        console.error("Demo ledger refresh error:", error);
      }
    }

    return NextResponse.json({
      status: "ok",
      orgs: orgIds.length,
      results,
      networkStored,
      demoLedger,
    });
  } catch (error) {
    console.error("Nudges cron error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
