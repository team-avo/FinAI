import { buildAgentTools, buildRecordExpense } from "./index";
import { buildDraftZohoInvoice } from "./zoho-invoice";

/** Per-message WhatsApp context threaded through to channel-aware tools. */
export interface WhatsAppToolContext {
  /** The sender's WhatsApp number — where drafts + approval buttons are sent. */
  whatsappTo?: string;
  /** Resolved app user, if the sender maps to one. */
  userId?: string;
}

/**
 * WhatsApp uses the same tools as web chat, plus Zoho invoicing, with expense
 * capture tagged as the "whatsapp" channel on the approval queue. The routing
 * policy (amounts ≥ ₹5,000 or low-confidence captures go to human review) lives
 * in buildRecordExpense and applies on both channels. Built per-org like the
 * web tools; the webhook also passes the sender's number so draftZohoInvoice
 * can deliver the PDF + Approve/Reject buttons back.
 */
export function buildAgentToolsWhatsApp(orgId: string, ctx: WhatsAppToolContext = {}) {
  return {
    ...buildAgentTools(orgId),
    recordExpense: buildRecordExpense("whatsapp", orgId),
    draftZohoInvoice: buildDraftZohoInvoice({
      orgId,
      whatsappTo: ctx.whatsappTo,
      userId: ctx.userId,
    }),
  };
}
