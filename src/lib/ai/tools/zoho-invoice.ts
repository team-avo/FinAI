import { tool } from "ai";
import { z } from "zod";
import { enqueueApproval } from "@/lib/approvals/enqueue";
import { logActivity } from "@/lib/trpc/routers/activity";
import { formatINR } from "@/lib/utils";
import { sendApprovalButtons, sendDocument, uploadMedia } from "@/lib/whatsapp/client";
import { findConnectionForUserOrg } from "@/lib/zoho/auth";
import {
  createZohoDraftInvoice,
  getZohoInvoicePdf,
  resolveZohoCustomer,
} from "@/lib/zoho/invoices";

/**
 * The "create an invoice by chat" tool for the WhatsApp flow.
 *
 * It deliberately only drafts — it never emails the client. The sequence is:
 *   1. resolve the Zoho connection for the org (any teammate's will do),
 *   2. resolve the named customer in Zoho Books (bail out, don't guess, if it's
 *      ambiguous or missing),
 *   3. create a DRAFT invoice in Zoho,
 *   4. queue an `invoice_send` approval (the source of truth — approvable from
 *      the web Approvals tab as well as WhatsApp),
 *   5. push the PDF + Approve/Reject buttons to the sender for sign-off.
 *
 * The actual email-and-mark-sent happens later in the approval resolver, gated
 * on the user tapping Approve. The resolver reads the Zoho invoice id and the
 * recipient off the approval payload; the button id carries the approval id so
 * a tap maps straight back to the right pending invoice.
 */

export const draftZohoInvoiceParams = z.object({
  customerName: z
    .string()
    .describe("The client to bill, exactly as the user named them. Matched against Zoho Books."),
  amount: z
    .number()
    .positive()
    .describe("Line amount in INR. Tax is applied per the customer's Zoho tax settings."),
  description: z
    .string()
    .describe("What the invoice is for, e.g. 'October retainer'. Becomes the line item."),
  date: z.string().optional().describe("Invoice date YYYY-MM-DD. Defaults to today."),
  referenceNumber: z.string().optional().describe("Optional PO / reference number."),
  notes: z.string().optional().describe("Optional note shown on the invoice."),
});

type DraftZohoInvoiceInput = z.infer<typeof draftZohoInvoiceParams>;

export interface ZohoInvoiceToolContext {
  orgId: string;
  /** The sender's WhatsApp number to send the draft + buttons to. */
  whatsappTo?: string;
  /** Resolved app user, if any (WhatsApp senders usually have none). */
  userId?: string;
}

/**
 * Build the draftZohoInvoice tool bound to an org (and, on WhatsApp, the
 * sender's number so the PDF + approval buttons can be delivered back).
 */
export function buildDraftZohoInvoice(ctx: ZohoInvoiceToolContext) {
  return tool({
    description:
      "Create a DRAFT invoice in Zoho Books for a customer and send it to the user on WhatsApp for approval. " +
      "Does NOT email the client — the invoice is only emailed after the user approves it. " +
      "Use when the user asks to invoice/bill a client for an amount.",
    inputSchema: draftZohoInvoiceParams,
    execute: async (input: DraftZohoInvoiceInput) => {
      const conn = await findConnectionForUserOrg(ctx.userId, ctx.orgId);
      if (!conn) {
        return "No Zoho Books connection for this business yet. Connect Zoho in the app (Settings → Integrations) first, then try again.";
      }

      // Resolve the customer — never guess who to bill.
      const { customer, matches } = await resolveZohoCustomer(conn, input.customerName);
      if (!customer) {
        if (matches.length === 0) {
          return `No customer named "${input.customerName}" in Zoho Books. Add them in Zoho first, or check the spelling.`;
        }
        const names = matches
          .slice(0, 5)
          .map((c) => c.contact_name)
          .join(", ");
        return `Found several customers matching "${input.customerName}": ${names}. Which one should I bill? Reply with the exact name.`;
      }

      // 1. Draft it in Zoho (nothing leaves Zoho yet).
      const invoice = await createZohoDraftInvoice(conn, {
        customerId: customer.contact_id,
        lines: [{ name: input.description, rate: input.amount }],
        date: input.date,
        notes: input.notes,
        referenceNumber: input.referenceNumber,
      });

      // 2. Queue the approval. This is the source of truth for the send — it can
      //    be actioned from the web Approvals tab too, not just WhatsApp.
      const approval = await enqueueApproval({
        orgId: ctx.orgId,
        type: "invoice_send",
        sourceChannel: "whatsapp",
        payload: {
          zohoConnectionId: conn.id,
          zohoInvoiceId: invoice.invoice_id,
          invoiceNumber: invoice.invoice_number,
          customerId: customer.contact_id,
          customerName: customer.contact_name,
          customerEmail: customer.email ?? null,
          total: invoice.total,
          whatsappTo: ctx.whatsappTo ?? null,
        },
      });

      logActivity({
        orgId: ctx.orgId,
        actor: "ai_whatsapp",
        action: "tool:draftZohoInvoice",
        entityType: "approval",
        entityRef: approval.id,
        input: { customerName: input.customerName, amount: input.amount },
        output: { zohoInvoiceId: invoice.invoice_id, invoiceNumber: invoice.invoice_number },
      }).catch(() => {});

      const totalLabel = formatINR(invoice.total);
      const toLabel = customer.email ? ` to ${customer.email}` : "";

      // 3. Best-effort: push the PDF + Approve/Reject buttons to the sender.
      //    The draft + approval already persist, so a WhatsApp failure here
      //    still leaves the invoice approvable from the web app.
      if (ctx.whatsappTo) {
        try {
          const pdf = await getZohoInvoicePdf(conn, invoice.invoice_id);
          const filename = `Invoice-${invoice.invoice_number}.pdf`;
          const mediaId = await uploadMedia(pdf, { filename });

          await sendDocument({
            to: ctx.whatsappTo,
            mediaId,
            filename,
            caption: `Draft ${invoice.invoice_number} for ${customer.contact_name} — ${totalLabel}`,
          });

          await sendApprovalButtons({
            to: ctx.whatsappTo,
            body: `Send this invoice to ${customer.contact_name}${toLabel}? Tap Approve to email it, or Reject to cancel.`,
            buttons: [
              { id: `inv_approve:${approval.id}`, title: "Approve & send" },
              { id: `inv_reject:${approval.id}`, title: "Reject" },
            ],
          });

          return `Drafted ${invoice.invoice_number} for ${customer.contact_name} (${totalLabel}) and sent it to you for approval. It won't be emailed until you tap Approve.`;
        } catch (err) {
          logActivity({
            orgId: ctx.orgId,
            actor: "ai_whatsapp",
            action: "tool:draftZohoInvoice:deliveryFailed",
            entityType: "approval",
            entityRef: approval.id,
            output: { error: String(err) },
          }).catch(() => {});

          return `Drafted ${invoice.invoice_number} for ${customer.contact_name} (${totalLabel}), but I couldn't send the PDF preview on WhatsApp just now. You can review and approve it in the app's Approvals tab — it won't be emailed until then.`;
        }
      }

      return `Drafted ${invoice.invoice_number} for ${customer.contact_name} (${totalLabel}). Review and approve it in the app's Approvals tab — it won't be emailed until then.`;
    },
  });
}
