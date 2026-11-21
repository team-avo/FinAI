/**
 * Smoke-test the Zoho Books invoice calls (src/lib/zoho/invoices.ts) against a
 * real connection, BEFORE wiring them into the WhatsApp webhook.
 *
 * Run (reads .env.local for DATABASE_URL + Zoho creds):
 *
 *   # 1. Read-only: find a customer by name (safe, no writes)
 *   pnpm tsx --env-file=.env.local scripts/zoho-invoice-smoke.ts --find "FinAI Test"
 *
 *   # 2. Full round-trip on a DRAFT (create → pdf → void). Never emails anyone.
 *   pnpm tsx --env-file=.env.local scripts/zoho-invoice-smoke.ts \
 *       --client "FinAI Test Co" --amount 2500 --desc "October retainer"
 *
 *   # 3. Add --email you@example.com to also test the SEND step (really emails!)
 *   #    Only do this with a test client whose email is your own.
 *   pnpm tsx --env-file=.env.local scripts/zoho-invoice-smoke.ts \
 *       --client "FinAI Test Co" --amount 2500 --desc "October retainer" \
 *       --email you@example.com --really-send
 *
 * Flags:
 *   --org <id>        FinAI org whose Zoho connection to use (default "advertout")
 *   --find <name>     just search customers and exit
 *   --client <name>   customer to invoice
 *   --amount <n>      line amount
 *   --desc <text>     line description
 *   --email <addr>    recipient for the send test (overrides contact email)
 *   --really-send     actually call the email endpoint (otherwise skipped)
 *   --keep            don't void the draft at the end (inspect it in Zoho)
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { zohoConnections } from "@/lib/db/schema";
import {
  createZohoDraftInvoice,
  emailZohoInvoice,
  getZohoInvoicePdf,
  resolveZohoCustomer,
  searchZohoCustomers,
  voidZohoInvoice,
} from "@/lib/zoho/invoices";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const orgId = arg("org") ?? "advertout";

  const [conn] = await db
    .select()
    .from(zohoConnections)
    .where(eq(zohoConnections.orgId, orgId))
    .limit(1);

  if (!conn) {
    throw new Error(`No Zoho connection for org "${orgId}". Connect Zoho in the app first.`);
  }
  console.log(`✓ Using Zoho connection: ${conn.zohoOrgName ?? conn.zohoOrgId} (org ${orgId})`);

  // Mode 1: search only
  const findName = arg("find");
  if (findName) {
    const matches = await searchZohoCustomers(conn, findName);
    console.log(`\nMatches for "${findName}" (${matches.length}):`);
    for (const c of matches) {
      console.log(
        `  • ${c.contact_name}  [${c.contact_id}]  ${c.email ?? "(no email)"}  type=${c.contact_type}`,
      );
    }
    return;
  }

  // Mode 2/3: round-trip on a draft
  const clientName = arg("client");
  const amount = Number(arg("amount"));
  const desc = arg("desc") ?? "Services";
  if (!clientName || !Number.isFinite(amount)) {
    throw new Error("Pass --find <name>, or --client <name> --amount <n> [--desc <text>].");
  }

  const { customer, matches } = await resolveZohoCustomer(conn, clientName);
  if (!customer) {
    console.log(`\n✗ Could not resolve a single customer for "${clientName}". Candidates:`);
    for (const c of matches) console.log(`  • ${c.contact_name} [${c.contact_id}]`);
    return;
  }
  console.log(
    `✓ Customer: ${customer.contact_name} [${customer.contact_id}] ${customer.email ?? ""}`,
  );

  const invoice = await createZohoDraftInvoice(conn, {
    customerId: customer.contact_id,
    lines: [{ name: desc, rate: amount }],
  });
  console.log(
    `✓ Draft created: ${invoice.invoice_number} [${invoice.invoice_id}] status=${invoice.status} total=${invoice.total}`,
  );

  const pdf = await getZohoInvoicePdf(conn, invoice.invoice_id);
  const looksPdf = pdf.subarray(0, 4).toString("ascii") === "%PDF";
  console.log(
    `✓ PDF downloaded: ${pdf.length} bytes ${looksPdf ? "(valid %PDF header)" : "(⚠ not a PDF!)"}`,
  );

  const email = arg("email");
  if (flag("really-send")) {
    await emailZohoInvoice(conn, invoice.invoice_id, email ? { toMailIds: [email] } : {});
    console.log(
      `✓ Emailed invoice${email ? ` to ${email}` : " to contact's email"} — marked sent.`,
    );
  } else {
    console.log("• Skipped email step (pass --really-send to test it).");
  }

  if (flag("keep")) {
    console.log(`• Kept draft ${invoice.invoice_number} in Zoho for inspection.`);
  } else if (!flag("really-send")) {
    await voidZohoInvoice(conn, invoice.invoice_id);
    console.log(`✓ Voided draft ${invoice.invoice_number} (cleanup).`);
  } else {
    console.log(`• Not voiding ${invoice.invoice_number} — it was sent.`);
  }

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n✗ Smoke test failed:\n", err);
    process.exit(1);
  });
