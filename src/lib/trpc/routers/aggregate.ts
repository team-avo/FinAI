import { router, publicProcedure } from "../init";
import { getOrBuildAggregate } from "@/lib/zoho/aggregator";
import { getMockAggregate } from "@/lib/mock/zoho-aggregate";

/**
 * Single endpoint that returns the entire dashboard aggregate.
 *
 * Strategy:
 *   1. If Zoho env is configured → read from Zoho aggregator (cache or build).
 *   2. If not configured OR the build fails → fall back to deterministic mock
 *      so the dashboard never goes blank.
 */
export const aggregateRouter = router({
  get: publicProcedure.query(async () => {
    const zohoConfigured =
      !!process.env.ZOHO_REFRESH_TOKEN &&
      !!process.env.ZOHO_CLIENT_ID &&
      !!process.env.ZOHO_CLIENT_SECRET &&
      !!process.env.ZOHO_ORG_ID;

    if (!zohoConfigured) return getMockAggregate();

    try {
      return await getOrBuildAggregate();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Zoho aggregator failed, falling back to mock:", err);
      return getMockAggregate();
    }
  }),
});
