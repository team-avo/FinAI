import { z } from "zod";
import { type SQL, and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { contacts } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";

const contactInput = z.object({
  type: z.enum(["customer", "vendor", "both"]).default("customer"),
  name: z.string().min(1).max(255),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(15).optional(),
  gstin: z.string().max(15).optional(),
  pan: z.string().max(10).optional(),
  billingAddress: z.string().optional(),
  billingCity: z.string().max(100).optional(),
  billingState: z.string().max(100).optional(),
  billingStateCode: z.string().max(2).optional(),
  billingPincode: z.string().max(6).optional(),
  notes: z.string().optional(),
});

export const contactsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        type: z.enum(["customer", "vendor", "both", "all"]).optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(contacts.orgId, ctx.orgId)];

      if (input.type && input.type !== "all") {
        conditions.push(eq(contacts.type, input.type));
      }

      if (input.search) {
        const term = `%${input.search}%`;
        const searchCond = or(
          ilike(contacts.name, term),
          ilike(contacts.email, term),
          ilike(contacts.gstin, term),
        ) as SQL<unknown>;
        conditions.push(searchCond);
      }

      const rows = await db
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(asc(contacts.name))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, input.id), eq(contacts.orgId, ctx.orgId)))
        .limit(1);

      if (!contact) return null;
      return contact;
    }),

  create: protectedProcedure
    .input(contactInput)
    .mutation(async ({ ctx, input }) => {
      const [contact] = await db
        .insert(contacts)
        .values({
          orgId: ctx.orgId,
          ...input,
          email: input.email || null,
        })
        .returning();

      return contact;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(contactInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [contact] = await db
        .update(contacts)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(contacts.id, id), eq(contacts.orgId, ctx.orgId)))
        .returning();

      return contact;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(contacts)
        .where(and(eq(contacts.id, input.id), eq(contacts.orgId, ctx.orgId)));

      return { success: true };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string(), type: z.enum(["customer", "vendor", "both", "all"]).optional() }))
    .query(async ({ ctx, input }) => {
      const term = `%${input.query}%`;
      const conditions = [
        eq(contacts.orgId, ctx.orgId),
        or(ilike(contacts.name, term), ilike(contacts.email, term)),
      ];

      if (input.type && input.type !== "all") {
        conditions.push(eq(contacts.type, input.type));
      }

      return db
        .select({ id: contacts.id, name: contacts.name, type: contacts.type, email: contacts.email, gstin: contacts.gstin })
        .from(contacts)
        .where(and(...conditions))
        .orderBy(asc(contacts.name))
        .limit(10);
    }),
});
