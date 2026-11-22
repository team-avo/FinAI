/**
 * Pure helpers for the WhatsApp invoice flow — the sender allow-list and the
 * YES/NO decision parser. Kept free of DB/IO imports so the gate that stops an
 * arbitrary number from billing a client can be unit-tested in isolation.
 */

/** Keep only digits so "+91 98…" and "9198…" compare equal. */
export function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

/**
 * Allow-list of WhatsApp numbers permitted to create and approve invoices,
 * from WHATSAPP_INVOICE_SENDERS (comma-separated). Empty / unset means no one
 * can invoice by chat — a safe default, so a stray inbound message can never
 * bill a client.
 */
export function isInvoiceSender(from: string): boolean {
  const raw = process.env.WHATSAPP_INVOICE_SENDERS ?? "";
  const allow = raw
    .split(",")
    .map((s) => normalizePhone(s))
    .filter(Boolean);
  const sender = normalizePhone(from);
  return sender.length > 0 && allow.includes(sender);
}

/** Does this text read as an approve / reject decision? (for the YES/NO path) */
export function parseDecisionText(text: string): "approve" | "reject" | null {
  const t = text.trim().toLowerCase();
  if (["yes", "y", "approve", "approved", "ok", "okay", "send", "confirm"].includes(t)) {
    return "approve";
  }
  if (["no", "n", "reject", "rejected", "cancel", "decline"].includes(t)) {
    return "reject";
  }
  return null;
}
