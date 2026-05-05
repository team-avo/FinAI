import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { contacts, invoices, payments } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";

export const paymentsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select({
          id: payments.id,
          date: payments.date,
          amount: payments.amount,
          method: payments.method,
          reference: payments.reference,
          type: payments.type,
          appliedToId: payments.appliedToId,
          appliedToType: payments.appliedToType,
          notes: payments.notes,
          contactId: payments.contactId,
          contactName: contacts.name,
          invoiceNumber: invoices.number,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .leftJoin(contacts, eq(payments.contactId, contacts.id))
        .leftJoin(invoices, eq(payments.appliedToId, invoices.id))
        .where(eq(payments.orgId, ctx.orgId))
        .orderBy(desc(payments.date))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),
});
