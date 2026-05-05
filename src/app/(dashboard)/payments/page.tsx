"use client";

import { format } from "date-fns";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { formatINR } from "@/lib/utils";
import Link from "next/link";

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  upi: "UPI",
  cash: "Cash",
  cheque: "Cheque",
};

export default function PaymentsPage() {
  const { data: payments, isLoading } = trpc.payments.list.useQuery({ limit: 100 });

  const total = payments?.reduce((sum, p) => sum + parseFloat(p.amount), 0) ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-fg">Payments</h1>
          <p className="text-[13px] text-fg-muted">All receipts recorded against invoices</p>
        </div>
        {!isLoading && payments && (
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-fg-muted">Total Received</p>
            <p className="text-lg font-mono font-semibold text-positive tabular-nums">
              {formatINR(total)}
            </p>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <ShimmerSkeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          ) : !payments?.length ? (
            <div className="py-16 text-center text-[13px] text-fg-muted">
              No payments recorded yet.{" "}
              <Link href="/invoices" className="text-accent hover:underline">
                Go to Invoices
              </Link>{" "}
              to record a payment.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-[12px] text-fg-muted tabular-nums">
                      {format(new Date(payment.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-fg">
                      {payment.contactName ?? <span className="text-fg-muted">—</span>}
                    </TableCell>
                    <TableCell>
                      {payment.invoiceNumber ? (
                        <Link
                          href={`/invoices/${payment.appliedToId}`}
                          className="font-mono text-[12px] text-accent hover:underline"
                        >
                          {payment.invoiceNumber}
                        </Link>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-fg-muted">
                      {METHOD_LABELS[payment.method] ?? payment.method}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-fg-muted">
                      {payment.reference ?? <span>—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold text-positive">
                      {formatINR(parseFloat(payment.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
