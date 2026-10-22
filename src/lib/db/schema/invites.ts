import { index, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";
import { memberRoleEnum } from "./users";

export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "revoked"]);

/**
 * A pending invitation to join an org. Created when an owner invites someone by
 * email who doesn't have a FinAI account yet; consumed (→ a membership) when
 * that person signs in with the matching email and opens the invite link.
 */
export const invites = pgTable(
  "invites",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: memberRoleEnum("role").notNull().default("viewer"),
    token: varchar("token", { length: 64 }).notNull().unique(),
    invitedBy: text("invited_by"),
    status: inviteStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [
    index("invites_org_idx").on(t.orgId),
    index("invites_email_idx").on(t.email),
  ],
);

export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
