import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { db } from "@/lib/db/client";
import { expenses, chartOfAccounts, memberships } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { createNotification } from "@/lib/trpc/routers/notifications";
import { logActivity } from "@/lib/trpc/routers/activity";

export const runtime = "nodejs";
export const maxDuration = 60;

const ORG_ID = "advertout";

// Vercel Cron: runs nightly at 6 AM IST (00:30 UTC)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronStart = Date.now();
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const threeMonthsAgo = subMonths(now, 3);

  // Get current month expenses by category
  const currentExpenses = await db
    .select({
      accountId: expenses.accountId,
      accountName: chartOfAccounts.name,
      total: sql<string>`COALESCE(SUM(total_amount::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expenses)
    .leftJoin(chartOfAccounts, eq(expenses.accountId, chartOfAccounts.id))
    .where(
      and(
        eq(expenses.orgId, ORG_ID),
        gte(expenses.date, currentMonthStart),
      ),
    )
    .groupBy(expenses.accountId, chartOfAccounts.name);

  // Get 3-month trailing average by category
  const historicalExpenses = await db
    .select({
      accountId: expenses.accountId,
      monthlyAvg: sql<string>`COALESCE(SUM(total_amount::numeric) / 3.0, 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.orgId, ORG_ID),
        gte(expenses.date, threeMonthsAgo),
      ),
    )
    .groupBy(expenses.accountId);

  const avgMap = new Map(historicalExpenses.map((h) => [h.accountId, parseFloat(h.monthlyAvg)]));

  // Find categories that are > 2× their 3-month average
  const anomalies = currentExpenses
    .filter((e) => {
      const current = parseFloat(e.total);
      const avg = avgMap.get(e.accountId ?? "") ?? 0;
      return avg > 0 && current > avg * 2;
    })
    .map((e) => {
      const current = parseFloat(e.total);
      const avg = avgMap.get(e.accountId ?? "") ?? 0;
      return {
        category: e.accountName ?? "Unknown",
        currentMonth: current,
        threeMonthAvg: avg,
        multiplier: avg > 0 ? (current / avg).toFixed(1) : "N/A",
        excess: current - avg,
      };
    });

  if (anomalies.length === 0) {
    await logActivity({
      orgId: ORG_ID,
      actor: "cron",
      action: "anomaly:scan",
      input: { month: format(now, "MMMM yyyy") },
      output: { anomaliesFound: 0 },
      latencyMs: Date.now() - cronStart,
    });

    return NextResponse.json({
      status: "ok",
      message: "No spending anomalies detected",
      checkedAt: now.toISOString(),
    });
  }

  // Use AI to generate a meaningful insight summary
  const anomalyText = anomalies
    .map(
      (a) =>
        `- ${a.category}: ₹${a.currentMonth.toLocaleString("en-IN")} this month vs ₹${a.threeMonthAvg.toLocaleString("en-IN")} average (${a.multiplier}× normal, ₹${a.excess.toLocaleString("en-IN")} above average)`,
    )
    .join("\n");

  const { text: insight } = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    system: `You are FinAI, an AI accounting assistant for AdvertOut, a digital marketing agency in India.
Today is ${format(now, "dd MMMM yyyy")}.
Be concise, professional, and actionable. Format numbers in Indian system (₹1,00,000). Max 3 sentences per anomaly.`,
    prompt: `Spending anomalies detected for ${format(now, "MMMM yyyy")} vs 3-month average:

${anomalyText}

Write a brief daily digest message (WhatsApp-friendly, no markdown) highlighting these anomalies and suggesting what to investigate. Keep it under 150 words total.`,
  });

  // Notify all org members
  const members = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.orgId, ORG_ID));

  const level = anomalies.some((a) => parseFloat(a.multiplier) >= 3) ? "critical" : "warn";
  const title = `${anomalies.length} spending anomal${anomalies.length === 1 ? "y" : "ies"} detected — ${format(now, "MMMM yyyy")}`;

  await Promise.all(
    members.map((m) =>
      createNotification({
        userId: m.userId,
        orgId: ORG_ID,
        type: "anomaly",
        level,
        title,
        body: insight,
      }),
    ),
  );

  await logActivity({
    orgId: ORG_ID,
    actor: "cron",
    action: "anomaly:detected",
    input: { month: format(now, "MMMM yyyy"), categoriesChecked: currentExpenses.length },
    output: { anomaliesFound: anomalies.length, level, notifiedUsers: members.length },
    latencyMs: Date.now() - cronStart,
  });

  return NextResponse.json({
    status: "ok",
    anomalies,
    insight,
    notifiedUsers: members.length,
    month: format(now, "MMMM yyyy"),
    checkedAt: now.toISOString(),
  });
}
