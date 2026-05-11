import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiActivityLog } from "@/lib/db/schema";
import { router, publicProcedure } from "../init";
import { findConnectionForUserOrg } from "@/lib/zoho/auth";
import { getOrBuildAggregate } from "@/lib/zoho/aggregator";
import { buildDbAggregate } from "@/lib/db/aggregate";
import type { AIActivityItem, DashboardAggregate } from "@/lib/dashboard/types";

const ORG_ID = "advertout";

async function fetchAIActivity(orgId: string): Promise<AIActivityItem[]> {
  const rows = await db
    .select()
    .from(aiActivityLog)
    .where(eq(aiActivityLog.orgId, orgId))
    .orderBy(desc(aiActivityLog.createdAt))
    .limit(10);

  return rows.map((r) => {
    const out = r.output as Record<string, unknown> | null;
    const inp = r.input as Record<string, unknown> | null;
    let description = "";
    if (r.action.startsWith("tool:createInvoice")) {
      description = `Created invoice${r.entityRef ? ` ${r.entityRef}` : ""}${out?.total ? ` · ₹${Number(out.total).toLocaleString("en-IN")}` : ""}`;
    } else if (r.action.startsWith("tool:recordExpense")) {
      description = `Expense recorded${inp?.vendorName ? ` from ${inp.vendorName}` : ""}${inp?.amount ? ` · ₹${Number(inp.amount).toLocaleString("en-IN")}` : ""}`;
    } else if (r.action.includes("approval:approved")) {
      description = "Approved pending expense";
    } else if (r.action.includes("approval:rejected")) {
      description = "Rejected pending expense";
    } else if (r.action === "anomaly:detected") {
      description = `${out?.anomaliesFound ?? 0} anomal${Number(out?.anomaliesFound) === 1 ? "y" : "ies"} detected`;
    } else if (r.action.includes("briefing:morning")) {
      description = (out?.headline as string) ?? "Daily briefing generated";
    } else if (r.entityRef) {
      description = `${r.entityType ?? ""} · ${r.entityRef}`;
    } else {
      description = r.entityType ?? r.action;
    }
    return {
      id: r.id,
      timestamp: r.createdAt.toISOString(),
      action: r.action,
      description,
      status: r.success ? ("success" as const) : ("reverted" as const),
      source:
        r.actor === "ai_whatsapp"
          ? ("whatsapp" as const)
          : r.actor === "cron"
            ? ("auto" as const)
            : ("chat" as const),
    };
  });
}

/**
 * Dashboard aggregate.
 *
 * Source precedence:
 *   1. Caller has a Zoho connection (or any teammate in the org does) → use the
 *      cached/refreshed Zoho aggregate.
 *   2. Else → build from the local Drizzle tables. This is the honest
 *      "your data so far" view — empty for fresh orgs, populated as soon as
 *      invoices / expenses are recorded via the AI agent.
 *
 * If Zoho is connected but the fetch fails, we fall back to the DB aggregate
 * rather than serving stale mock — the user gets real data either way.
 *
 * Out-of-band: AI activity is always merged from the local aiActivityLog table
 * regardless of source (Zoho doesn't know about FinAI tool calls).
 */
export const aggregateRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    const orgId = ORG_ID;
    let aggregate: DashboardAggregate;
    let source: "zoho" | "db" = "db";

    const connection = await findConnectionForUserOrg(ctx.userId, orgId);

    if (connection) {
      try {
        aggregate = await getOrBuildAggregate(connection);
        source = "zoho";
      } catch (err) {
        console.error("[aggregate] Zoho fetch failed, falling back to DB:", err);
        aggregate = await buildDbAggregate(orgId);
      }
    } else {
      aggregate = await buildDbAggregate(orgId);
    }

    const aiActivity = await fetchAIActivity(orgId);
    if (aiActivity.length > 0) {
      aggregate = { ...aggregate, aiActivity };
    }

    return { ...aggregate, _source: source } as DashboardAggregate & { _source: "zoho" | "db" };
  }),
});
