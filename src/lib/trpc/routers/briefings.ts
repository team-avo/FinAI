import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiBriefings } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";
import { createId } from "@/lib/db/utils";

export interface BriefingContent {
  greeting: string;
  headline: string;
  topConcerns: string[];
  suggestedActions: string[];
  cashPosition?: string;
}

export const briefingsRouter = router({
  latest: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select()
      .from(aiBriefings)
      .where(eq(aiBriefings.orgId, ctx.orgId))
      .orderBy(desc(aiBriefings.generatedAt))
      .limit(1);
    return row ?? null;
  }),
});

export async function saveBriefing(opts: {
  orgId: string;
  userId: string;
  type?: "morning" | "weekly";
  content: BriefingContent;
}) {
  const [row] = await db
    .insert(aiBriefings)
    .values({
      id: createId(),
      orgId: opts.orgId,
      userId: opts.userId,
      type: opts.type ?? "morning",
      content: opts.content as never,
    })
    .returning();
  return row;
}
