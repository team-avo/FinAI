import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dashboardLayouts } from "@/lib/db/schema";
import { router, protectedProcedure, publicProcedure } from "../init";
import { buildDefaultLayout, DEFAULT_WIDGET_IDS, type WidgetId } from "@/lib/dashboard/widgets-registry";

const gridItemSchema = z.object({
  i: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  minW: z.number().optional(),
  minH: z.number().optional(),
});

const widgetInstanceSchema = z.object({
  type: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

const saveLayoutSchema = z.object({
  gridConfig: z.array(gridItemSchema),
  widgets: z.record(z.string(), widgetInstanceSchema),
});

export const dashboardsRouter = router({
  // Get the current user's layout. If none exists (or running unauthenticated
  // / without a DB in dev), return the default layout with onboarding marked
  // complete so the modal doesn't auto-open in demo mode.
  getMyLayout: publicProcedure.query(async ({ ctx }) => {
    const fallback = () => {
      const def = buildDefaultLayout();
      return {
        ...def,
        isDefault: true,
        // In dev without auth, surface the layout immediately and skip onboarding.
        onboardingCompleted: ctx.userId ? null : new Date(),
      };
    };

    if (!ctx.userId || !db) return fallback();

    try {
      const [row] = await db
        .select()
        .from(dashboardLayouts)
        .where(and(eq(dashboardLayouts.userId, ctx.userId), eq(dashboardLayouts.orgId, ctx.orgId)))
        .limit(1);

      if (!row) return fallback();
      return {
        gridConfig: row.gridConfig,
        widgets: row.widgets,
        isDefault: false,
        onboardingCompleted: row.onboardingCompleted,
      };
    } catch {
      return fallback();
    }
  }),

  saveLayout: protectedProcedure.input(saveLayoutSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.userId) throw new Error("Authentication required");

    const [existing] = await db
      .select()
      .from(dashboardLayouts)
      .where(and(eq(dashboardLayouts.userId, ctx.userId), eq(dashboardLayouts.orgId, ctx.orgId)))
      .limit(1);

    if (existing) {
      await db
        .update(dashboardLayouts)
        .set({
          gridConfig: input.gridConfig,
          widgets: input.widgets,
          updatedAt: new Date(),
        })
        .where(eq(dashboardLayouts.id, existing.id));
    } else {
      await db.insert(dashboardLayouts).values({
        userId: ctx.userId,
        orgId: ctx.orgId,
        gridConfig: input.gridConfig,
        widgets: input.widgets,
      });
    }
    return { success: true };
  }),

  completeOnboarding: protectedProcedure
    .input(
      z.object({
        widgetIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new Error("Authentication required");

      const widgetIds = (input.widgetIds && input.widgetIds.length > 0
        ? input.widgetIds
        : DEFAULT_WIDGET_IDS) as WidgetId[];
      const def = buildDefaultLayout(widgetIds);
      const now = new Date();

      const [existing] = await db
        .select()
        .from(dashboardLayouts)
        .where(and(eq(dashboardLayouts.userId, ctx.userId), eq(dashboardLayouts.orgId, ctx.orgId)))
        .limit(1);

      if (existing) {
        await db
          .update(dashboardLayouts)
          .set({
            gridConfig: def.gridConfig,
            widgets: def.widgets,
            onboardingCompleted: now,
            updatedAt: now,
          })
          .where(eq(dashboardLayouts.id, existing.id));
      } else {
        await db.insert(dashboardLayouts).values({
          userId: ctx.userId,
          orgId: ctx.orgId,
          gridConfig: def.gridConfig,
          widgets: def.widgets,
          onboardingCompleted: now,
        });
      }
      return { success: true };
    }),

  resetToDefault: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.userId) throw new Error("Authentication required");
    const def = buildDefaultLayout();
    const [existing] = await db
      .select()
      .from(dashboardLayouts)
      .where(and(eq(dashboardLayouts.userId, ctx.userId), eq(dashboardLayouts.orgId, ctx.orgId)))
      .limit(1);
    if (existing) {
      await db
        .update(dashboardLayouts)
        .set({
          gridConfig: def.gridConfig,
          widgets: def.widgets,
          updatedAt: new Date(),
        })
        .where(eq(dashboardLayouts.id, existing.id));
    } else {
      await db.insert(dashboardLayouts).values({
        userId: ctx.userId,
        orgId: ctx.orgId,
        gridConfig: def.gridConfig,
        widgets: def.widgets,
      });
    }
    return def;
  }),
});
