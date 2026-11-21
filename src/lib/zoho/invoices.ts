import type { ZohoConnection } from "@/lib/db/schema";
import { zohoFetch, zohoFetchBinary } from "./client";
import type { ZohoContact, ZohoInvoice } from "./types";

/**
 * Zoho Books invoice operations for the WhatsApp "invoice-by-chat" workflow.
 *
 * The flow (see research_notes/finai-whatsapp-invoice-spec.md):
 *   1. searchZohoCustomers — resolve the client the user named.
 *   2. createZohoDraftInvoice — create it as a DRAFT (nothing leaves Zoho yet).
 *   3. getZohoInvoicePdf — bytes to send to the user on WhatsApp for approval.
 *   4. emailZohoInvoice — on approval, Zoho emails the client and marks it sent.
 *   5. voidZohoInvoice — on rejection, void the draft so none pile up.
 *
 * Every call reuses `zohoFetch`/`zohoFetchBinary`, which inject organization_id
 * and refresh the access token, so callers only pass the connection.
 */

export interface DraftInvoiceLine {
  /** Line label shown on the invoice (e.g. "October retainer"). */
  name: string;
  description?: string;
  rate: number;
  quantity?: number;
}

export interface CreateDraftInvoiceArgs {
  customerId: string;
  lines: DraftInvoiceLine[];
  /** Invoice date as YYYY-MM-DD. Defaults to today (Zoho's default). */
  date?: string;
  notes?: string;
  referenceNumber?: string;
}

export interface EmailInvoiceArgs {
  /** Recipients. If omitted, Zoho falls back to the contact's own email. */
  toMailIds?: string[];
  ccMailIds?: string[];
  subject?: string;
  body?: string;
}

/**
 * Search customers by name (Zoho's `contact_name_contains`), narrowed to
 * active contacts that can be billed (customer or both). Returns the raw
 * matches so the caller can disambiguate when more than one comes back.
 */
export async function searchZohoCustomers(
  conn: ZohoConnection,
  name: string,
): Promise<ZohoContact[]> {
  const data = await zohoFetch<{ contacts?: ZohoContact[] }>(conn, "/contacts", {
    query: { contact_name_contains: name, status: "active" },
  });
  const contacts = data.contacts ?? [];
  return contacts.filter((c) => c.contact_type === "customer" || c.contact_type === "both");
}

/**
 * Resolve a single customer by name. Returns the match when there's exactly
 * one, an exact (case-insensitive) name match when several contain the term,
 * or null when there's nothing / still ambiguous — the caller then asks the
 * user to pick rather than guessing which client to bill.
 */
export async function resolveZohoCustomer(
  conn: ZohoConnection,
  name: string,
): Promise<{ customer: ZohoContact | null; matches: ZohoContact[] }> {
  const matches = await searchZohoCustomers(conn, name);
  if (matches.length === 1) return { customer: matches[0], matches };

  const exact = matches.filter(
    (c) => c.contact_name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  if (exact.length === 1) return { customer: exact[0], matches };

  return { customer: null, matches };
}

/**
 * Create a DRAFT invoice. Deliberately does not send or email anything — the
 * WhatsApp approval step gates that. Currency/tax default from the customer's
 * Zoho profile.
 */
export async function createZohoDraftInvoice(
  conn: ZohoConnection,
  args: CreateDraftInvoiceArgs,
): Promise<ZohoInvoice> {
  const data = await zohoFetch<{ invoice: ZohoInvoice }>(conn, "/invoices", {
    method: "POST",
    body: {
      customer_id: args.customerId,
      date: args.date,
      notes: args.notes,
      reference_number: args.referenceNumber,
      line_items: args.lines.map((l) => ({
        name: l.name,
        description: l.description,
        rate: l.rate,
        quantity: l.quantity ?? 1,
      })),
    },
  });
  return data.invoice;
}

/** Fetch one invoice (e.g. to confirm its status before/after an action). */
export async function getZohoInvoice(
  conn: ZohoConnection,
  invoiceId: string,
): Promise<ZohoInvoice> {
  const data = await zohoFetch<{ invoice: ZohoInvoice }>(conn, `/invoices/${invoiceId}`);
  return data.invoice;
}

/** Download the invoice as a PDF (bytes) to forward on WhatsApp for approval. */
export async function getZohoInvoicePdf(conn: ZohoConnection, invoiceId: string): Promise<Buffer> {
  return zohoFetchBinary(conn, `/invoices/${invoiceId}`, { query: { accept: "pdf" } });
}

/**
 * Email the invoice to the client. Zoho attaches the PDF and marks the invoice
 * `sent`. With no `toMailIds`, Zoho uses the contact's stored email.
 */
export async function emailZohoInvoice(
  conn: ZohoConnection,
  invoiceId: string,
  args: EmailInvoiceArgs = {},
): Promise<void> {
  await zohoFetch(conn, `/invoices/${invoiceId}/email`, {
    method: "POST",
    body: {
      to_mail_ids: args.toMailIds,
      cc_mail_ids: args.ccMailIds,
      subject: args.subject,
      body: args.body,
    },
  });
}

/** Void a draft invoice (the rejection path), so cancelled drafts don't linger. */
export async function voidZohoInvoice(conn: ZohoConnection, invoiceId: string): Promise<void> {
  await zohoFetch(conn, `/invoices/${invoiceId}/status/void`, { method: "POST" });
}
