import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiActivityLog } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";
import { createId } from "@/lib/db/utils";

export const activityRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        actor: z.string().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(aiActivityLog)
        .where(eq(aiActivityLog.orgId, ctx.orgId))
        .orderBy(desc(aiActivityLog.createdAt))
        .limit(input?.limit ?? 50);
    }),
});

// ─── Shared helper — call from AI tools, cron, webhooks ───────────────────────
export async function logActivity(opts: {
  orgId: string;
  actor: string;
  action: string;
  entityType?: string;
  entityRef?: string;
  input?: unknown;
  output?: unknown;
  success?: boolean;
  errorMessage?: string;
  latencyMs?: number;
}) {
  const truncate = (v: unknown) => {
    if (!v) return undefined;
    const str = JSON.stringify(v);
    return str.length > 2000 ? JSON.parse(str.slice(0, 2000) + '"]}') : v;
  };

  await db.insert(aiActivityLog).values({
    id: createId(),
    orgId: opts.orgId,
    actor: opts.actor,
    action: opts.action,
    entityType: opts.entityType,
    entityRef: opts.entityRef,
    input: truncate(opts.input) as never,
    output: truncate(opts.output) as never,
    success: opts.success ?? true,
    errorMessage: opts.errorMessage,
    latencyMs: opts.latencyMs,
  });
}
