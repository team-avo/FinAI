import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";
import { contacts } from "./contacts";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
  "partial",
]);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    number: varchar("number", { length: 50 }).notNull(),
    contactId: text("contact_id").references(() => contacts.id),
    contactName: varchar("contact_name", { length: 255 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactGstin: varchar("contact_gstin", { length: 15 }),
    billingAddress: text("billing_address"),
    issueDate: timestamp("issue_date").notNull(),
    dueDate: timestamp("due_date"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    cgstAmount: numeric("cgst_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    igstAmount: numeric("igst_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    totalTax: numeric("total_tax", { precision: 15, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).notNull().default("0"),
    amountDue: numeric("amount_due", { precision: 15, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    isInterstate: integer("is_interstate").notNull().default(0),
    journalEntryId: text("journal_entry_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("invoices_org_idx").on(t.orgId),
    index("invoices_status_idx").on(t.status),
    index("invoices_contact_idx").on(t.contactId),
    index("invoices_due_date_idx").on(t.dueDate),
  ],
);

export const invoiceLines = pgTable("invoice_lines", {
  id: text("id").primaryKey().$defaultFn(createId),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  itemId: text("item_id"),
  description: varchar("description", { length: 500 }).notNull(),
  hsnCode: varchar("hsn_code", { length: 8 }),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
  rate: numeric("rate", { precision: 15, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  cgstRate: numeric("cgst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  sgstRate: numeric("sgst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  igstRate: numeric("igst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;
