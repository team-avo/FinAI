import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { chartOfAccounts, organizations, taxRates } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";

export const settingsRouter = router({
  org: protectedProcedure.query(async ({ ctx }) => {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.orgId))
      .limit(1);

    return org ?? null;
  }),

  updateOrg: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        gstin: z.string().max(15).optional(),
        pan: z.string().max(10).optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        stateCode: z.string().max(2).optional(),
        pincode: z.string().max(6).optional(),
        phone: z.string().max(15).optional(),
        email: z.string().email().optional().or(z.literal("")),
        fiscalYearStart: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [org] = await db
        .update(organizations)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(organizations.id, ctx.orgId))
        .returning();

      return org;
    }),

  coa: protectedProcedure
    .input(z.object({ type: z.enum(["asset", "liability", "income", "expense", "equity", "all"]).optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(chartOfAccounts.orgId, ctx.orgId)];

      if (input.type && input.type !== "all") {
        conditions.push(eq(chartOfAccounts.type, input.type));
      }

      return db
        .select()
        .from(chartOfAccounts)
        .where(and(...conditions))
        .orderBy(chartOfAccounts.code);
    }),

  taxRates: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(taxRates)
      .where(eq(taxRates.orgId, ctx.orgId))
      .orderBy(taxRates.rate);
  }),

  incomeAccounts: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({ id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name })
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.orgId, ctx.orgId),
          eq(chartOfAccounts.type, "income"),
        ),
      )
      .orderBy(chartOfAccounts.code);
  }),

  expenseAccounts: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({ id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name })
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.orgId, ctx.orgId),
          eq(chartOfAccounts.type, "expense"),
        ),
      )
      .orderBy(chartOfAccounts.code);
  }),
});
