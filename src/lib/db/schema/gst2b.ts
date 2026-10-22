import { index, numeric, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";

export const gstr2bSourceEnum = pgEnum("gstr2b_source", ["upload", "gsp"]);

/**
 * Inward-supply invoices as they appear in the government's GSTR-2B for a
 * period. Imported (uploaded JSON today, auto-fetched via a GSP later) and
 * reconciled against the purchase register (expenses) to find ITC at risk.
 */
export const gstr2bEntries = pgTable(
  "gstr2b_entries",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    period: varchar("period", { length: 7 }).notNull(), // "YYYY-MM"
    supplierGstin: varchar("supplier_gstin", { length: 15 }).notNull(),
    supplierName: varchar("supplier_name", { length: 255 }),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
    invoiceDate: timestamp("invoice_date"),
    taxableValue: numeric("taxable_value", { precision: 15, scale: 2 }).notNull().default("0"),
    cgst: numeric("cgst", { precision: 15, scale: 2 }).notNull().default("0"),
    sgst: numeric("sgst", { precision: 15, scale: 2 }).notNull().default("0"),
    igst: numeric("igst", { precision: 15, scale: 2 }).notNull().default("0"),
    source: gstr2bSourceEnum("source").notNull().default("upload"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("gstr2b_org_period_idx").on(t.orgId, t.period),
    index("gstr2b_gstin_idx").on(t.supplierGstin),
  ],
);

export type Gstr2bEntry = typeof gstr2bEntries.$inferSelect;
export type NewGstr2bEntry = typeof gstr2bEntries.$inferInsert;
