import {
  boolean,
  index,
  json,
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
import { chartOfAccounts } from "./chart-of-accounts";

export const expenseSourceEnum = pgEnum("expense_source", [
  "manual",
  "whatsapp",
  "email",
  "ocr_upload",
]);

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(),
    vendorId: text("vendor_id").references(() => contacts.id),
    vendorName: varchar("vendor_name", { length: 255 }),
    accountId: text("account_id").references(() => chartOfAccounts.id),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    attachmentId: text("attachment_id"),
    notes: text("notes"),
    reference: varchar("reference", { length: 100 }),
    source: expenseSourceEnum("source").notNull().default("manual"),
    aiCategorized: boolean("ai_categorized").notNull().default(false),
    rawOcrData: json("raw_ocr_data"),
    journalEntryId: text("journal_entry_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("expenses_org_idx").on(t.orgId),
    index("expenses_date_idx").on(t.date),
    index("expenses_account_idx").on(t.accountId),
    index("expenses_vendor_idx").on(t.vendorId),
  ],
);

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
