import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { format, startOfMonth, subMonths } from "date-fns";
import { getPnLReport } from "@/lib/accounting/reports/pnl";
import { getOutstandingReceivables } from "@/lib/accounting/reports/outstanding";
import { saveBriefing } from "@/lib/trpc/routers/briefings";
import { logActivity } from "@/lib/trpc/routers/activity";

export const runtime = "nodejs";
export const maxDuration = 60;

const ORG_ID = "advertout";

// Vercel Cron: runs at 3:30 AM IST (22:00 UTC previous day)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronStart = Date.now();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = new Date(monthStart.getTime() - 1);

  const [currentPnL, prevPnL, receivables] = await Promise.all([
    getPnLReport(ORG_ID, monthStart, now),
    getPnLReport(ORG_ID, prevMonthStart, prevMonthEnd),
    getOutstandingReceivables(ORG_ID),
  ]);

  const revenueGrowth =
    prevPnL.totalRevenue > 0
      ? (((currentPnL.totalRevenue - prevPnL.totalRevenue) / prevPnL.totalRevenue) * 100).toFixed(1)
      : null;

  const briefingSchema = z.object({
    greeting: z.string().describe("A warm, short good-morning opener (1 sentence)"),
    headline: z.string().describe("The single most important financial fact today (1 sentence)"),
    topConcerns: z.array(z.string()).max(3).describe("Up to 3 things requiring attention"),
    suggestedActions: z.array(z.string()).max(3).describe("Up to 3 concrete recommended actions"),
    cashPosition: z.string().optional().describe("Brief cash/liquidity note if relevant"),
  });

  const contextText = `
Today: ${format(now, "EEEE, dd MMMM yyyy")}
MTD Revenue: ₹${currentPnL.totalRevenue.toLocaleString("en-IN")}
MTD Expenses: ₹${currentPnL.totalExpenses.toLocaleString("en-IN")}
MTD Net Profit: ₹${currentPnL.netProfit.toLocaleString("en-IN")}
vs Last Month Revenue: ₹${prevPnL.totalRevenue.toLocaleString("en-IN")}${revenueGrowth ? ` (${revenueGrowth}% change)` : ""}
Outstanding Receivables: ₹${receivables.totalOutstanding.toLocaleString("en-IN")} across ${receivables.items.length} invoices
Overdue: ₹${receivables.totalOverdue.toLocaleString("en-IN")} (${receivables.overdueCount} invoices)
`.trim();

  const { object: content } = await generateObject({
    model: groq("llama-3.3-70b-versatile"),
    schema: briefingSchema,
    system: `You are FinAI, the AI accounting assistant for AdvertOut, a digital marketing agency in India.
Generate a concise morning financial briefing. Be direct, professional, and actionable.
Format INR numbers in Indian system (₹X,XX,XXX). No markdown. Keep each item under 20 words.`,
    prompt: `Generate a morning briefing based on this financial context:\n\n${contextText}`,
  });

  // Save briefing for all org members
  const members = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.orgId, ORG_ID));

  await Promise.all(
    members.map((m) =>
      saveBriefing({ orgId: ORG_ID, userId: m.userId, type: "morning", content }),
    ),
  );

  await logActivity({
    orgId: ORG_ID,
    actor: "cron",
    action: "briefing:morning",
    input: { date: format(now, "yyyy-MM-dd"), membersNotified: members.length },
    output: { headline: content.headline },
    latencyMs: Date.now() - cronStart,
  });

  return NextResponse.json({ status: "ok", content, generatedAt: now.toISOString() });
}
