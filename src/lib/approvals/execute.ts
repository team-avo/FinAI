import { z } from "zod";
import { postExpenseRecord } from "@/lib/ai/tools";
import type { approvalQueue } from "@/lib/db/schema";
import { getFreshConnection } from "@/lib/zoho/auth";
import { emailZohoInvoice, voidZohoInvoice } from "@/lib/zoho/invoices";

type ApprovalRow = typeof approvalQueue.$inferSelect;

// Shape of an "expense_record" approval payload (mirrors the recordExpense tool
// input; validated before we post so a malformed row can't corrupt the ledger).
const expensePayloadSchema = z.object({
  date: z.string().optional(),
  vendorName: z.string().optional(),
  categoryDescription: z.string(),
  amount: z.number().positive(),
  cgst: z.number().min(0),
  sgst: z.number().min(0),
  igst: z.number().min(0),
  vendorGstin: z.string().optional(),
  vendorInvoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  notes: z.string().optional(),
});

// Shape of an "invoice_send" approval payload (written by the draftZohoInvoice
// tool). The invoice already exists as a DRAFT in Zoho; approving emails it.
const invoiceSendPayloadSchema = z.object({
  zohoConnectionId: z.string(),
  zohoInvoiceId: z.string(),
  invoiceNumber: z.string(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().nullable().optional(),
  total: z.union([z.number(), z.string()]).nullable().optional(),
  whatsappTo: z.string().nullable().optional(),
});

export type InvoiceSendPayload = z.infer<typeof invoiceSendPayloadSchema>;

/** Parse an invoice_send payload, or throw if the row isn't one / is malformed. */
export function parseInvoiceSendPayload(row: ApprovalRow): InvoiceSendPayload {
  return invoiceSendPayloadSchema.parse(row.payload);
}

/**
 * Execute a queued action for real. Returns the posting result (or null when
 * the approval type has no executor). Shared by the web Approvals tab and the
 * WhatsApp approval resolver so both channels act identically.
 *
 * NOTE: recordExpense posts into the approval's own org.
 */
export async function executeApproval(row: ApprovalRow): Promise<unknown> {
  if (row.type === "expense_record") {
    const parsed = expensePayloadSchema.parse(row.payload);
    // Post-only primitive (no routing) so approving never re-queues the item.
    return postExpenseRecord(parsed, row.orgId);
  }

  if (row.type === "invoice_send") {
    // The draft already exists in Zoho; emailing it attaches the PDF and marks
    // it sent. Recipient falls back to the contact's stored email in Zoho.
    const p = invoiceSendPayloadSchema.parse(row.payload);
    const conn = await getFreshConnection(p.zohoConnectionId);
    await emailZohoInvoice(
      conn,
      p.zohoInvoiceId,
      p.customerEmail ? { toMailIds: [p.customerEmail] } : {},
    );
    return { zohoInvoiceId: p.zohoInvoiceId, invoiceNumber: p.invoiceNumber, emailed: true };
  }

  // Other approval types are not auto-executed yet; approving records the decision.
  return null;
}

/**
 * Reject-side cleanup for an invoice_send approval: void the Zoho draft so
 * rejected invoices don't linger in the ledger. Best-effort — callers log and
 * continue if it fails (a stray void-able draft is non-critical). No-op for
 * other approval types.
 */
export async function voidApprovalInvoice(row: ApprovalRow): Promise<void> {
  if (row.type !== "invoice_send") return;
  const p = invoiceSendPayloadSchema.parse(row.payload);
  const conn = await getFreshConnection(p.zohoConnectionId);
  await voidZohoInvoice(conn, p.zohoInvoiceId);
}
