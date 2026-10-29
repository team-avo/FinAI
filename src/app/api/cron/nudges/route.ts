import { NextRequest, NextResponse } from "next/server";
import { runNudges } from "@/lib/ai/nudges";
import { logActivity } from "@/lib/trpc/routers/activity";
import { getActiveOrgIds } from "@/lib/db/active-orgs";

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
    return NextResponse.json({ status: "ok", orgs: orgIds.length, results });
  } catch (error) {
    console.error("Nudges cron error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
