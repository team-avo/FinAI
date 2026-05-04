import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db/client";
import { expenses, chartOfAccounts } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";

export const runtime = "nodejs";
export const maxDuration = 60;

const ORG_ID = "advertout";

// Vercel Cron: runs nightly at 6 AM IST (00:30 UTC)
// Add to vercel.json: { "crons": [{ "path": "/api/cron/anomaly", "schedule": "30 0 * * *" }] }

export async function GET(req: NextRequest) {
  // Validate cron secret (set CRON_SECRET in env)
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
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
      // Only flag if average > 0 and current is > 2× average
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
    return NextResponse.json({
      status: "ok",
      message: "No spending anomalies detected",
      checkedAt: now.toISOString(),
    });
  }

  // Use Opus to generate a meaningful insight summary
  const anomalyText = anomalies
    .map(
      (a) =>
        `- ${a.category}: ₹${a.currentMonth.toLocaleString("en-IN")} this month vs ₹${a.threeMonthAvg.toLocaleString("en-IN")} average (${a.multiplier}× normal, ₹${a.excess.toLocaleString("en-IN")} above average)`,
    )
    .join("\n");

  const { text: insight } = await generateText({
    model: anthropic("claude-opus-4-5-20251101"),
    system: `You are FinAI, an AI accounting assistant for AdvertOut, a digital marketing agency in India.
Today is ${format(now, "dd MMMM yyyy")}.
Be concise, professional, and actionable. Format numbers in Indian system (₹1,00,000). Max 3 sentences per anomaly.`,
    prompt: `Spending anomalies detected for ${format(now, "MMMM yyyy")} vs 3-month average:

${anomalyText}

Write a brief daily digest message (WhatsApp-friendly, no markdown) highlighting these anomalies and suggesting what to investigate. Keep it under 150 words total.`,
  });

  return NextResponse.json({
    status: "ok",
    anomalies,
    insight,
    month: format(now, "MMMM yyyy"),
    checkedAt: now.toISOString(),
  });
}
