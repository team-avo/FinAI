"use client";

import { Fingerprint, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { formatINR } from "@/lib/utils";
import type { SupplierRating } from "@/lib/accounting/reports/supplier-trust";

const RATING: Record<SupplierRating, { label: string; variant: "positive" | "warning" | "negative" }> = {
  reliable: { label: "Reliable", variant: "positive" },
  watch: { label: "Watch", variant: "warning" },
  risky: { label: "Risky", variant: "negative" },
};

function monthLabel(p: string) {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

export default function SuppliersPage() {
  const trust = trpc.gst2b.supplierTrust.useQuery();
  const data = trust.data;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-base font-semibold text-fg flex items-center gap-2">
          <Fingerprint className="size-4 text-fg-muted" /> Supplier trust
        </h1>
        <p className="text-[13px] text-fg-muted">
          How reliably your suppliers file their GST. A supplier who doesn&apos;t file is silently putting your input tax credit at risk.
        </p>
      </div>

      {trust.isLoading ? (
        <ShimmerSkeleton className="h-40 w-full" />
      ) : !data || data.suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-[13px] text-fg-muted">
            No suppliers scored yet. Upload a GSTR-2B on the <b className="text-fg">GST Credit</b> page — once we can
            compare your purchases to the government&apos;s records, every supplier gets scored here.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-5">
                <div className="text-[11px] uppercase tracking-wide text-fg-muted">Suppliers tracked</div>
                <div className="text-2xl font-bold text-fg mt-1 tabular-nums">{data.totals.suppliers}</div>
                <div className="text-[12px] text-fg-muted mt-1">
                  across {data.evaluatedPeriods.length} reconciled month{data.evaluatedPeriods.length === 1 ? "" : "s"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-[11px] uppercase tracking-wide text-fg-muted flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" /> Need watching
                </div>
                <div className="text-2xl font-bold text-red-500 mt-1 tabular-nums">{data.totals.risky}</div>
                <div className="text-[12px] text-fg-muted mt-1">suppliers with risky filing</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-[11px] uppercase tracking-wide text-fg-muted">ITC they&apos;ve put at risk</div>
                <div className="text-2xl font-bold text-amber-500 mt-1 tabular-nums">{formatINR(data.totals.itcAtRisk)}</div>
                <div className="text-[12px] text-fg-muted mt-1">total, across all suppliers</div>
              </CardContent>
            </Card>
          </div>

          {/* Scorecard */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Supplier scorecard</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Filed</TableHead>
                    <TableHead>Reliability</TableHead>
                    <TableHead className="text-right">ITC at risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.suppliers.map((s) => {
                    const r = RATING[s.rating];
                    return (
                      <TableRow key={s.gstin}>
                        <TableCell>
                          <div className="font-medium text-fg">{s.name || s.gstin}</div>
                          <div className="font-mono text-[11px] text-fg-muted">
                            {s.gstin}
                            {s.lastSeen ? ` · last seen ${monthLabel(s.lastSeen)}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-fg-muted tabular-nums">
                          {s.filed}/{s.invoices}
                          {s.mismatched > 0 ? ` · ${s.mismatched} mismatch${s.mismatched === 1 ? "" : "es"}` : ""}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={r.variant}>{r.label}</Badge>
                            <span className="text-[12px] text-fg-muted tabular-nums">{s.score}%</span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${s.itcAtRisk > 0 ? "text-red-500" : "text-fg-muted"}`}
                        >
                          {s.itcAtRisk > 0 ? formatINR(s.itcAtRisk) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-[12px] text-fg-muted leading-relaxed">
            Reliability = the share of a supplier&apos;s invoices that actually showed up in the government&apos;s GSTR-2B.
            Scored only on months you&apos;ve reconciled. Today this reflects your own history — as more businesses join
            FinAI, each supplier&apos;s score will draw on their filing behaviour across every buyer.
          </p>
        </>
      )}
    </div>
  );
}
