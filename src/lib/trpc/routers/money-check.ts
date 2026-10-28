import { router, protectedProcedure } from "../init";
import { computeMoneyCheck } from "@/lib/ai/money-check";

export const moneyCheckRouter = router({
  // The "Monday money check" agent message, assembled from real data.
  // Viewable by any member, including a read-only CA.
  get: protectedProcedure.query(async ({ ctx }) => {
    return computeMoneyCheck(ctx.orgId);
  }),
});
