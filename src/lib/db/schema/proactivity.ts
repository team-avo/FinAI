import {
  boolean,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";
import { users } from "./users";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const notificationTypeEnum = pgEnum("notification_type", [
  "anomaly",
  "approval_pending",
  "briefing",
  "invoice_paid",
  "system",
]);

export const notificationLevelEnum = pgEnum("notification_level", [
  "info",
  "warn",
  "critical",
]);

export const deliveryChannelEnum = pgEnum("delivery_channel", [
  "web",
  "whatsapp",
  "both",
]);

export const approvalTypeEnum = pgEnum("approval_type", [
  "receipt_categorize",
  "invoice_send",
  "expense_record",
  "large_categorize",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "edited",
]);

export const approvalSourceEnum = pgEnum("approval_source", [
  "whatsapp",
  "web",
  "cron",
]);

export const briefingTypeEnum = pgEnum("briefing_type", ["morning", "weekly"]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    level: notificationLevelEnum("level").notNull().default("info"),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    entityRef: varchar("entity_ref", { length: 255 }), // e.g. "invoice:INV-023"
    deliveredVia: deliveryChannelEnum("delivered_via").notNull().default("web"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_read_idx").on(t.userId, t.readAt),
    index("notifications_org_idx").on(t.orgId),
  ],
);

export const approvalQueue = pgTable(
  "approval_queue",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: approvalTypeEnum("type").notNull(),
    payload: json("payload").notNull(), // proposed action data
    confidence: integer("confidence").notNull().default(0), // 0-100
    sourceChannel: approvalSourceEnum("source_channel").notNull().default("web"),
    status: approvalStatusEnum("status").notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    notificationId: text("notification_id"), // links to notifications row
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("approval_queue_org_status_idx").on(t.orgId, t.status),
  ],
);

export const aiActivityLog = pgTable(
  "ai_activity_log",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // actor: "user:<userId>", "ai_web", "ai_whatsapp", "cron"
    actor: varchar("actor", { length: 64 }).notNull(),
    action: varchar("action", { length: 128 }).notNull(), // e.g. "tool:createInvoice"
    entityType: varchar("entity_type", { length: 64 }),   // e.g. "invoice"
    entityRef: varchar("entity_ref", { length: 255 }),    // e.g. "INV-023"
    input: json("input"),   // truncated to 2KB
    output: json("output"), // truncated to 2KB
    success: boolean("success").notNull().default(true),
    errorMessage: text("error_message"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_activity_org_created_idx").on(t.orgId, t.createdAt),
  ],
);

export const aiBriefings = pgTable(
  "ai_briefings",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: briefingTypeEnum("type").notNull().default("morning"),
    // structured JSON: { greeting, headline, topConcerns[], suggestedActions[], cashPosition }
    content: json("content").notNull(),
    generatedAt: timestamp("generated_at").notNull().defaultNow(),
    dismissedAt: timestamp("dismissed_at"),
  },
  (t) => [
    index("ai_briefings_user_created_idx").on(t.userId, t.generatedAt),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type ApprovalQueue = typeof approvalQueue.$inferSelect;
export type AiActivityLog = typeof aiActivityLog.$inferSelect;
export type AiBriefing = typeof aiBriefings.$inferSelect;
