import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { getPnLReport, getMonthlyPnL } from "@/lib/accounting/reports/pnl";
import { getOutstandingReceivables, getExpenseBreakdown } from "@/lib/accounting/reports/outstanding";

export const reportsRouter = router({
  pnl: protectedProcedure
    .input(
      z.object({
        from: z.string(),
        to: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getPnLReport(ctx.orgId, new Date(input.from), new Date(input.to));
    }),

  monthlyPnL: protectedProcedure
    .input(z.object({ months: z.number().min(1).max(24).default(6) }))
    .query(async ({ ctx, input }) => {
      return getMonthlyPnL(ctx.orgId, input.months);
    }),

  outstanding: protectedProcedure.query(async ({ ctx }) => {
    return getOutstandingReceivables(ctx.orgId);
  }),

  expenseBreakdown: protectedProcedure
    .input(
      z.object({
        from: z.string(),
        to: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getExpenseBreakdown(ctx.orgId, new Date(input.from), new Date(input.to));
    }),
});
