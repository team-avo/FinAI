"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Building2, Mail, Phone, MapPin, Pencil, FileText, CreditCard } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();

  const { data: contact, isLoading } = trpc.contacts.get.useQuery({ id: params.id });
  const { data: invoiceList } = trpc.invoices.list.useQuery(
    { contactId: params.id, limit: 20 },
    { enabled: !!params.id },
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ShimmerSkeleton className="h-8 w-48" />
        <ShimmerSkeleton className="h-40 w-full" />
        <ShimmerSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-fg-muted text-[13px]">Contact not found</p>
        <Link href="/contacts" className="mt-3 text-accent text-[13px] hover:underline">
          Back to contacts
        </Link>
      </div>
    );
  }

  const typeColor = contact.type === "customer"
    ? "text-positive border-positive/30 bg-positive/5"
    : contact.type === "vendor"
      ? "text-warning border-warning/30 bg-warning/5"
      : "text-accent border-accent/30 bg-accent/5";

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/contacts" className="text-fg-muted hover:text-fg transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-fg">{contact.name}</h1>
              <Badge
                variant="ghost"
                className={cn("text-[11px] font-mono capitalize", typeColor)}
              >
                {contact.type}
              </Badge>
            </div>
            {contact.gstin && (
              <p className="text-[12px] text-fg-muted font-mono">GSTIN: {contact.gstin}</p>
            )}
          </div>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/contacts/${contact.id}/edit`}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contact Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact Info</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {contact.email && (
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-fg-muted shrink-0" />
                  <a href={`mailto:${contact.email}`} className="text-[13px] text-fg hover:text-accent transition-colors truncate">
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-fg-muted shrink-0" />
                  <span className="text-[13px] text-fg font-mono">{contact.phone}</span>
                </div>
              )}
              {contact.billingAddress && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-fg-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] text-fg">{contact.billingAddress}</p>
                    {(contact.billingCity || contact.billingState) && (
                      <p className="text-[12px] text-fg-muted">
                        {[contact.billingCity, contact.billingState, contact.billingPincode].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {contact.pan && (
                <div className="flex items-center gap-2.5">
                  <CreditCard className="h-4 w-4 text-fg-muted shrink-0" />
                  <span className="text-[13px] text-fg font-mono">{contact.pan}</span>
                </div>
              )}
              {!contact.email && !contact.phone && !contact.billingAddress && (
                <p className="text-[13px] text-fg-subtle">No contact details added</p>
              )}
            </CardContent>
          </Card>

          {contact.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-[13px] text-fg-muted leading-relaxed">{contact.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[12px] text-fg-muted">Added</span>
                <span className="text-[12px] text-fg font-mono">
                  {format(new Date(contact.createdAt), "dd MMM yyyy")}
                </span>
              </div>
              {contact.gstin && (
                <div className="flex justify-between">
                  <span className="text-[12px] text-fg-muted">State Code</span>
                  <span className="text-[12px] text-fg font-mono">{contact.gstin.slice(0, 2)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invoice History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice History
              </CardTitle>
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/invoices/new?contact=${encodeURIComponent(contact.name)}`}>
                  New Invoice
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {!invoiceList || invoiceList.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-fg-muted">
                  No invoices yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceList.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer"
                        onClick={() => window.location.href = `/invoices/${inv.id}`}
                      >
                        <TableCell className="font-mono text-accent">{inv.number}</TableCell>
                        <TableCell className="text-fg-muted">
                          {format(new Date(inv.issueDate), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatINR(parseFloat(inv.total))}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono tabular-nums",
                          parseFloat(inv.amountDue) > 0 ? "text-negative" : "text-positive"
                        )}>
                          {parseFloat(inv.amountDue) > 0 ? formatINR(parseFloat(inv.amountDue)) : "Paid"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
