import { and, desc, eq } from "drizzle-orm";
import {
  executeApproval,
  parseInvoiceSendPayload,
  voidApprovalInvoice,
} from "@/lib/approvals/execute";
import { db } from "@/lib/db/client";
import { approvalQueue } from "@/lib/db/schema";
import { logActivity } from "@/lib/trpc/routers/activity";
import { normalizePhone } from "./invoice-sender";

// Re-exported so the webhook can import the allow-list + decision parser from
// one place; the pure implementations live in ./invoice-sender (IO-free, tested).
export { isInvoiceSender, parseDecisionText } from "./invoice-sender";

// Phase-1 capture org (hard-coded alongside the webhook until ORG_ID is lifted).
const ORG_ID = "advertout";

/** Atomically claim a pending row for a terminal status; null if already handled. */
async function claim(approvalId: string, status: "approved" | "rejected") {
  const [claimed] = await db
    .update(approvalQueue)
    .set({ status, reviewedAt: new Date() })
    .where(
      and(
        eq(approvalQueue.id, approvalId),
        eq(approvalQueue.orgId, ORG_ID),
        eq(approvalQueue.status, "pending"),
      ),
    )
    .returning();
  return claimed ?? null;
}

async function approve(row: typeof approvalQueue.$inferSelect): Promise<string> {
  const p = parseInvoiceSendPayload(row);

  // Claim first so a double-tap can't email twice; roll back if the send fails.
  const claimed = await claim(row.id, "approved");
  if (!claimed) return `Invoice ${p.invoiceNumber} was already handled.`;

  try {
    await executeApproval(claimed);
  } catch (err) {
    await db
      .update(approvalQueue)
      .set({ status: "pending", reviewedAt: null })
      .where(eq(approvalQueue.id, row.id));
    logActivity({
      orgId: ORG_ID,
      actor: "ai_whatsapp",
      action: "approval:post_failed",
      entityType: "approval",
      entityRef: row.id,
      output: { error: err instanceof Error ? err.message : String(err) },
      success: false,
    }).catch(() => {});
    return "I couldn't email the invoice just now — please try tapping Approve again in a moment.";
  }

  logActivity({
    orgId: ORG_ID,
    actor: "ai_whatsapp",
    action: "approval:approved",
    entityType: "approval",
    entityRef: row.id,
    output: { zohoInvoiceId: p.zohoInvoiceId, invoiceNumber: p.invoiceNumber },
  }).catch(() => {});

  const who = p.customerName ? ` to ${p.customerName}` : "";
  return `✅ Sent ${p.invoiceNumber}${who} and marked it sent in Zoho.`;
}

async function reject(row: typeof approvalQueue.$inferSelect): Promise<string> {
  const p = parseInvoiceSendPayload(row);

  const claimed = await claim(row.id, "rejected");
  if (!claimed) return `Invoice ${p.invoiceNumber} was already handled.`;

  // Void the draft (best-effort — the rejection stands regardless).
  await voidApprovalInvoice(claimed).catch((err) => {
    logActivity({
      orgId: ORG_ID,
      actor: "ai_whatsapp",
      action: "approval:void_failed",
      entityType: "approval",
      entityRef: row.id,
      output: { error: err instanceof Error ? err.message : String(err) },
      success: false,
    }).catch(() => {});
  });

  logActivity({
    orgId: ORG_ID,
    actor: "ai_whatsapp",
    action: "approval:rejected",
    entityType: "approval",
    entityRef: row.id,
    output: { zohoInvoiceId: p.zohoInvoiceId, invoiceNumber: p.invoiceNumber },
    success: false,
  }).catch(() => {});

  return `❌ Cancelled ${p.invoiceNumber}. The draft has been voided in Zoho.`;
}

/** Load a pending invoice_send row, enforcing it was sent to this number. */
async function loadForSender(
  approvalId: string,
  from: string,
): Promise<typeof approvalQueue.$inferSelect | { error: string }> {
  const [row] = await db
    .select()
    .from(approvalQueue)
    .where(and(eq(approvalQueue.id, approvalId), eq(approvalQueue.orgId, ORG_ID)));

  if (!row || row.type !== "invoice_send") {
    return { error: "That invoice request is no longer available." };
  }

  // Only the number the draft was sent to may action it.
  try {
    const p = parseInvoiceSendPayload(row);
    if (p.whatsappTo && normalizePhone(p.whatsappTo) !== normalizePhone(from)) {
      return { error: "This invoice was sent to someone else for approval." };
    }
  } catch {
    return { error: "That invoice request looks malformed — please create it again." };
  }

  return row;
}

/**
 * Resolve an approval from a tapped button id (`inv_approve:<id>` /
 * `inv_reject:<id>`). Returns the reply text to send back on WhatsApp.
 */
export async function resolveInvoiceApprovalById(args: {
  approvalId: string;
  action: "approve" | "reject";
  from: string;
}): Promise<string> {
  const loaded = await loadForSender(args.approvalId, args.from);
  if ("error" in loaded) return loaded.error;
  return args.action === "approve" ? approve(loaded) : reject(loaded);
}

/**
 * YES/NO text fallback: resolve the sender's most recent pending invoice.
 * Returns the reply text, or null when there's nothing pending (so the caller
 * lets the message fall through to the normal agent).
 */
export async function resolvePendingInvoiceByText(args: {
  from: string;
  action: "approve" | "reject";
}): Promise<string | null> {
  const rows = await db
    .select()
    .from(approvalQueue)
    .where(
      and(
        eq(approvalQueue.orgId, ORG_ID),
        eq(approvalQueue.type, "invoice_send"),
        eq(approvalQueue.status, "pending"),
      ),
    )
    .orderBy(desc(approvalQueue.createdAt))
    .limit(10);

  const fromDigits = normalizePhone(args.from);
  const mine = rows.find((r) => {
    try {
      const p = parseInvoiceSendPayload(r);
      return p.whatsappTo != null && normalizePhone(p.whatsappTo) === fromDigits;
    } catch {
      return false;
    }
  });

  if (!mine) return null; // nothing pending for this sender — fall through to agent
  return args.action === "approve" ? approve(mine) : reject(mine);
}
