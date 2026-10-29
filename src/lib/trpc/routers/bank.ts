import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankAccounts } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";
import { getBankProvider } from "@/lib/bank/provider";
import { forecastCash } from "@/lib/accounting/reports/cash-forecast";
import { logActivity } from "./activity";

export const bankRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const [acct] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, ctx.orgId), eq(bankAccounts.connected, true)))
      .limit(1);
    return { connected: !!acct, displayName: acct?.displayName ?? null };
  }),

  // Connect a bank. Sandbox today; a real Account Aggregator consent flow slots
  // in behind the same provider interface later.
  connect: protectedProcedure.mutation(async ({ ctx }) => {
    const snap = await getBankProvider("sandbox").fetchSnapshot();
    await db.delete(bankAccounts).where(eq(bankAccounts.orgId, ctx.orgId));
    await db.insert(bankAccounts).values({
      orgId: ctx.orgId,
      provider: "sandbox",
      displayName: snap.displayName,
      balance: String(snap.balance),
      asOf: snap.asOf,
      connected: true,
    });
    await logActivity({
      orgId: ctx.orgId,
      actor: `user:${ctx.userId}`,
      action: "bank:connect",
      entityType: "bank_account",
      entityRef: snap.displayName,
      output: { provider: "sandbox" },
    }).catch(() => {});
    return { connected: true, displayName: snap.displayName };
  }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await db.delete(bankAccounts).where(eq(bankAccounts.orgId, ctx.orgId));
    return { connected: false };
  }),

  forecast: protectedProcedure.query(async ({ ctx }) => {
    return forecastCash(ctx.orgId);
  }),
});
