import { db } from "@/lib/db/client";
import { approvalQueue } from "@/lib/db/schema";
import { createId } from "@/lib/db/utils";

/**
 * Insert a pending item into the approval queue.
 *
 * Lives in its own module (not the approvals router) so both the router and
 * the AI tools can import it without a circular dependency.
 */
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
