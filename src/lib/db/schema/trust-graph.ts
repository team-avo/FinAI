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

/**
 * Watermark for the incremental Trust Graph rebuild. A single row (id
 * "singleton") holding the instant of the last rebuild. The incremental path
 * (run after each GSTR-2B upload) recomputes only the supplier GSTINs touched by
 * expenses / 2B rows written after this instant, instead of rescanning every
 * org's data. The daily full rebuild resets it and remains the authoritative
 * backstop (it also catches deletions, which a timestamp watermark can't).
 */
export const trustGraphMeta = pgTable("trust_graph_meta", {
  id: varchar("id", { length: 16 }).primaryKey(), // always "singleton"
  lastRebuiltAt: timestamp("last_rebuilt_at").notNull().defaultNow(),
});
