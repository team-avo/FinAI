import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { zohoConnections } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";

const ORG_ID = "advertout";

/**
 * Zoho integration status / management.
 *
 * - `status` — does the current user (or any org-mate) have a Zoho connection?
 *   Used by the Integrations settings tab to render Connected vs Disconnected.
 *
 * Connect / disconnect themselves are GET/POST route handlers under
 * /api/zoho/{connect,callback,disconnect} — they need to redirect or carry
 * cookies, which tRPC mutations can't do cleanly.
 */
export const zohoRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const [own] = await db
      .select({
        id: zohoConnections.id,
        zohoOrgId: zohoConnections.zohoOrgId,
        zohoOrgName: zohoConnections.zohoOrgName,
        createdAt: zohoConnections.createdAt,
        scope: zohoConnections.scope,
      })
      .from(zohoConnections)
      .where(
        and(eq(zohoConnections.userId, ctx.userId), eq(zohoConnections.orgId, ORG_ID)),
      )
      .limit(1);

    if (own) return { connected: true as const, ownConnection: true, ...own };

    // Surface teammate connections so the user knows the dashboard already
    // shows Zoho data (sourced from someone else's token) and they can opt to
    // connect their own.
    const [teammate] = await db
      .select({
        zohoOrgId: zohoConnections.zohoOrgId,
        zohoOrgName: zohoConnections.zohoOrgName,
      })
      .from(zohoConnections)
      .where(eq(zohoConnections.orgId, ORG_ID))
      .limit(1);

    if (teammate) {
      return {
        connected: true as const,
        ownConnection: false,
        ...teammate,
      };
    }

    return { connected: false as const };
  }),
});
