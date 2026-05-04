import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";

export const attachments = pgTable("attachments", {
  id: text("id").primaryKey().$defaultFn(createId),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  contentType: varchar("content_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes"),
  uploadedBy: text("uploaded_by"),
  publicUrl: text("public_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
