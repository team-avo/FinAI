import { jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@/lib/db/utils";
import { organizations } from "./orgs";
import { users } from "./users";

// react-grid-layout item shape
export interface GridLayoutItem {
  i: string; // widget instance id
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface WidgetInstance {
  type: string; // WidgetId from registry
  params?: Record<string, unknown>;
}

export const dashboardLayouts = pgTable(
  "dashboard_layouts",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    gridConfig: jsonb("grid_config").notNull().$type<GridLayoutItem[]>(),
    widgets: jsonb("widgets").notNull().$type<Record<string, WidgetInstance>>(),
    onboardingCompleted: timestamp("onboarding_completed"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqueUserOrg: uniqueIndex("dashboard_layouts_user_org_unique").on(t.userId, t.orgId),
  }),
);

export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type NewDashboardLayout = typeof dashboardLayouts.$inferInsert;
