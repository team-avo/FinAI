import { NextRequest, NextResponse } from "next/server";
import { runNudges } from "@/lib/ai/nudges";
import { logActivity } from "@/lib/trpc/routers/activity";

export const runtime = "nodejs";
export const maxDuration = 30;

const ORG_ID = "advertout";

// Vercel Cron: once a day. Creates in-app notifications for GST deadlines,
// the 30-Nov ITC cliff, and overdue receivables (deduped by period).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runNudges(ORG_ID);
    await logActivity({
      orgId: ORG_ID,
      actor: "cron",
      action: "cron:nudges",
      entityType: "notification",
      output: result,
    }).catch(() => {});
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error("Nudges cron error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
