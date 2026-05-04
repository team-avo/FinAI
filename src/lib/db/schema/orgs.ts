import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: varchar("name", { length: 255 }).notNull(),
  gstin: varchar("gstin", { length: 15 }),
  pan: varchar("pan", { length: 10 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  stateCode: varchar("state_code", { length: 2 }),
  pincode: varchar("pincode", { length: 6 }),
  phone: varchar("phone", { length: 15 }),
  email: varchar("email", { length: 255 }),
  logoUrl: text("logo_url"),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  fiscalYearStart: varchar("fiscal_year_start", { length: 5 }).notNull().default("04-01"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
