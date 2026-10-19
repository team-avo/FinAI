import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { approvalQueue } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";
import { logActivity } from "./activity";
import { postExpenseRecord } from "@/lib/ai/tools";

// Shape of an "expense_record" approval payload (mirrors the recordExpense tool
// input; validated before we post so a malformed row can't corrupt the ledger).
const expensePayloadSchema = z.object({
  date: z.string().optional(),
  vendorName: z.string().optional(),
  categoryDescription: z.string(),
  amount: z.number().positive(),
  cgst: z.number().min(0),
  sgst: z.number().min(0),
  igst: z.number().min(0),
  notes: z.string().optional(),
});

// Execute a queued action for real. Returns the posting result (or null when
// the approval type has no executor yet). NOTE: recordExpense posts to the
// capture org ("advertout"); the approve mutation only claims rows whose orgId
// matches ctx.orgId, so org stays consistent until ORG_ID is de-hardcoded.
async function executeApproval(
  row: typeof approvalQueue.$inferSelect,
): Promise<unknown> {
  if (row.type === "expense_record") {
    const parsed = expensePayloadSchema.parse(row.payload);
    // Post-only primitive (no routing) so approving never re-queues the item.
    return postExpenseRecord(parsed);
  }
  // Other approval types are not auto-posted yet; approving records the decision.
  return null;
}

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

      // Atomically claim the item: only the first caller to move it out of
      // "pending" proceeds to post, so a double-click or retried request can
      // never post the same expense to the ledger twice.
      const [claimed] = await db
        .update(approvalQueue)
        .set({
          status: newStatus,
          reviewedBy: ctx.userId,
          reviewedAt: new Date(),
          ...(input.editedPayload ? { payload: input.editedPayload as never } : {}),
        })
        .where(
          and(
            eq(approvalQueue.id, input.id),
            eq(approvalQueue.orgId, ctx.orgId),
            eq(approvalQueue.status, "pending"),
          ),
        )
        .returning();

      if (!claimed) {
        // Already processed (or not found) — idempotent no-op; never re-post.
        const [existing] = await db
          .select()
          .from(approvalQueue)
          .where(and(eq(approvalQueue.id, input.id), eq(approvalQueue.orgId, ctx.orgId)));
        if (!existing) throw new Error("Approval not found");
        return existing;
      }

      // Actually execute the queued action so it reaches the ledger.
      let posted: unknown = null;
      try {
        posted = await executeApproval(claimed);
      } catch (err) {
        // Posting failed — roll the claim back to "pending" so it stays
        // actionable and the invariant "approved ⇒ posted" holds.
        await db
          .update(approvalQueue)
          .set({ status: "pending", reviewedBy: null, reviewedAt: null })
          .where(eq(approvalQueue.id, input.id));
        await logActivity({
          orgId: ctx.orgId,
          actor: `user:${ctx.userId}`,
          action: "approval:post_failed",
          entityType: "approval",
          entityRef: input.id,
          input: { approvalId: input.id },
          output: { error: err instanceof Error ? err.message : String(err) },
          success: false,
        }).catch(() => {});
        throw err;
      }

      await logActivity({
        orgId: ctx.orgId,
        actor: `user:${ctx.userId}`,
        action: `approval:${claimed.status}`,
        entityType: "approval",
        entityRef: input.id,
        input: { approvalId: input.id },
        output: { status: claimed.status, posted: posted ?? undefined },
      }).catch(() => {});

      return { ...claimed, posted };
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .update(approvalQueue)
        .set({ status: "rejected", reviewedBy: ctx.userId, reviewedAt: new Date() })
        .where(
          and(
            eq(approvalQueue.id, input.id),
            eq(approvalQueue.orgId, ctx.orgId),
            eq(approvalQueue.status, "pending"),
          ),
        )
        .returning();

      if (!row) {
        // Already approved/posted or already rejected — don't desync; return as-is.
        const [existing] = await db
          .select()
          .from(approvalQueue)
          .where(and(eq(approvalQueue.id, input.id), eq(approvalQueue.orgId, ctx.orgId)));
        if (!existing) throw new Error("Approval not found");
        return existing;
      }

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
