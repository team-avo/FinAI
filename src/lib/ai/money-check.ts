import { getOutstandingReceivables } from "@/lib/accounting/reports/outstanding";
import { computeSupplierTrust } from "@/lib/accounting/reports/supplier-trust";
import { formatINR } from "@/lib/utils";

/**
 * The "Monday money check" — the autonomous-agent message, assembled from the
 * business's real data. It covers the three money jobs: PROTECT (input credit
 * before the 30-Nov cutoff), CHASE (overdue receivables), and — once the rails
 * are connected — UNLOCK (credit) and the 45-day payables clock.
 *
 * Items marked `live: false` are the parts that need data we don't have yet
 * (a bank feed via Account Aggregator, vendor payment due-dates, a lending
 * partner). They're shown as "coming" so the agent's full shape is visible
 * without over-claiming.
 */

export type MoneyTone = "positive" | "warn" | "critical" | "info" | "muted";

export interface MoneyAction {
  label: string;
  href?: string; // in-app navigation
  copy?: string; // text to copy to clipboard (e.g. reminders)
  soon?: boolean; // not wired yet
}

export interface MoneyItem {
  icon: string; // emoji
  kind: string;
  title: string;
  detail: string;
  tone: MoneyTone;
  live: boolean;
  list?: { label: string; value: string }[];
  action?: MoneyAction;
}

export interface MoneyCheck {
  dateLabel: string;
  headline: string;
  items: MoneyItem[];
}

function daysUntil(target: Date, now: Date) {
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Next GSTR-3B due date: the 20th of this month if still ahead, else next month. */
function nextGstr3bDue(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), 20);
  if (d < now) d.setMonth(d.getMonth() + 1);
  return d;
}

/** 30 November of the financial year whose ITC window is still open. */
function itcCutoff(now: Date): Date {
  const y = now.getMonth() >= 11 ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(y, 10, 30); // 30 Nov (month index 10)
}

export async function computeMoneyCheck(orgId: string, now: Date = new Date()): Promise<MoneyCheck> {
  const [recv, trust] = await Promise.all([
    getOutstandingReceivables(orgId),
    computeSupplierTrust(orgId),
  ]);

  const items: MoneyItem[] = [];

  // 1 · Cash outlook (what's coming in) — real receivables.
  items.push({
    icon: "💰",
    kind: "cash",
    title: recv.totalOutstanding > 0 ? `${formatINR(recv.totalOutstanding)} is owed to you` : "No money outstanding",
    detail:
      recv.totalOutstanding > 0
        ? `Across ${recv.items.length} open invoice${recv.items.length === 1 ? "" : "s"} — your incoming cash this cycle.`
        : "Every invoice you've sent is paid. Nice.",
    tone: recv.totalOutstanding > 0 ? "info" : "positive",
    live: true,
    action: recv.items.length > 0 ? { label: "View invoices", href: "/invoices" } : undefined,
  });

  // 2 · Forward cash forecast — needs a bank feed (coming).
  items.push({
    icon: "📉",
    kind: "forecast",
    title: "See the day you'll run short",
    detail: "Connect your bank over Account Aggregator and the agent will predict a cash dip before it happens.",
    tone: "muted",
    live: false,
    action: { label: "Connect bank", soon: true },
  });

  // 3 · Chase overdue receivables — real.
  if (recv.overdueCount > 0) {
    const late = recv.items
      .filter((i) => i.daysOverdue > 0)
      .sort((a, b) => b.amountDue - a.amountDue)
      .slice(0, 3);
    const reminders = late
      .map(
        (i) =>
          `Hi ${i.contactName}, invoice ${i.number} for ${formatINR(i.amountDue)} was due ${i.daysOverdue} day${i.daysOverdue === 1 ? "" : "s"} ago. A quick payment would be much appreciated — thank you!`,
      )
      .join("\n\n");
    items.push({
      icon: "⏳",
      kind: "receivables",
      title: `${formatINR(recv.totalOverdue)} overdue — chase ${recv.overdueCount} late payer${recv.overdueCount === 1 ? "" : "s"}`,
      detail: "These customers are past due. A nudge usually gets you paid faster.",
      tone: "warn",
      live: true,
      list: late.map((i) => ({ label: i.contactName, value: `${formatINR(i.amountDue)} · ${i.daysOverdue}d late` })),
      action: { label: "Copy reminders", copy: reminders },
    });
  }

  // 4 · ITC at risk — real, from the Trust Graph.
  if (trust.totals.itcAtRisk > 0) {
    const cutoff = itcCutoff(now);
    const left = daysUntil(cutoff, now);
    const risky = trust.suppliers
      .filter((s) => s.itcAtRisk > 0)
      .slice(0, 3)
      .map((s) => ({ label: s.name || s.gstin, value: formatINR(s.itcAtRisk) }));
    items.push({
      icon: "🔺",
      kind: "itc",
      title: `${formatINR(trust.totals.itcAtRisk)} of input credit at risk`,
      detail: `${trust.totals.risky} supplier${trust.totals.risky === 1 ? "" : "s"} haven't filed — claim before 30 Nov (${left} day${left === 1 ? "" : "s"} left).`,
      tone: "critical",
      live: true,
      list: risky,
      action: { label: "See suppliers", href: "/suppliers" },
    });
  } else if (trust.totals.suppliers > 0) {
    items.push({
      icon: "✅",
      kind: "itc",
      title: "Your input credit is safe",
      detail: "Every reconciled purchase is filed by its supplier. Nothing at risk.",
      tone: "positive",
      live: true,
    });
  }

  // 5 · Next GST deadline — real date math.
  {
    const due = nextGstr3bDue(now);
    const left = daysUntil(due, now);
    items.push({
      icon: "⏰",
      kind: "gst",
      title: `GSTR-3B due in ${left} day${left === 1 ? "" : "s"}`,
      detail: `Your summary return is due on the 20th. Late filing adds about ₹50/day and blocks next month's return.`,
      tone: left <= 5 ? "warn" : "info",
      live: true,
      action: { label: "Open GST Credit", href: "/reconciliation" },
    });
  }

  // 6 · The 45-day vendor-payment rule — needs payment data (coming).
  items.push({
    icon: "⚠️",
    kind: "payables",
    title: "Pay vendors before the 45-day deadline",
    detail: "Miss the 45-day window on a micro/small vendor and you lose the tax deduction. Unlocks when we track your payments.",
    tone: "muted",
    live: false,
    action: { label: "Enable payments", soon: true },
  });

  // 7 · Working capital — needs a lending partner (coming).
  items.push({
    icon: "💸",
    kind: "credit",
    title: "Pre-approved working capital",
    detail: "Draw cash in a tap when you're about to dip — underwritten on your books, via a lending partner.",
    tone: "muted",
    live: false,
    action: { label: "Join waitlist", soon: true },
  });

  const liveCount = items.filter((i) => i.live && (i.tone === "warn" || i.tone === "critical")).length;
  const headline =
    liveCount > 0
      ? `${liveCount} thing${liveCount === 1 ? "" : "s"} need your attention this week.`
      : "You're in good shape this week — here's your money at a glance.";

  return {
    dateLabel: now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }),
    headline,
    items,
  };
}
