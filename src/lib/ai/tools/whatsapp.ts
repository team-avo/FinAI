import { buildAgentTools, buildRecordExpense } from "./index";

/**
 * WhatsApp uses the same tools as web chat, but expense capture is tagged as
 * the "whatsapp" channel on the approval queue. The routing policy (amounts
 * ≥ ₹5,000 or low-confidence captures go to human review) lives in
 * buildRecordExpense and applies on both channels. Built per-org like the web
 * tools (the webhook passes the resolved org).
 */
export function buildAgentToolsWhatsApp(orgId: string) {
  return {
    ...buildAgentTools(orgId),
    recordExpense: buildRecordExpense("whatsapp", orgId),
  };
}
