"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { FileText, MoreHorizontal, Plus, Search, Send } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { GridBg } from "@/components/effects/grid-bg";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";
import { Eye } from "lucide-react";

const STATUS_FILTERS = ["all", "draft", "sent", "paid", "overdue", "partial"] as const;

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("all");

  const { data: invoices, isLoading, refetch } = trpc.invoices.list.useQuery({
    status: statusFilter,
  });

  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => { toast.success("Invoice updated"); refetch(); },
    onError: () => toast.error("Update failed"),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-fg">Invoices</h1>
          <p className="text-[13px] text-fg-muted">{invoices?.length ?? "—"} invoices</p>
        </div>
        <Button asChild size="sm">
          <Link href="/invoices/new">
            <Plus className="h-3.5 w-3.5" /> New Invoice
          </Link>
        </Button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 h-7 text-[12px] rounded border transition-colors capitalize ${
              statusFilter === s
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-fg-muted hover:text-fg hover:border-border-strong"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <ShimmerSkeleton key={i} className="h-8 rounded" />
            ))}
          </div>
        ) : invoices?.length === 0 ? (
          <div className="relative h-[300px] flex flex-col items-center justify-center">
            <GridBg className="opacity-30" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 text-fg-muted" />
              <p className="text-[13px] text-fg-muted">No invoices found</p>
              <Button asChild size="sm">
                <Link href="/invoices/new"><Plus className="h-3.5 w-3.5" /> Create Invoice</Link>
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices?.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-mono text-[12px] font-medium text-fg hover:text-accent transition-colors"
                    >
                      {inv.number}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium text-fg">{inv.contactName}</TableCell>
                  <TableCell className="font-mono text-[12px] text-fg-muted">
                    {format(new Date(inv.issueDate), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-fg-muted">
                    {inv.dueDate ? format(new Date(inv.dueDate), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatINR(parseFloat(inv.total))}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-negative">
                    {parseFloat(inv.amountDue) > 0
                      ? formatINR(parseFloat(inv.amountDue))
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-bg-subtle text-fg-muted hover:text-fg transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/invoices/${inv.id}`}>
                            <Eye className="h-3.5 w-3.5" /> View
                          </Link>
                        </DropdownMenuItem>
                        {inv.status === "draft" && (
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: inv.id, status: "sent" })}
                          >
                            <Send className="h-3.5 w-3.5" /> Mark as Sent
                          </DropdownMenuItem>
                        )}
                        {["sent", "partial", "overdue"].includes(inv.status) && (
                          <DropdownMenuItem asChild>
                            <Link href={`/invoices/${inv.id}?action=pay`}>
                              Record Payment
                            </Link>
                          </DropdownMenuItem>
                        )}
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
