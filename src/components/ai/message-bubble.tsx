"use client";

import { Bot, User, CheckCircle2, FileText, Receipt, TrendingUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolInvocationPart {
  type: "tool-invocation";
  toolInvocation: {
    toolName: string;
    toolCallId: string;
    state: "call" | "partial-call" | "result";
    args: Record<string, unknown>;
    result?: unknown;
  };
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolInvocations?: ToolInvocationPart["toolInvocation"][];
  createdAt?: Date;
}

const TOOL_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  createInvoice: { icon: FileText, label: "Created invoice" },
  recordExpense: { icon: Receipt, label: "Recorded expense" },
  getPnL: { icon: TrendingUp, label: "P&L report" },
  getThisMonthPnL: { icon: TrendingUp, label: "Monthly P&L" },
  getOutstandingInvoices: { icon: FileText, label: "Outstanding invoices" },
  getExpenseBreakdown: { icon: Receipt, label: "Expense breakdown" },
  findContact: { icon: Search, label: "Contact search" },
  getRecentInvoices: { icon: FileText, label: "Recent invoices" },
  learnVendorCategory: { icon: CheckCircle2, label: "Vendor category saved" },
};

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2.5 mb-4", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
          isUser ? "bg-bg-subtle border border-border" : "bg-accent/10 border border-accent/30",
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-fg-muted" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-accent" />
        )}
      </div>

      <div className={cn("flex flex-col gap-1.5 max-w-[85%]", isUser && "items-end")}>
        {message.toolInvocations?.map((inv, i) => (
          <ToolResultCard key={i} inv={inv} />
        ))}

        {message.content && (
          <div
            className={cn(
              "rounded-md px-3 py-2 text-[13px] leading-relaxed",
              isUser
                ? "bg-bg-elevated border border-border text-fg"
                : "bg-accent/5 border border-accent/20 text-fg",
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolResultCard({ inv }: { inv: ToolInvocationPart["toolInvocation"] }) {
  const meta = TOOL_META[inv.toolName];
  const Icon = meta?.icon ?? CheckCircle2;
  const label = meta?.label ?? inv.toolName;
  const isDone = inv.state === "result";
  const result = inv.result as Record<string, unknown> | string | undefined;

  // Extract a human-readable summary from the result
  let summary: string | null = null;
  if (result) {
    if (typeof result === "string") {
      summary = result.slice(0, 100);
    } else if (typeof result === "object") {
      if ("message" in result && typeof result.message === "string") {
        summary = result.message;
      } else if ("invoiceNumber" in result) {
        summary = `Invoice ${result.invoiceNumber} — ${result.total}`;
      } else if ("totalRevenue" in result) {
        summary = `Revenue ${result.totalRevenue} · Expenses ${result.totalExpenses} · Net ${result.netProfit}`;
      } else if ("totalOutstanding" in result) {
        summary = `${result.totalOutstanding} outstanding`;
      }
    }
  }

  return (
    <div className={cn(
      "flex items-start gap-2 rounded border px-3 py-2 text-[12px]",
      isDone
        ? "bg-positive/5 border-positive/20 text-fg"
        : "bg-accent/5 border-accent/20 text-fg-muted",
    )}>
      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", isDone ? "text-positive" : "text-accent animate-pulse")} />
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {summary && (
          <p className="text-fg-muted mt-0.5 truncate">{summary}</p>
        )}
      </div>
    </div>
  );
}
