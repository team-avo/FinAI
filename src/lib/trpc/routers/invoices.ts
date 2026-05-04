import { z } from "zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { contacts, invoiceLines, invoices, organizations, payments } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";
import { calculateLineGST, isInterstateSale, summariseInvoiceTax } from "@/lib/accounting/gst";
import { postInvoice, postPaymentReceipt, getAccountByCode } from "@/lib/accounting/journal";
import { createId } from "@/lib/db/utils";

const invoiceLineInput = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1),
  hsnCode: z.string().optional(),
  quantity: z.string().default("1"),
  rate: z.string(),
  taxRate: z.string().default("0"),
});

export const invoicesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled", "partial", "all"]).optional(),
        contactId: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(invoices.orgId, ctx.orgId)];

      if (input.status && input.status !== "all") {
        conditions.push(eq(invoices.status, input.status));
      }

      if (input.contactId) {
        conditions.push(eq(invoices.contactId, input.contactId));
      }

      const rows = await db
        .select()
        .from(invoices)
        .where(and(...conditions))
        .orderBy(desc(invoices.issueDate))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, input.id), eq(invoices.orgId, ctx.orgId)))
        .limit(1);

      if (!invoice) return null;

      const lines = await db
        .select()
        .from(invoiceLines)
        .where(eq(invoiceLines.invoiceId, invoice.id))
        .orderBy(asc(invoiceLines.sortOrder));

      return { ...invoice, lines };
    }),

  create: protectedProcedure
    .input(
      z.object({
        contactId: z.string().optional(),
        contactName: z.string().min(1),
        contactEmail: z.string().email().optional().or(z.literal("")),
        contactGstin: z.string().optional(),
        billingAddress: z.string().optional(),
        issueDate: z.string(),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
        lines: z.array(invoiceLineInput).min(1),
        incomeAccountId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [org] = await db
        .select({ gstin: organizations.gstin })
        .from(organizations)
        .where(eq(organizations.id, ctx.orgId))
        .limit(1);

      const interstate = isInterstateSale(org?.gstin, input.contactGstin);

      const taxLines = input.lines.map((line) => ({
        quantity: parseFloat(line.quantity),
        rate: parseFloat(line.rate),
        gstRate: parseFloat(line.taxRate),
      }));

      const summary = summariseInvoiceTax(taxLines, interstate);

      const count = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(invoices)
        .where(eq(invoices.orgId, ctx.orgId));

      const nextNum = (count[0]?.count ?? 0) + 1;
      const invoiceNumber = `INV-${String(nextNum).padStart(4, "0")}`;

      const [invoice] = await db
        .insert(invoices)
        .values({
          orgId: ctx.orgId,
          number: invoiceNumber,
          contactId: input.contactId,
          contactName: input.contactName,
          contactEmail: input.contactEmail || null,
          contactGstin: input.contactGstin,
          billingAddress: input.billingAddress,
          issueDate: new Date(input.issueDate),
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes,
          status: "draft",
          subtotal: String(summary.subtotal),
          cgstAmount: String(summary.cgst),
          sgstAmount: String(summary.sgst),
          igstAmount: String(summary.igst),
          totalTax: String(summary.totalTax),
          total: String(summary.total),
          amountPaid: "0",
          amountDue: String(summary.total),
          isInterstate: interstate ? 1 : 0,
        })
        .returning();

      const lineInserts = input.lines.map((line, i) => {
        const gst = calculateLineGST(
          parseFloat(line.quantity),
          parseFloat(line.rate),
          parseFloat(line.taxRate),
          interstate,
        );

        return {
          id: createId(),
          invoiceId: invoice.id,
          itemId: line.itemId,
          description: line.description,
          hsnCode: line.hsnCode,
          quantity: line.quantity,
          rate: line.rate,
          taxRate: line.taxRate,
          cgstRate: String(gst.cgstRate),
          sgstRate: String(gst.sgstRate),
          igstRate: String(gst.igstRate),
          taxAmount: String(gst.taxAmount),
          amount: String(gst.lineTotal),
          sortOrder: i,
        };
      });

      await db.insert(invoiceLines).values(lineInserts);

      let incomeAccountId = input.incomeAccountId;
      if (!incomeAccountId) {
        incomeAccountId = (await getAccountByCode(ctx.orgId, "4100")) ?? undefined;
      }

      if (incomeAccountId) {
        const entryId = await postInvoice({
          orgId: ctx.orgId,
          invoiceId: invoice.id,
          date: new Date(input.issueDate),
          subtotal: summary.subtotal,
          cgst: summary.cgst,
          sgst: summary.sgst,
          igst: summary.igst,
          total: summary.total,
          contactName: input.contactName,
          incomeAccountId,
        });

        await db
          .update(invoices)
          .set({ journalEntryId: entryId })
          .where(eq(invoices.id, invoice.id));
      }

      return invoice;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled", "partial"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [invoice] = await db
        .update(invoices)
        .set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(invoices.id, input.id), eq(invoices.orgId, ctx.orgId)))
        .returning();

      return invoice;
    }),

  recordPayment: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        date: z.string(),
        amount: z.number().positive(),
        method: z.string().default("bank_transfer"),
        reference: z.string().optional(),
        bankAccountId: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.orgId, ctx.orgId)))
        .limit(1);

      if (!invoice) throw new Error("Invoice not found");

      const contact = invoice.contactId
        ? await db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, invoice.contactId)).limit(1).then((r) => r[0])
        : null;

      const paymentDate = new Date(input.date);
      const newAmountPaid = parseFloat(invoice.amountPaid) + input.amount;
      const newAmountDue = parseFloat(invoice.total) - newAmountPaid;
      const newStatus = newAmountDue <= 0 ? "paid" : "partial";

      const [payment] = await db
        .insert(payments)
        .values({
          orgId: ctx.orgId,
          contactId: invoice.contactId,
          date: paymentDate,
          amount: String(input.amount),
          method: input.method,
          reference: input.reference,
          type: "receipt",
          appliedToId: invoice.id,
          appliedToType: "invoice",
          notes: input.notes,
        })
        .returning();

      await db
        .update(invoices)
        .set({
          amountPaid: String(newAmountPaid),
          amountDue: String(Math.max(0, newAmountDue)),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoice.id));

      const entryId = await postPaymentReceipt({
        orgId: ctx.orgId,
        paymentId: payment.id,
        date: paymentDate,
        amount: input.amount,
        contactName: contact?.name ?? invoice.contactName,
        bankAccountId: input.bankAccountId,
      });

      await db
        .update(payments)
        .set({ journalEntryId: entryId })
        .where(eq(payments.id, payment.id));

      return payment;
    }),

  getLines: protectedProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [invoice] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.orgId, ctx.orgId)))
        .limit(1);

      if (!invoice) return [];

      return db
        .select()
        .from(invoiceLines)
        .where(eq(invoiceLines.invoiceId, input.invoiceId))
        .orderBy(asc(invoiceLines.sortOrder));
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN status = 'paid' THEN total::numeric ELSE 0 END), 0)`,
        outstanding: sql<string>`COALESCE(SUM(CASE WHEN status IN ('sent','overdue','partial') THEN amount_due::numeric ELSE 0 END), 0)`,
        draft: sql<number>`COUNT(CASE WHEN status = 'draft' THEN 1 END)::int`,
        overdue: sql<number>`COUNT(CASE WHEN status = 'overdue' THEN 1 END)::int`,
      })
      .from(invoices)
      .where(eq(invoices.orgId, ctx.orgId));

    return row;
  }),
});
