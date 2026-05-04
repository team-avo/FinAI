"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Bot, CreditCard, MoreHorizontal, Plus, RotateCcw, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { GridBg } from "@/components/effects/grid-bg";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  email: "Email",
  ocr_upload: "Bill Scan",
};

export default function ExpensesPage() {
  const [showAiOnly, setShowAiOnly] = useState(false);
  const { data: expenses, isLoading, refetch } = trpc.expenses.list.useQuery({});

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => { toast.success("Expense deleted"); refetch(); },
    onError: () => toast.error("Failed to delete"),
  });

  const revertMutation = trpc.expenses.revert.useMutation({
    onSuccess: () => { toast.success("AI entry reverted and removed from books"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const filtered = showAiOnly
    ? expenses?.filter((e) => e.aiCategorized)
    : expenses;

  const aiCount = expenses?.filter((e) => e.aiCategorized).length ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-fg">Expenses</h1>
          <p className="text-[13px] text-fg-muted">{expenses?.length ?? "—"} records</p>
        </div>
        <div className="flex items-center gap-2">
          {aiCount > 0 && (
            <button
              onClick={() => setShowAiOnly(!showAiOnly)}
              className={cn(
                "flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] font-mono transition-colors",
                showAiOnly
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              <Bot className="h-3 w-3" />
              {aiCount} AI entries
            </button>
          )}
          <Button asChild size="sm">
            <Link href="/expenses/new"><Plus className="h-3.5 w-3.5 mr-1" /> Record Expense</Link>
          </Button>
        </div>
      </div>

      {showAiOnly && (
        <div className="flex items-center gap-2 rounded border border-accent/30 bg-accent/5 px-3 py-2 text-[12px] text-accent">
          <Bot className="h-3.5 w-3.5 shrink-0" />
          Showing AI-posted entries only. These can be reverted in one click.
        </div>
      )}

      <div className="rounded-md border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <ShimmerSkeleton key={i} className="h-8 rounded" />
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="relative h-[280px] flex flex-col items-center justify-center">
            <GridBg className="opacity-30" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <CreditCard className="h-8 w-8 text-fg-muted" />
              <p className="text-[13px] text-fg-muted">
                {showAiOnly ? "No AI-posted entries" : "No expenses recorded"}
              </p>
              {!showAiOnly && (
                <Button asChild size="sm">
                  <Link href="/expenses/new"><Plus className="h-3.5 w-3.5 mr-1" /> Record Expense</Link>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((exp) => (
                <TableRow
                  key={exp.id}
                  className={cn(exp.aiCategorized && "bg-accent/[0.02] hover:bg-accent/[0.04]")}
                >
                  <TableCell className="font-mono text-[12px] text-fg-muted">
                    {format(new Date(exp.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-medium text-fg">
                    <div className="flex items-center gap-1.5">
                      {exp.aiCategorized && (
                        <Bot className="h-3 w-3 text-accent shrink-0" aria-label="AI-posted entry" />
                      )}
                      {exp.vendorName ?? <span className="text-fg-muted italic">Unknown</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-fg-muted">
                    {exp.accountName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        exp.source === "whatsapp"
                          ? "accent"
                          : exp.source === "ocr_upload"
                            ? "info"
                            : "default"
                      }
                    >
                      {SOURCE_LABELS[exp.source] ?? exp.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatINR(parseFloat(exp.amount))}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-medium text-negative">
                    {formatINR(parseFloat(exp.totalAmount))}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-bg-subtle text-fg-muted hover:text-fg transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {exp.aiCategorized && (
                          <>
                            <DropdownMenuItem
                              className="text-accent focus:text-accent"
                              onClick={() =>
                                confirm("Revert this AI-posted entry? This will delete the expense and remove it from the accounting journal.") &&
                                revertMutation.mutate({ id: exp.id })
                              }
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Revert AI Entry
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          className="text-negative focus:text-negative"
                          onClick={() => confirm("Delete this expense?") && deleteMutation.mutate({ id: exp.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
