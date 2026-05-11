import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";
import { users } from "./users";

/**
 * Per-user Zoho Books OAuth connection.
 *
 * One row per (userId, orgId) pair — a user can connect a different Zoho Books
 * org for each FinAI org they belong to. The aggregate router prefers the
 * caller's own connection but falls back to any connection in the same org so
 * a single Zoho connection serves all teammates.
 *
 * Access tokens are 1 h; we refresh on demand (auth.ts) and persist the latest
 * one + expiry so cold starts don't hammer the OAuth endpoint.
 */
export const zohoConnections = pgTable(
  "zoho_connections",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Zoho-side identity
    zohoOrgId: varchar("zoho_org_id", { length: 32 }).notNull(),
    zohoOrgName: varchar("zoho_org_name", { length: 255 }),
    zohoUserEmail: varchar("zoho_user_email", { length: 255 }),

    // OAuth credentials
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
    scope: text("scope"),
    apiDomain: varchar("api_domain", { length: 255 }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("zoho_connections_user_org_idx").on(t.userId, t.orgId),
    index("zoho_connections_org_idx").on(t.orgId),
  ],
);

export type ZohoConnection = typeof zohoConnections.$inferSelect;
export type NewZohoConnection = typeof zohoConnections.$inferInsert;
