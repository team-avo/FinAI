#!/usr/bin/env tsx
/**
 * Seed proactivity fixtures for local testing.
 * Run: npx tsx scripts/seed-proactivity.ts
 *
 * Creates:
 * - 3 sample notifications (info, warn, critical)
 * - 2 pending approval queue items (one expense_record, one receipt_categorize)
 * - 5 AI activity log entries
 * - 1 morning briefing
 */

import { db } from "@/lib/db/client";
import { notifications, approvalQueue, aiActivityLog, aiBriefings, memberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/db/utils";

const ORG_ID = "advertout";

async function run() {
  const members = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.orgId, ORG_ID));

  if (members.length === 0) {
    console.error("No members found for org", ORG_ID);
    process.exit(1);
  }

  const userId = members[0].userId;
  console.log(`Seeding for userId=${userId}, orgId=${ORG_ID}`);

  // Notifications
  await db.insert(notifications).values([
    {
      id: createId(),
      userId,
      orgId: ORG_ID,
      type: "anomaly",
      level: "critical",
      title: "Cloud hosting spend is 3.2× above average",
      body: "AWS costs hit ₹42,500 this month vs ₹13,200 average. Check for runaway instances or unexpected usage spikes.",
    },
    {
      id: createId(),
      userId,
      orgId: ORG_ID,
      type: "approval_pending",
      level: "warn",
      title: "₹18,500 expense from Swiggy awaiting review",
      body: "WhatsApp receipt scan detected a large food expense. Tap to approve or reject.",
    },
    {
      id: createId(),
      userId,
      orgId: ORG_ID,
      type: "briefing",
      level: "info",
      title: "Morning briefing — 11 May 2026",
      body: "Revenue is tracking 12% above last month. 2 overdue invoices need follow-up.",
    },
  ]).onConflictDoNothing();

  // Approval queue
  await db.insert(approvalQueue).values([
    {
      id: createId(),
      orgId: ORG_ID,
      type: "expense_record",
      payload: {
        date: "2026-05-10",
        vendorName: "Swiggy for Business",
        categoryDescription: "food",
        amount: 15678,
        cgst: 1415,
        sgst: 1415,
        igst: 0,
        totalAmount: 18508,
        notes: "Team lunch — client meeting",
      },
      confidence: 82,
      sourceChannel: "whatsapp",
      status: "pending",
    },
    {
      id: createId(),
      orgId: ORG_ID,
      type: "receipt_categorize",
      payload: {
        date: "2026-05-09",
        vendorName: "Unknown",
        rawText: "Bill from vendor: ₹6,200. No GST number.",
        suggestedCategory: "miscellaneous",
      },
      confidence: 55,
      sourceChannel: "whatsapp",
      status: "pending",
    },
  ]).onConflictDoNothing();

  // AI activity log
  await db.insert(aiActivityLog).values([
    { id: createId(), orgId: ORG_ID, actor: "ai_web", action: "tool:createInvoice", entityType: "invoice", entityRef: "INV-0012", input: { contactName: "Zomato Media", lineCount: 2 }, output: { invoiceId: "inv_abc", total: 88500 }, success: true },
    { id: createId(), orgId: ORG_ID, actor: "ai_whatsapp", action: "tool:recordExpense:queued", entityType: "approval", entityRef: "appr_xyz", input: { vendorName: "Swiggy", amount: 15678 }, output: { approvalId: "appr_xyz" }, success: true },
    { id: createId(), orgId: ORG_ID, actor: "cron", action: "anomaly:detected", entityType: "anomaly", entityRef: "May 2026", input: { month: "May 2026" }, output: { anomaliesFound: 1 }, success: true, latencyMs: 3420 },
    { id: createId(), orgId: ORG_ID, actor: "ai_web", action: "tool:getThisMonthPnL", entityType: "report", input: {}, output: { revenue: "₹2,40,000", expenses: "₹1,12,000", netProfit: "₹1,28,000" }, success: true },
    { id: createId(), orgId: ORG_ID, actor: "cron", action: "briefing:morning", input: { date: "2026-05-11" }, output: { headline: "Revenue tracking 12% above last month" }, success: true, latencyMs: 4100 },
  ]).onConflictDoNothing();

  // Morning briefing
  await db.insert(aiBriefings).values({
    id: createId(),
    orgId: ORG_ID,
    userId,
    type: "morning",
    content: {
      greeting: "Good morning! Here's your financial snapshot for 11 May 2026.",
      headline: "Revenue is ₹2,40,000 MTD — tracking 12% ahead of April.",
      topConcerns: [
        "Cloud hosting spend is 3× above average (₹42,500 this month)",
        "2 invoices overdue — INV-0008 (₹35,000) and INV-0011 (₹22,000)",
      ],
      suggestedActions: [
        "Review AWS usage and check for unexpected EC2 instances",
        "Send payment reminders for INV-0008 and INV-0011",
        "Approve or reject the ₹18,500 Swiggy expense in Approvals",
      ],
      cashPosition: "Estimated bank balance: ₹4,85,000 based on last sync.",
    },
  }).onConflictDoNothing();

  console.log("✓ Proactivity fixtures seeded successfully");
}

run().catch((e) => { console.error(e); process.exit(1); });
