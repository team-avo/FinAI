"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ClipboardList, Clock, Edit2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/utils";

type StatusFilter = "pending" | "approved" | "rejected" | "edited" | "all";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-500",
  approved: "text-positive",
  rejected: "text-negative",
  edited: "text-accent",
};

const TYPE_LABELS: Record<string, string> = {
  receipt_categorize: "Receipt categorisation",
  invoice_send: "Invoice send",
  expense_record: "Expense record",
  large_categorize: "Large expense",
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

function PayloadSummary({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  if (type === "expense_record") {
    const total = payload.totalAmount as number | undefined;
    const vendor = payload.vendorName as string | undefined;
    const category = payload.categoryDescription as string | undefined;
    return (
      <div className="text-[12px] text-fg-muted mt-1 space-y-0.5">
        {vendor && <p>Vendor: <span className="text-fg font-medium">{vendor}</span></p>}
        {category && <p>Category: <span className="text-fg">{category}</span></p>}
        {total != null && <p>Amount: <span className="text-fg font-semibold">{formatINR(total)}</span></p>}
      </div>
    );
  }
  if (type === "receipt_categorize") {
    const vendor = payload.vendorName as string | undefined;
    const raw = payload.rawText as string | undefined;
    const suggested = payload.suggestedCategory as string | undefined;
    return (
      <div className="text-[12px] text-fg-muted mt-1 space-y-0.5">
        {vendor && vendor !== "Unknown" && <p>Vendor: <span className="text-fg font-medium">{vendor}</span></p>}
        {raw && <p className="line-clamp-2">{raw}</p>}
        {suggested && <p>Suggested: <span className="text-fg">{suggested}</span></p>}
      </div>
    );
  }
  return (
    <pre className="text-[11px] text-fg-muted mt-1 bg-bg-elevated rounded p-1.5 overflow-x-auto max-h-20">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const utils = trpc.useUtils();

  const { data: items, isLoading } = trpc.approvals.list.useQuery({ status: statusFilter, limit: 50 });
  const { data: pendingCount = 0 } = trpc.approvals.pendingCount.useQuery();

  const approve = trpc.approvals.approve.useMutation({
    onSuccess: () => {
      utils.approvals.list.invalidate();
      utils.approvals.pendingCount.invalidate();
    },
  });
  const reject = trpc.approvals.reject.useMutation({
    onSuccess: () => {
      utils.approvals.list.invalidate();
      utils.approvals.pendingCount.invalidate();
    },
  });

  const filters: StatusFilter[] = ["pending", "approved", "rejected", "edited", "all"];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-fg">Approvals</h1>
          {pendingCount > 0 && (
            <Badge variant="warning" className="text-[10px]">{pendingCount} pending</Badge>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={cn(
              "px-3 py-1.5 text-[12px] font-medium capitalize border-b-2 -mb-px transition-colors",
              statusFilter === f
                ? "border-accent text-accent"
                : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerSkeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : !items?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-fg-muted">
            {statusFilter === "pending" ? (
              <>
                <CheckCircle2 className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No pending approvals</p>
                <p className="text-[12px] mt-1 opacity-60">High-value WhatsApp expenses will appear here.</p>
              </>
            ) : (
              <>
                <ClipboardList className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No {statusFilter} items</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const payload = item.payload as Record<string, unknown>;
            const isPending = item.status === "pending";

            return (
              <Card key={item.id} className={cn(isPending && "border-amber-500/30")}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-medium text-fg">
                          {TYPE_LABELS[item.type] ?? item.type}
                        </p>
                        <Badge
                          variant={isPending ? "warning" : item.status === "approved" ? "positive" : "default"}
                          className="text-[10px] capitalize"
                        >
                          {item.status}
                        </Badge>
                        {item.sourceChannel && (
                          <Badge variant="default" className="text-[10px] opacity-60 capitalize">
                            {item.sourceChannel}
                          </Badge>
                        )}
                      </div>
                      <PayloadSummary type={item.type} payload={payload} />
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[11px] text-fg-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(item.createdAt)}
                      </span>
                      {item.confidence > 0 && (
                        <span className="text-[10px] text-fg-muted">
                          {item.confidence}% confidence
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isPending && (
                  <CardContent className="pt-0 pb-3">
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-[12px] gap-1"
                        onClick={() => approve.mutate({ id: item.id })}
                        disabled={approve.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[12px] gap-1 text-negative hover:text-negative"
                        onClick={() => reject.mutate({ id: item.id })}
                        disabled={reject.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
