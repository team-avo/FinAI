import { index, numeric, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";
import { chartOfAccounts } from "./chart-of-accounts";

export const journalSourceEnum = pgEnum("journal_source", [
  "invoice",
  "payment",
  "expense",
  "bill",
  "manual",
  "opening_balance",
]);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(),
    sourceType: journalSourceEnum("source_type").notNull(),
    sourceId: text("source_id"),
    narration: varchar("narration", { length: 500 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("journal_entries_org_idx").on(t.orgId),
    index("journal_entries_date_idx").on(t.date),
    index("journal_entries_source_idx").on(t.sourceId),
  ],
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    entryId: text("entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => chartOfAccounts.id),
    debit: numeric("debit", { precision: 15, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 15, scale: 2 }).notNull().default("0"),
    narration: varchar("narration", { length: 255 }),
  },
  (t) => [
    index("journal_lines_entry_idx").on(t.entryId),
    index("journal_lines_account_idx").on(t.accountId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: text("contact_id"),
    date: timestamp("date").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    method: varchar("method", { length: 50 }).notNull().default("bank_transfer"),
    reference: varchar("reference", { length: 100 }),
    type: varchar("type", { length: 10 }).notNull(),
    appliedToId: text("applied_to_id"),
    appliedToType: varchar("applied_to_type", { length: 20 }),
    journalEntryId: text("journal_entry_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("payments_org_idx").on(t.orgId)],
);

export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
export type JournalLine = typeof journalLines.$inferSelect;
export type Payment = typeof payments.$inferSelect;
