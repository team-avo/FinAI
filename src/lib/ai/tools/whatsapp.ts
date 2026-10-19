import { agentTools, buildRecordExpense } from "./index";

/**
 * WhatsApp uses the same tools as web chat, but expense capture is tagged as
 * the "whatsapp" channel on the approval queue. The routing policy (amounts
 * ≥ ₹5,000 or low-confidence captures go to human review) lives in
 * buildRecordExpense and now applies on both channels.
 */
export const agentToolsWhatsApp = {
  ...agentTools,
  recordExpense: buildRecordExpense("whatsapp"),
};
