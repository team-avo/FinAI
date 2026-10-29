import { boolean, numeric, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";

export const bankProviderEnum = pgEnum("bank_provider", ["sandbox", "aa"]);

/**
 * A connected bank account and its latest balance. Today the balance is pulled
 * from a sandbox provider; a real Account Aggregator (Finvu/Setu) connection
 * slots in behind the same `BankProvider` interface and writes the same row.
 * This is what turns the cash-flow forecast from an estimate into a real
 * balance projection.
 */
export const bankAccounts = pgTable("bank_accounts", {
  id: text("id").primaryKey().$defaultFn(createId),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  provider: bankProviderEnum("provider").notNull().default("sandbox"),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull().default("0"),
  asOf: timestamp("as_of").notNull().defaultNow(),
  connected: boolean("connected").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
