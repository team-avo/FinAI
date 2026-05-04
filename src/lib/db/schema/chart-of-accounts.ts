import { boolean, index, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";

export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "income",
  "expense",
  "equity",
]);

export const chartOfAccounts = pgTable(
  "chart_of_accounts",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: accountTypeEnum("type").notNull(),
    parentId: text("parent_id"),
    isSystem: boolean("is_system").notNull().default(false),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("coa_org_idx").on(t.orgId),
    index("coa_type_idx").on(t.type),
    index("coa_code_idx").on(t.orgId, t.code),
  ],
);

export const taxRates = pgTable("tax_rates", {
  id: text("id").primaryKey().$defaultFn(createId),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  rate: varchar("rate", { length: 10 }).notNull(),
  type: varchar("type", { length: 10 }).notNull().default("gst"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type NewChartOfAccount = typeof chartOfAccounts.$inferInsert;
export type TaxRate = typeof taxRates.$inferSelect;
