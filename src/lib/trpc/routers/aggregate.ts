import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiActivityLog } from "@/lib/db/schema";
import { router, publicProcedure } from "../init";
import { getOrBuildAggregate } from "@/lib/zoho/aggregator";
import { getMockAggregate } from "@/lib/mock/zoho-aggregate";
import type { AIActivityItem } from "@/lib/dashboard/types";

const ORG_ID = "advertout";

async function fetchAIActivity(): Promise<AIActivityItem[]> {
  const rows = await db
    .select()
    .from(aiActivityLog)
    .where(eq(aiActivityLog.orgId, ORG_ID))
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
      description = `Approved pending expense`;
    } else if (r.action.includes("approval:rejected")) {
      description = `Rejected pending expense`;
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
      status: r.success ? "success" as const : "reverted" as const,
      source: r.actor === "ai_whatsapp" ? "whatsapp" as const
        : r.actor === "cron" ? "auto" as const
        : "chat" as const,
    };
  });
}

/**
 * Single endpoint that returns the entire dashboard aggregate.
 *
 * Strategy:
 *   1. If Zoho env is configured → read from Zoho aggregator (cache or build).
 *   2. If not configured OR the build fails → fall back to deterministic mock
 *      so the dashboard never goes blank.
 *
 * In both cases, aiActivity is merged from the local aiActivityLog table.
 */
export const aggregateRouter = router({
  get: publicProcedure.query(async () => {
    const zohoConfigured =
      !!process.env.ZOHO_REFRESH_TOKEN &&
      !!process.env.ZOHO_CLIENT_ID &&
      !!process.env.ZOHO_CLIENT_SECRET &&
      !!process.env.ZOHO_ORG_ID;

    let aggregate = zohoConfigured
      ? await getOrBuildAggregate().catch(() => getMockAggregate())
      : getMockAggregate();

    const aiActivity = await fetchAIActivity();
    if (aiActivity.length > 0) {
      aggregate = { ...aggregate, aiActivity };
    }

    return aggregate;
  }),
});
