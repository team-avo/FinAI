import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";
import { createId } from "@/lib/db/utils";

export const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, ctx.userId))
        .orderBy(desc(notifications.createdAt))
        .limit(input?.limit ?? 50);
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)));
    return rows.length;
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.userId)));
      return { ok: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)));
    return { ok: true };
  }),
});

// ─── Shared helper — call from server-side (cron, webhooks, etc.) ─────────────
export async function createNotification(opts: {
  userId: string;
  orgId: string;
  type: typeof notifications.$inferInsert["type"];
  level?: typeof notifications.$inferInsert["level"];
  title: string;
  body?: string;
  entityRef?: string;
  deliveredVia?: typeof notifications.$inferInsert["deliveredVia"];
}) {
  const [row] = await db.insert(notifications).values({ id: createId(), ...opts }).returning();
  return row;
}
