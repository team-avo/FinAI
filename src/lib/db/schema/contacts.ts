import { index, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";

export const contactTypeEnum = pgEnum("contact_type", ["customer", "vendor", "both"]);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: contactTypeEnum("type").notNull().default("customer"),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 15 }),
    gstin: varchar("gstin", { length: 15 }),
    pan: varchar("pan", { length: 10 }),
    billingAddress: text("billing_address"),
    billingCity: varchar("billing_city", { length: 100 }),
    billingState: varchar("billing_state", { length: 100 }),
    billingStateCode: varchar("billing_state_code", { length: 2 }),
    billingPincode: varchar("billing_pincode", { length: 6 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("contacts_org_idx").on(t.orgId), index("contacts_type_idx").on(t.type)],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
