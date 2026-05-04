import { z } from "zod";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { items } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";

const itemInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(["good", "service"]).default("service"),
  hsnCode: z.string().max(8).optional(),
  sacCode: z.string().max(6).optional(),
  defaultRate: z.string().default("0"),
  defaultTaxRateId: z.string().optional(),
  incomeAccountId: z.string().optional(),
  expenseAccountId: z.string().optional(),
});

export const itemsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        type: z.enum(["good", "service", "all"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(items.orgId, ctx.orgId)];

      if (input.type && input.type !== "all") {
        conditions.push(eq(items.type, input.type));
      }

      if (input.search) {
        conditions.push(ilike(items.name, `%${input.search}%`));
      }

      return db
        .select()
        .from(items)
        .where(and(...conditions))
        .orderBy(asc(items.name));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [item] = await db
        .select()
        .from(items)
        .where(and(eq(items.id, input.id), eq(items.orgId, ctx.orgId)))
        .limit(1);

      return item ?? null;
    }),

  create: protectedProcedure
    .input(itemInput)
    .mutation(async ({ ctx, input }) => {
      const [item] = await db
        .insert(items)
        .values({ orgId: ctx.orgId, ...input })
        .returning();

      return item;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(itemInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [item] = await db
        .update(items)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(items.id, id), eq(items.orgId, ctx.orgId)))
        .returning();

      return item;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(items)
        .where(and(eq(items.id, input.id), eq(items.orgId, ctx.orgId)));

      return { success: true };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      return db
        .select({
          id: items.id,
          name: items.name,
          type: items.type,
          defaultRate: items.defaultRate,
          hsnCode: items.hsnCode,
          sacCode: items.sacCode,
          incomeAccountId: items.incomeAccountId,
          defaultTaxRateId: items.defaultTaxRateId,
        })
        .from(items)
        .where(
          and(
            eq(items.orgId, ctx.orgId),
            ilike(items.name, `%${input.query}%`),
          ),
        )
        .orderBy(asc(items.name))
        .limit(10);
    }),
});
