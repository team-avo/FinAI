import { index, json, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";
import { chartOfAccounts } from "./chart-of-accounts";

export const channelEnum = pgEnum("ai_channel", ["whatsapp", "web"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "tool"]);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull().default("web"),
    contactHandle: varchar("contact_handle", { length: 255 }),
    userId: text("user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("ai_conversations_org_idx").on(t.orgId)],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull().default(""),
    toolCalls: json("tool_calls"),
    toolResults: json("tool_results"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId)],
);

export const vendorCategories = pgTable("vendor_categories", {
  id: text("id").primaryKey().$defaultFn(createId),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  vendorPattern: varchar("vendor_pattern", { length: 255 }).notNull(),
  accountId: text("account_id").references(() => chartOfAccounts.id),
  accountName: varchar("account_name", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AiConversation = typeof aiConversations.$inferSelect;
export type AiMessage = typeof aiMessages.$inferSelect;
export type VendorCategory = typeof vendorCategories.$inferSelect;
