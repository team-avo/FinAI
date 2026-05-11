"use client";

import { Activity, CheckCircle2, XCircle, Bot, Webhook, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  "tool:createInvoice": "Created invoice",
  "tool:recordExpense": "Recorded expense",
  "tool:learnVendorCategory": "Learned vendor category",
  "tool:getPnL": "Fetched P&L",
  "tool:getThisMonthPnL": "Fetched monthly P&L",
  "tool:getOutstandingInvoices": "Fetched outstanding invoices",
  "tool:getExpenseBreakdown": "Fetched expense breakdown",
  "tool:findContact": "Searched contacts",
  "tool:getRecentInvoices": "Fetched recent invoices",
  "anomaly:detected": "Anomaly detected",
  "approval:approved": "Approval approved",
  "approval:rejected": "Approval rejected",
};

const ACTOR_ICON: Record<string, React.ReactNode> = {
  ai_web: <Bot className="h-3.5 w-3.5" />,
  ai_whatsapp: <Webhook className="h-3.5 w-3.5" />,
  cron: <Clock className="h-3.5 w-3.5" />,
};

function timeAgo(date: Date | string) {
  const ms = Date.now() - new Date(date).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function actorLabel(actor: string) {
  if (actor.startsWith("user:")) return "User";
  if (actor === "ai_web") return "AI (Web)";
  if (actor === "ai_whatsapp") return "AI (WhatsApp)";
  if (actor === "cron") return "Cron";
  return actor;
}

export default function ActivityPage() {
  const { data: items, isLoading } = trpc.activity.list.useQuery({ limit: 100 });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-fg">AI Activity Log</h1>
        <span className="text-[12px] text-fg-muted">{items?.length ?? 0} entries</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : !items?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-fg-muted">
            <Activity className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No activity yet</p>
            <p className="text-[12px] mt-1 opacity-60">AI tool calls, cron jobs, and approvals will be logged here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {items.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 hover:bg-border/10 transition-colors"
            >
              <span className={cn("shrink-0", entry.success ? "text-positive" : "text-negative")}>
                {entry.success
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <XCircle className="h-3.5 w-3.5" />
                }
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-medium text-fg truncate">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </p>
                  {entry.entityRef && (
                    <span className="text-[11px] text-fg-muted font-mono truncate max-w-[160px]">
                      {entry.entityRef}
                    </span>
                  )}
                </div>
                {entry.errorMessage && (
                  <p className="text-[11px] text-negative mt-0.5 truncate">{entry.errorMessage}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="default" className="text-[10px] gap-1 opacity-70 flex items-center">
                  {ACTOR_ICON[entry.actor] ?? <Bot className="h-3 w-3" />}
                  {actorLabel(entry.actor)}
                </Badge>
                {entry.latencyMs != null && (
                  <span className="text-[10px] text-fg-muted">{entry.latencyMs}ms</span>
                )}
                <span className="text-[11px] text-fg-muted">{timeAgo(entry.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
