import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { gstr2bEntries, memberships, notifications } from "@/lib/db/schema";
import { createNotification } from "@/lib/trpc/routers/notifications";
import { getOutstandingReceivables } from "@/lib/accounting/reports/outstanding";
import { reconcileItc } from "@/lib/accounting/reports/itc-recon";
import { formatINR } from "@/lib/utils";

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Proactive nudges: time- and data-driven reminders that protect money —
 * GST filing deadlines, the 30-November ITC cliff, and overdue receivables.
 *
 * computeNudges() is pure (date + data in, nudges out) so it's easy to test.
 * runNudges() writes them as in-app notifications, deduped by a period key so
 * a daily cron never spams the same reminder twice.
 *
 * (WhatsApp delivery of these — as utility templates — is deferred until the
 * business number is onboarded and the owner's handle is stored; the in-app
 * notification is the channel today.)
 */

export interface Nudge {
  key: string; // dedupe key, stored as the notification's entityRef
  level: "info" | "warn" | "critical";
  title: string;
  body: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dueLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "today";
  return `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
}

export async function computeNudges(orgId: string, now: Date = new Date()): Promise<Nudge[]> {
  const nudges: Nudge[] = [];
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  const day = now.getDate();
  const ym = `${y}-${String(m + 1).padStart(2, "0")}`;
  const prevMonthName = MONTHS[(m + 11) % 12]; // the month the return covers

  // GSTR-1 (outward/sales) is due on the 11th — nudge from the 6th.
  if (day >= 6 && day <= 11) {
    const left = 11 - day;
    nudges.push({
      key: `gstr1:${ym}`,
      level: left <= 1 ? "critical" : "warn",
      title: `GSTR-1 due ${dueLabel(left)}`,
      body: `Your GSTR-1 (sales return) for ${prevMonthName} is due on the 11th. Filing on time keeps your buyers' input credit flowing.`,
    });
  }

  // GSTR-3B (summary + tax payment) is due on the 20th — nudge from the 15th.
  if (day >= 15 && day <= 20) {
    const left = 20 - day;
    nudges.push({
      key: `gstr3b:${ym}`,
      level: left <= 2 ? "critical" : "warn",
      title: `GSTR-3B due ${dueLabel(left)}`,
      body: `Your GSTR-3B for ${prevMonthName} is due on the 20th. Late filing adds about ₹50/day and blocks next month's return.`,
    });
  }

  // ITC at risk — data-driven from GSTR-2B reconciliation when a 2B has been
  // uploaded; otherwise the generic 30-November cliff reminder in Oct & Nov.
  let itcHandled = false;
  try {
    const periods = await db
      .selectDistinct({ period: gstr2bEntries.period })
      .from(gstr2bEntries)
      .where(eq(gstr2bEntries.orgId, orgId));
    if (periods.length > 0) {
      let atRisk = 0;
      const suppliers = new Set<string>();
      for (const { period } of periods) {
        const r = await reconcileItc(orgId, period);
        atRisk = round2(atRisk + r.itc.atRisk + r.itc.mismatch);
        for (const l of r.atRiskLines) suppliers.add(l.gstin);
      }
      if (atRisk >= 1) {
        nudges.push({
          key: `itc-at-risk:${ym}`,
          level: atRisk >= 10000 ? "critical" : "warn",
          title: `${formatINR(atRisk)} of input credit is at risk`,
          body: `${suppliers.size} supplier${suppliers.size === 1 ? "" : "s"} haven't reported invoices you've recorded, so that input tax credit is lost after 30 November. Review the GSTR-2B reconciliation and chase them.`,
        });
        itcHandled = true;
      }
    }
  } catch {
    // Reconciliation is best-effort inside nudges; fall through to the reminder.
  }
  if (!itcHandled && (m === 9 || m === 10)) {
    const fy = `FY ${y - 1}-${String(y).slice(2)}`;
    nudges.push({
      key: `itc-cutoff:${y}`,
      level: m === 10 ? "critical" : "warn",
      title: "Claim last year's Input Tax Credit before 30 Nov",
      body: `Input Tax Credit from ${fy} must be claimed by 30 November ${y} — after that it's lost for good. Make sure every purchase bill is recorded.`,
    });
  }

  // Overdue receivables.
  const recv = await getOutstandingReceivables(orgId);
  if (recv.overdueCount > 0) {
    nudges.push({
      key: `overdue:${ym}-${String(day).padStart(2, "0")}`,
      level: "warn",
      title: `${formatINR(recv.totalOverdue)} overdue across ${recv.overdueCount} invoice${recv.overdueCount === 1 ? "" : "s"}`,
      body: `You have ${recv.overdueCount} overdue invoice${recv.overdueCount === 1 ? "" : "s"} worth ${formatINR(recv.totalOverdue)}. A quick nudge to those customers usually gets you paid faster.`,
    });
  }

  return nudges;
}

export interface RunNudgesResult {
  nudges: number;
  created: number;
  skipped: number;
}

export async function runNudges(orgId: string, now: Date = new Date()): Promise<RunNudgesResult> {
  const nudges = await computeNudges(orgId, now);
  const members = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.orgId, orgId));

  let created = 0;
  let skipped = 0;

  for (const n of nudges) {
    for (const mem of members) {
      // Dedupe: one notification per (user, nudge key). The key encodes the
      // period, so re-running the cron doesn't duplicate a live reminder.
      const [existing] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.userId, mem.userId), eq(notifications.entityRef, n.key)))
        .limit(1);
      if (existing) {
        skipped++;
        continue;
      }
      await createNotification({
        userId: mem.userId,
        orgId,
        type: "system",
        level: n.level,
        title: n.title,
        body: n.body,
        entityRef: n.key,
      });
      created++;
    }
  }

  return { nudges: nudges.length, created, skipped };
}
