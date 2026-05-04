import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { chartOfAccounts, expenses, journalEntries, journalLines } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";
import { postExpense, getAccountByCode } from "@/lib/accounting/journal";

export const expensesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        accountId: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(expenses.orgId, ctx.orgId)];

      if (input.from) {
        conditions.push(gte(expenses.date, new Date(input.from)));
      }

      if (input.to) {
        conditions.push(lte(expenses.date, new Date(input.to)));
      }

      if (input.accountId) {
        conditions.push(eq(expenses.accountId, input.accountId));
      }

      const rows = await db
        .select({
          id: expenses.id,
          date: expenses.date,
          vendorName: expenses.vendorName,
          accountId: expenses.accountId,
          accountName: chartOfAccounts.name,
          amount: expenses.amount,
          taxAmount: expenses.taxAmount,
          totalAmount: expenses.totalAmount,
          notes: expenses.notes,
          source: expenses.source,
          aiCategorized: expenses.aiCategorized,
          attachmentId: expenses.attachmentId,
          createdAt: expenses.createdAt,
        })
        .from(expenses)
        .leftJoin(chartOfAccounts, eq(expenses.accountId, chartOfAccounts.id))
        .where(and(...conditions))
        .orderBy(desc(expenses.date))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await db
        .select({
          id: expenses.id,
          date: expenses.date,
          vendorId: expenses.vendorId,
          vendorName: expenses.vendorName,
          accountId: expenses.accountId,
          accountName: chartOfAccounts.name,
          amount: expenses.amount,
          taxAmount: expenses.taxAmount,
          totalAmount: expenses.totalAmount,
          notes: expenses.notes,
          reference: expenses.reference,
          source: expenses.source,
          aiCategorized: expenses.aiCategorized,
          rawOcrData: expenses.rawOcrData,
          attachmentId: expenses.attachmentId,
          journalEntryId: expenses.journalEntryId,
          createdAt: expenses.createdAt,
        })
        .from(expenses)
        .leftJoin(chartOfAccounts, eq(expenses.accountId, chartOfAccounts.id))
        .where(and(eq(expenses.id, input.id), eq(expenses.orgId, ctx.orgId)))
        .limit(1);

      return row ?? null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        date: z.string(),
        vendorName: z.string().optional(),
        accountId: z.string().min(1, "Category is required"),
        amount: z.number().positive(),
        cgst: z.number().min(0).default(0),
        sgst: z.number().min(0).default(0),
        igst: z.number().min(0).default(0),
        notes: z.string().optional(),
        reference: z.string().optional(),
        attachmentId: z.string().optional(),
        bankAccountId: z.string().optional(),
        source: z.enum(["manual", "whatsapp", "email", "ocr_upload"]).default("manual"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const taxAmount = input.cgst + input.sgst + input.igst;
      const totalAmount = input.amount + taxAmount;

      const [expense] = await db
        .insert(expenses)
        .values({
          orgId: ctx.orgId,
          date: new Date(input.date),
          vendorName: input.vendorName,
          accountId: input.accountId,
          amount: String(input.amount),
          taxAmount: String(taxAmount),
          totalAmount: String(totalAmount),
          notes: input.notes,
          reference: input.reference,
          attachmentId: input.attachmentId,
          source: input.source,
        })
        .returning();

      const bankId = input.bankAccountId ?? (await getAccountByCode(ctx.orgId, "1120"));

      if (bankId) {
        const entryId = await postExpense({
          orgId: ctx.orgId,
          expenseId: expense.id,
          date: new Date(input.date),
          amount: input.amount,
          cgst: input.cgst,
          sgst: input.sgst,
          igst: input.igst,
          total: totalAmount,
          expenseAccountId: input.accountId,
          description: input.vendorName ?? input.notes ?? "Expense",
          bankAccountId: bankId,
        });

        await db
          .update(expenses)
          .set({ journalEntryId: entryId })
          .where(eq(expenses.id, expense.id));
      }

      return expense;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        vendorName: z.string().optional(),
        accountId: z.string().optional(),
        notes: z.string().optional(),
        reference: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [expense] = await db
        .update(expenses)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(expenses.id, id), eq(expenses.orgId, ctx.orgId)))
        .returning();

      return expense;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(expenses)
        .where(and(eq(expenses.id, input.id), eq(expenses.orgId, ctx.orgId)));

      return { success: true };
    }),

  stats: protectedProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(expenses.orgId, ctx.orgId)];
      if (input.from) conditions.push(gte(expenses.date, new Date(input.from)));
      if (input.to) conditions.push(lte(expenses.date, new Date(input.to)));

      const [row] = await db
        .select({
          total: sql<string>`COALESCE(SUM(total_amount::numeric), 0)`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(expenses)
        .where(and(...conditions));

      return row;
    }),

  // Revert an AI-posted expense — deletes expense + its journal entry
  revert: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [expense] = await db
        .select({ id: expenses.id, journalEntryId: expenses.journalEntryId, source: expenses.source, aiCategorized: expenses.aiCategorized })
        .from(expenses)
        .where(and(eq(expenses.id, input.id), eq(expenses.orgId, ctx.orgId)))
        .limit(1);

      if (!expense) throw new Error("Expense not found");

      // Delete journal lines first (FK), then journal entry
      if (expense.journalEntryId) {
        await db.delete(journalLines).where(eq(journalLines.entryId, expense.journalEntryId));
        await db.delete(journalEntries).where(eq(journalEntries.id, expense.journalEntryId));
      }

      await db.delete(expenses).where(eq(expenses.id, input.id));

      return { success: true };
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
