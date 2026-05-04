import { pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";

export const itemTypeEnum = pgEnum("item_type", ["good", "service"]);

export const items = pgTable("items", {
  id: text("id").primaryKey().$defaultFn(createId),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: itemTypeEnum("type").notNull().default("service"),
  hsnCode: varchar("hsn_code", { length: 8 }),
  sacCode: varchar("sac_code", { length: 6 }),
  defaultRate: varchar("default_rate", { length: 20 }).notNull().default("0"),
  defaultTaxRateId: text("default_tax_rate_id"),
  incomeAccountId: text("income_account_id"),
  expenseAccountId: text("expense_account_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
