import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Materialised cross-business Trust Graph: one row per supplier GSTIN that ≥2
 * businesses on FinAI have observed, with their aggregate filing reliability.
 *
 * This is the scalable form of `computeSupplierNetworkStats()` — instead of
 * scanning every org's reconcilable data on each Supplier Trust page view, the
 * aggregate is rebuilt periodically (daily cron + after each GSTR-2B upload)
 * and the page just reads this table. Only ≥2-business GSTINs are stored, since
 * the network signal is only shown at that threshold anyway.
 */
export const supplierNetworkStats = pgTable("supplier_network_stats", {
  gstin: varchar("gstin", { length: 15 }).primaryKey(),
  orgs: integer("orgs").notNull(),
  invoices: integer("invoices").notNull(),
  filed: integer("filed").notNull(),
  score: integer("score").notNull(), // 0–100
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
