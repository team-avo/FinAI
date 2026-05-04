"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CreditCard, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { GridBg } from "@/components/effects/grid-bg";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

export default function ExpensesPage() {
  const { data: expenses, isLoading, refetch } = trpc.expenses.list.useQuery({});
  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => { toast.success("Expense deleted"); refetch(); },
    onError: () => toast.error("Failed to delete"),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-fg">Expenses</h1>
          <p className="text-[13px] text-fg-muted">{expenses?.length ?? "—"} records</p>
        </div>
        <Button asChild size="sm">
          <Link href="/expenses/new"><Plus className="h-3.5 w-3.5" /> Record Expense</Link>
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <ShimmerSkeleton key={i} className="h-8 rounded" />
            ))}
          </div>
        ) : expenses?.length === 0 ? (
          <div className="relative h-[280px] flex flex-col items-center justify-center">
            <GridBg className="opacity-30" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <CreditCard className="h-8 w-8 text-fg-muted" />
              <p className="text-[13px] text-fg-muted">No expenses recorded</p>
              <Button asChild size="sm">
                <Link href="/expenses/new"><Plus className="h-3.5 w-3.5" /> Record Expense</Link>
              </Button>
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
              {expenses?.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-mono text-[12px] text-fg-muted">
                    {format(new Date(exp.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-medium text-fg">
                    {exp.vendorName ?? <span className="text-fg-muted italic">Unknown</span>}
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
                      {exp.source}
                    </Badge>
                    {exp.aiCategorized && (
                      <span className="ml-1 text-[10px] text-accent font-mono">AI</span>
                    )}
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
