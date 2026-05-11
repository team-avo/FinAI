import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { approvalQueue } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";
import { createId } from "@/lib/db/utils";
import { logActivity } from "./activity";

export const approvalsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "rejected", "edited", "all"]).default("pending"),
        limit: z.number().min(1).max(100).default(50),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(approvalQueue.orgId, ctx.orgId)];
      if (input?.status && input.status !== "all") {
        conditions.push(eq(approvalQueue.status, input.status));
      }
      return db
        .select()
        .from(approvalQueue)
        .where(and(...conditions))
        .orderBy(desc(approvalQueue.createdAt))
        .limit(input?.limit ?? 50);
    }),

  pendingCount: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ id: approvalQueue.id })
      .from(approvalQueue)
      .where(and(eq(approvalQueue.orgId, ctx.orgId), eq(approvalQueue.status, "pending")));
    return rows.length;
  }),

  approve: protectedProcedure
    .input(z.object({ id: z.string(), editedPayload: z.record(z.string(), z.unknown()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const newStatus = input.editedPayload ? ("edited" as const) : ("approved" as const);
      const [row] = await db
        .update(approvalQueue)
        .set({
          status: newStatus,
          reviewedBy: ctx.userId,
          reviewedAt: new Date(),
          ...(input.editedPayload ? { payload: input.editedPayload as never } : {}),
        })
        .where(and(eq(approvalQueue.id, input.id), eq(approvalQueue.orgId, ctx.orgId)))
        .returning();

      await logActivity({
        orgId: ctx.orgId,
        actor: `user:${ctx.userId}`,
        action: `approval:${row.status}`,
        entityType: "approval",
        entityRef: input.id,
        input: { approvalId: input.id },
        output: { status: row.status },
      });

      return row;
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .update(approvalQueue)
        .set({ status: "rejected", reviewedBy: ctx.userId, reviewedAt: new Date() })
        .where(and(eq(approvalQueue.id, input.id), eq(approvalQueue.orgId, ctx.orgId)))
        .returning();

      await logActivity({
        orgId: ctx.orgId,
        actor: `user:${ctx.userId}`,
        action: "approval:rejected",
        entityType: "approval",
        entityRef: input.id,
        input: { reason: input.reason },
        output: { status: "rejected" },
        success: false,
      });

      return row;
    }),
});

// ─── Shared helper ─────────────────────────────────────────────────────────────
export async function enqueueApproval(opts: {
  orgId: string;
  type: typeof approvalQueue.$inferInsert["type"];
  payload: Record<string, unknown>;
  confidence?: number;
  sourceChannel?: typeof approvalQueue.$inferInsert["sourceChannel"];
  notificationId?: string;
}) {
  const [row] = await db
    .insert(approvalQueue)
    .values({ id: createId(), confidence: 0, ...opts })
    .returning();
  return row;
}
