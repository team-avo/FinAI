import { router, protectedProcedure } from "../init";
import { getMockAggregate } from "@/lib/mock/zoho-aggregate";

// Single endpoint that returns the entire dashboard aggregate.
// Mock-backed today; same shape will be served from Redis (populated by
// the Zoho aggregator cron) once Khush hands over Zoho credentials.
export const aggregateRouter = router({
  get: protectedProcedure.query(async () => {
    return getMockAggregate();
  }),
});
