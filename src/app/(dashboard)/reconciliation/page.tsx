"use client";

import { useMemo, useRef, useState } from "react";
import { format, subMonths } from "date-fns";
import { ShieldCheck, Upload, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

export default function ReconciliationPage() {
  const periods = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, i);
      return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
    });
  }, []);

  const [period, setPeriod] = useState(periods[1]?.value ?? periods[0].value);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const imported = trpc.gst2b.list.useQuery({ period });
  const recon = trpc.gst2b.reconcile.useQuery({ period });

  const upload = trpc.gst2b.upload.useMutation({
    onSuccess: (r) => {
      toast.success(`Imported ${r.imported} invoices from your GSTR-2B`);
      utils.gst2b.list.invalidate();
      utils.gst2b.reconcile.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      upload.mutate({ period, data });
    } catch {
      toast.error("That doesn't look like a valid GSTR-2B JSON file.");
    }
  }

  const r = recon.data;
  const atRiskTotal = r ? r.itc.atRisk + r.itc.mismatch + r.itc.needsDetail : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-fg flex items-center gap-2">
            <ShieldCheck className="size-4 text-fg-muted" /> GST input credit
          </h1>
          <p className="text-[13px] text-fg-muted">
            Match your purchases against the government&apos;s GSTR-2B and catch credit at risk before the 30&nbsp;November deadline.
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periods.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Import your GSTR-2B</CardTitle>
          <CardDescription>
            Download the GSTR-2B JSON for this period from the GST portal (Returns → GSTR-2B → Download), then drop it here.
            {imported.data && imported.data.length > 0 && (
              <> Currently loaded: <b className="text-fg">{imported.data.length} invoices</b>.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
          <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending} variant="secondary">
            <Upload className="size-4" />
            {upload.isPending ? "Importing…" : imported.data?.length ? "Replace GSTR-2B" : "Upload GSTR-2B"}
          </Button>
        </CardContent>
      </Card>

      {recon.isLoading ? (
        <ShimmerSkeleton className="h-40 w-full" />
      ) : !r || !r.hasData ? (
        <Card>
          <CardContent className="py-10 text-center text-[13px] text-fg-muted">
            No GSTR-2B loaded for {periods.find((p) => p.value === period)?.label ?? period} yet.
            Upload it above to see what&apos;s matched and what&apos;s at risk.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-5">
                <div className="text-[11px] uppercase tracking-wide text-fg-muted flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" /> Input credit at risk
                </div>
                <div className="text-2xl font-bold text-red-500 mt-1 tabular-nums">{formatINR(atRiskTotal)}</div>
                <div className="text-[12px] text-fg-muted mt-1">
                  {r.counts.inBooksNot2b + r.counts.mismatch} invoice{r.counts.inBooksNot2b + r.counts.mismatch === 1 ? "" : "s"} · claim before 30 Nov
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-[11px] uppercase tracking-wide text-fg-muted">Safe to claim</div>
                <div className="text-2xl font-bold text-emerald-500 mt-1 tabular-nums">{formatINR(r.itc.claimable)}</div>
                <div className="text-[12px] text-fg-muted mt-1">{r.counts.matched} matched invoice{r.counts.matched === 1 ? "" : "s"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-[11px] uppercase tracking-wide text-fg-muted">Not in your books</div>
                <div className="text-2xl font-bold text-fg mt-1 tabular-nums">{r.counts.in2bNotBooks}</div>
                <div className="text-[12px] text-fg-muted mt-1">purchases in 2B to record</div>
              </CardContent>
            </Card>
          </div>

          {/* At risk */}
          <ReconTable
            title="At risk — recorded, but not in GSTR-2B"
            empty="Nothing at risk — every recorded purchase is in the 2B."
            badge="negative"
            rows={r.atRiskLines.map((l) => ({
              a: l.vendorName || l.gstin, b: l.invoiceNumber, c: l.gstin,
              d: formatINR(l.itcAtRisk), dClass: "text-red-500",
            }))}
            cols={["Supplier", "Invoice", "GSTIN", "ITC at risk"]}
          />

          {/* Mismatches */}
          {r.mismatchLines.length > 0 && (
            <ReconTable
              title="Mismatches — same invoice, different tax"
              empty=""
              badge="warning"
              rows={r.mismatchLines.map((l) => ({
                a: l.vendorName || l.gstin, b: l.invoiceNumber,
                c: `${formatINR(l.booksTax ?? 0)} vs ${formatINR(l.twoBTax ?? 0)}`,
                d: formatINR(l.itcAtRisk), dClass: "text-amber-500",
              }))}
              cols={["Supplier", "Invoice", "Books vs 2B", "Shortfall"]}
            />
          )}

          {/* Missing from books */}
          {r.missingInBooks.length > 0 && (
            <ReconTable
              title="In GSTR-2B but not in your books"
              empty=""
              badge="info"
              rows={r.missingInBooks.map((l) => ({
                a: l.vendorName || l.gstin, b: l.invoiceNumber, c: l.gstin,
                d: formatINR(l.twoBTax ?? 0), dClass: "text-fg",
              }))}
              cols={["Supplier", "Invoice", "GSTIN", "GST in 2B"]}
            />
          )}
        </>
      )}
    </div>
  );
}

function ReconTable({
  title, cols, rows, empty, badge,
}: {
  title: string;
  cols: string[];
  rows: { a: string; b: string; c: string; d: string; dClass?: string }[];
  empty: string;
  badge: "negative" | "warning" | "info";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {title}
          <Badge variant={badge}>{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-[13px] text-fg-muted">{empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {cols.map((c, i) => <TableHead key={c} className={i === 3 ? "text-right" : ""}>{c}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.a}</TableCell>
                  <TableCell className="text-fg-muted">{row.b}</TableCell>
                  <TableCell className="text-fg-muted font-mono text-[12px]">{row.c}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${row.dClass ?? ""}`}>{row.d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
