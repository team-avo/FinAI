import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { db } from "@/lib/db/client";
import { expenses, chartOfAccounts, memberships } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { subMonths, startOfMonth, format } from "date-fns";
import { createNotification } from "@/lib/trpc/routers/notifications";
import { logActivity } from "@/lib/trpc/routers/activity";
import { getActiveOrgs } from "@/lib/db/active-orgs";

export const runtime = "nodejs";
export const maxDuration = 120;

async function scanOrg(orgId: string, orgName: string, now: Date) {
  const cronStart = Date.now();
  const currentMonthStart = startOfMonth(now);
  const threeMonthsAgo = subMonths(now, 3);

  const currentExpenses = await db
    .select({
      accountId: expenses.accountId,
      accountName: chartOfAccounts.name,
      total: sql<string>`COALESCE(SUM(total_amount::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expenses)
    .leftJoin(chartOfAccounts, eq(expenses.accountId, chartOfAccounts.id))
    .where(and(eq(expenses.orgId, orgId), gte(expenses.date, currentMonthStart)))
    .groupBy(expenses.accountId, chartOfAccounts.name);

  const historicalExpenses = await db
    .select({
      accountId: expenses.accountId,
      monthlyAvg: sql<string>`COALESCE(SUM(total_amount::numeric) / 3.0, 0)`,
    })
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), gte(expenses.date, threeMonthsAgo)))
    .groupBy(expenses.accountId);

  const avgMap = new Map(historicalExpenses.map((h) => [h.accountId, parseFloat(h.monthlyAvg)]));

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
        category: e.accountName ?? "Uncategorized",
        currentMonth: current,
        threeMonthAvg: Math.round(avg),
        multiplier: (current / avg).toFixed(1),
        excess: Math.round(current - avg),
      };
    });

  if (anomalies.length === 0) {
    await logActivity({
      orgId,
      actor: "cron",
      action: "anomaly:scan",
      input: { month: format(now, "MMMM yyyy") },
      output: { anomaliesFound: 0 },
      latencyMs: Date.now() - cronStart,
    }).catch(() => {});
    return { orgId, anomalies: 0 };
  }

  const anomalyText = anomalies
    .map(
      (a) =>
        `- ${a.category}: ₹${a.currentMonth.toLocaleString("en-IN")} this month vs ₹${a.threeMonthAvg.toLocaleString("en-IN")} average (${a.multiplier}× normal, ₹${a.excess.toLocaleString("en-IN")} above average)`,
    )
    .join("\n");

  const { text: insight } = await generateText({
    model: groq("openai/gpt-oss-120b"),
    system: `You are FinAI, an AI accounting assistant for ${orgName}, a business in India.
Today is ${format(now, "dd MMMM yyyy")}.
Be concise, professional, and actionable. Format numbers in Indian system (₹1,00,000). Max 3 sentences per anomaly.`,
    prompt: `Spending anomalies detected for ${format(now, "MMMM yyyy")} vs 3-month average:

${anomalyText}

Write a brief daily digest message (WhatsApp-friendly, no markdown) highlighting these anomalies and suggesting what to investigate. Keep it under 150 words total.`,
  });

  const members = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.orgId, orgId));

  const level = anomalies.some((a) => parseFloat(a.multiplier) >= 3) ? "critical" : "warn";
  const title = `${anomalies.length} spending anomal${anomalies.length === 1 ? "y" : "ies"} detected — ${format(now, "MMMM yyyy")}`;

  await Promise.all(
    members.map((m) =>
      createNotification({ userId: m.userId, orgId, type: "anomaly", level, title, body: insight }),
    ),
  );

  await logActivity({
    orgId,
    actor: "cron",
    action: "anomaly:detected",
    input: { month: format(now, "MMMM yyyy"), categoriesChecked: currentExpenses.length },
    output: { anomaliesFound: anomalies.length, level, notifiedUsers: members.length },
    latencyMs: Date.now() - cronStart,
  }).catch(() => {});

  return { orgId, anomalies: anomalies.length, level, notifiedUsers: members.length };
}

// Vercel Cron: nightly at 6 AM IST (00:30 UTC), for every active org.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const orgs = await getActiveOrgs();
  const results: unknown[] = [];
  for (const o of orgs) {
    try {
      results.push(await scanOrg(o.id, o.name, now));
    } catch (error) {
      console.error("Anomaly scan error for org", o.id, error);
      results.push({ orgId: o.id, error: true });
    }
  }

  return NextResponse.json({ status: "ok", orgs: orgs.length, results, checkedAt: now.toISOString() });
}
