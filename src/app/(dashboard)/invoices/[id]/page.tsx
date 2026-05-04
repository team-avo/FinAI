"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Download, Send } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { formatINR } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [payDialogOpen, setPayDialogOpen] = useState(searchParams.get("action") === "pay");

  const { data: invoice, isLoading, refetch } = trpc.invoices.get.useQuery({ id: params.id });
  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
  });
  const recordPayment = trpc.invoices.recordPayment.useMutation({
    onSuccess: () => { toast.success("Payment recorded"); setPayDialogOpen(false); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const payForm = useForm({
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      amount: "",
      method: "bank_transfer",
      reference: "",
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <ShimmerSkeleton className="h-8 w-48 rounded" />
        <ShimmerSkeleton className="h-64 rounded-md" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-fg-muted">Invoice not found</p>
        <Link href="/invoices" className="text-accent text-[13px] hover:underline">← Back to Invoices</Link>
      </div>
    );
  }

  const canRecord = ["sent", "partial", "overdue"].includes(invoice.status);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/invoices" className="text-fg-muted hover:text-fg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 flex items-center gap-3">
          <h1 className="text-base font-semibold font-mono text-fg">{invoice.number}</h1>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="flex gap-2">
          {invoice.status === "draft" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateStatus.mutate({ id: invoice.id, status: "sent" })}
            >
              <Send className="h-3.5 w-3.5" /> Mark Sent
            </Button>
          )}
          {canRecord && (
            <Button size="sm" onClick={() => setPayDialogOpen(true)}>
              Record Payment
            </Button>
          )}
          <Button size="sm" variant="secondary" asChild>
            <a href={`/api/invoices/${invoice.id}/pdf`} download>
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Invoice Info */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-fg-muted mb-1">Bill To</p>
                  <p className="font-medium text-fg">{invoice.contactName}</p>
                  {invoice.contactEmail && <p className="text-[13px] text-fg-muted">{invoice.contactEmail}</p>}
                  {invoice.contactGstin && (
                    <p className="text-[12px] font-mono text-fg-muted mt-0.5">{invoice.contactGstin}</p>
                  )}
                  {invoice.billingAddress && (
                    <p className="text-[13px] text-fg-muted mt-1 whitespace-pre-line">{invoice.billingAddress}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-fg-muted mb-1">Invoice Details</p>
                  <p className="font-mono text-[13px] font-semibold text-fg">{invoice.number}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-[12px] text-fg-muted">
                      Issued: <span className="text-fg font-mono">{format(new Date(invoice.issueDate), "dd MMM yyyy")}</span>
                    </p>
                    {invoice.dueDate && (
                      <p className="text-[12px] text-fg-muted">
                        Due: <span className="text-fg font-mono">{format(new Date(invoice.dueDate), "dd MMM yyyy")}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right w-20">Qty</TableHead>
                    <TableHead className="text-right w-28">Rate</TableHead>
                    <TableHead className="text-right w-24">Tax</TableHead>
                    <TableHead className="text-right w-28">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines?.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <p className="text-fg">{line.description}</p>
                        {line.hsnCode && (
                          <p className="text-[11px] font-mono text-fg-muted">HSN: {line.hsnCode}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{line.quantity}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatINR(parseFloat(line.rate))}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-fg-muted">
                        {formatINR(parseFloat(line.taxAmount))}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium">
                        {formatINR(parseFloat(line.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {invoice.notes && (
            <Card>
              <CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wider text-fg-muted mb-1">Notes</p>
                <p className="text-[13px] text-fg">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary */}
        <div>
          <Card>
            <CardHeader><CardTitle>Amount Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Row label="Subtotal" value={parseFloat(invoice.subtotal)} />
              {parseFloat(invoice.cgstAmount) > 0 && (
                <Row label="CGST" value={parseFloat(invoice.cgstAmount)} />
              )}
              {parseFloat(invoice.sgstAmount) > 0 && (
                <Row label="SGST" value={parseFloat(invoice.sgstAmount)} />
              )}
              {parseFloat(invoice.igstAmount) > 0 && (
                <Row label="IGST" value={parseFloat(invoice.igstAmount)} />
              )}
              <div className="border-t border-border pt-2 mt-2">
                <Row label="Total" value={parseFloat(invoice.total)} bold />
              </div>
              {parseFloat(invoice.amountPaid) > 0 && (
                <>
                  <Row label="Amount Paid" value={parseFloat(invoice.amountPaid)} />
                  <div className="border-t border-border pt-2">
                    <Row
                      label="Amount Due"
                      value={parseFloat(invoice.amountDue)}
                      bold
                      negative={parseFloat(invoice.amountDue) > 0}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={payForm.handleSubmit((data) => {
              recordPayment.mutate({
                invoiceId: invoice.id,
                date: data.date,
                amount: parseFloat(data.amount),
                method: data.method,
                reference: data.reference || undefined,
              });
            })}
            className="space-y-3 p-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input {...payForm.register("date")} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input
                  {...payForm.register("amount")}
                  type="number"
                  step="0.01"
                  placeholder={invoice.amountDue}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select defaultValue="bank_transfer" onValueChange={(v) => payForm.setValue("method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference / UTR (optional)</Label>
              <Input {...payForm.register("reference")} placeholder="UTR123456" className="font-mono" />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setPayDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={recordPayment.isPending}>
                {recordPayment.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold, negative }: { label: string; value: number; bold?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold text-fg" : "text-fg-muted"}`}>
      <span className="text-[13px]">{label}</span>
      <span className={`font-mono tabular-nums text-[13px] ${negative ? "text-negative" : ""}`}>
        {formatINR(value)}
      </span>
    </div>
  );
}
