import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { reconcileItc } from "@/lib/accounting/reports/itc-recon";
import {
  computeSupplierTrust,
  rebuildSupplierNetworkStatsIncremental,
} from "@/lib/accounting/reports/supplier-trust";
import { db } from "@/lib/db/client";
import { gstr2bEntries } from "@/lib/db/schema";
import { parse2b, parse2bDate } from "@/lib/gst/gstr2b-parse";
import { protectedProcedure, router } from "../init";
import { logActivity } from "./activity";

const periodInput = z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM");

export const gst2bRouter = router({
  // Import a GSTR-2B for a period (full GSTN JSON or a flat array). Replaces
  // any existing 2B already stored for that period.
  upload: protectedProcedure
    .input(z.object({ period: periodInput, data: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      const parsed = parse2b(input.data);
      if (parsed.length === 0) {
        throw new Error("No B2B invoices found in that file. Make sure it's a GSTR-2B export.");
      }

      await db
        .delete(gstr2bEntries)
        .where(and(eq(gstr2bEntries.orgId, ctx.orgId), eq(gstr2bEntries.period, input.period)));

      await db.insert(gstr2bEntries).values(
        parsed.map((e) => ({
          orgId: ctx.orgId,
          period: input.period,
          supplierGstin: e.supplierGstin,
          supplierName: e.supplierName,
          invoiceNumber: e.invoiceNumber,
          invoiceDate: parse2bDate(e.invoiceDate),
          taxableValue: String(e.taxableValue),
          cgst: String(e.cgst),
          sgst: String(e.sgst),
          igst: String(e.igst),
          source: "upload" as const,
        })),
      );

      await logActivity({
        orgId: ctx.orgId,
        actor: `user:${ctx.userId}`,
        action: "gstr2b:upload",
        entityType: "gstr2b",
        entityRef: input.period,
        output: { period: input.period, invoices: parsed.length },
      }).catch(() => {});

      // Refresh the cross-business Trust Graph with this org's new filing
      // observations. Incremental: only the GSTINs this upload touches are
      // recomputed (fire-and-forget — the page reads the last materialised copy).
      rebuildSupplierNetworkStatsIncremental().catch(() => {});

      return { period: input.period, imported: parsed.length };
    }),

  list: protectedProcedure
    .input(z.object({ period: periodInput }))
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(gstr2bEntries)
        .where(and(eq(gstr2bEntries.orgId, ctx.orgId), eq(gstr2bEntries.period, input.period)))
        .orderBy(desc(gstr2bEntries.taxableValue));
    }),

  reconcile: protectedProcedure
    .input(z.object({ period: periodInput }))
    .query(async ({ ctx, input }) => {
      return reconcileItc(ctx.orgId, input.period);
    }),

  // Supplier Trust Graph: how reliably each supplier files, scored from our
  // whole reconciliation history. Any member (incl. a read-only CA) can view.
  supplierTrust: protectedProcedure.query(async ({ ctx }) => {
    return computeSupplierTrust(ctx.orgId);
  }),
});
