"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";
import { calculateLineGST, summariseInvoiceTax } from "@/lib/accounting/gst";
import { toast } from "sonner";
import { useMemo } from "react";

const lineSchema = z.object({
  description: z.string().min(1, "Description is required"),
  hsnCode: z.string().optional(),
  quantity: z.string(),
  rate: z.string().min(1, "Rate is required"),
  taxRate: z.string(),
});

const schema = z.object({
  contactName: z.string().min(1, "Customer is required"),
  contactGstin: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  billingAddress: z.string().optional(),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

const GST_RATES = ["0", "5", "12", "18", "28"];

export default function NewInvoicePage() {
  const router = useRouter();
  const contacts = trpc.contacts.search.useQuery({ query: "", type: "customer" }, { enabled: true });
  const incomeAccounts = trpc.settings.incomeAccounts.useQuery();

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: (inv) => {
      toast.success(`Invoice ${inv.number} created`);
      router.push(`/invoices/${inv.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      issueDate: new Date().toISOString().split("T")[0],
      lines: [{ description: "", quantity: "1", rate: "", taxRate: "18" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = watch("lines");
  const contactGstin = watch("contactGstin");

  const summary = useMemo(() => {
    const taxLines = lines.map((l) => ({
      quantity: parseFloat(l.quantity || "1"),
      rate: parseFloat(l.rate || "0"),
      gstRate: parseFloat(l.taxRate || "0"),
    }));
    return summariseInvoiceTax(taxLines, false);
  }, [lines]);

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({
      ...data,
      incomeAccountId: incomeAccounts.data?.[0]?.id,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/invoices" className="text-fg-muted hover:text-fg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-semibold text-fg">New Invoice</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Customer Name *</Label>
                    <Input {...register("contactName")} placeholder="Acme Corp" />
                    {errors.contactName && (
                      <p className="text-[12px] text-negative">{errors.contactName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Customer GSTIN</Label>
                    <Input
                      {...register("contactGstin")}
                      placeholder="29AABCU9603R1ZX"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Customer Email</Label>
                    <Input {...register("contactEmail")} type="email" placeholder="billing@acme.com" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Address</Label>
                  <Textarea {...register("billingAddress")} rows={2} placeholder="Customer billing address" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Issue Date *</Label>
                    <Input {...register("issueDate")} type="date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due Date</Label>
                    <Input {...register("dueDate")} type="date" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Line Items</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => append({ description: "", quantity: "1", rate: "", taxRate: "18" })}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Line
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 text-[11px] font-medium uppercase tracking-wider text-fg-muted px-0">
                    <div className="col-span-5">Description</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Rate</div>
                    <div className="col-span-2 text-right">GST %</div>
                    <div className="col-span-1" />
                  </div>

                  {fields.map((field, i) => {
                    const line = lines[i];
                    const gst = calculateLineGST(
                      parseFloat(line?.quantity || "1"),
                      parseFloat(line?.rate || "0"),
                      parseFloat(line?.taxRate || "0"),
                      false,
                    );

                    return (
                      <div key={field.id} className="grid grid-cols-12 gap-2 items-start group">
                        <div className="col-span-5">
                          <Input
                            {...register(`lines.${i}.description`)}
                            placeholder="Service description"
                            className="text-[13px]"
                          />
                          {errors.lines?.[i]?.description && (
                            <p className="text-[11px] text-negative mt-0.5">
                              {errors.lines[i].description?.message}
                            </p>
                          )}
                        </div>
                        <div className="col-span-2">
                          <Input
                            {...register(`lines.${i}.quantity`)}
                            type="number"
                            min="0"
                            step="0.001"
                            className="text-center font-mono text-[13px]"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            {...register(`lines.${i}.rate`)}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="text-right font-mono text-[13px]"
                          />
                        </div>
                        <div className="col-span-2">
                          <Select
                            defaultValue="18"
                            onValueChange={(v) => setValue(`lines.${i}.taxRate`, v)}
                          >
                            <SelectTrigger className="font-mono text-[13px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GST_RATES.map((r) => (
                                <SelectItem key={r} value={r}>{r}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1 flex items-center justify-end">
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(i)}
                              className="h-7 w-7 flex items-center justify-center rounded text-fg-muted hover:text-negative hover:bg-negative/10 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Line total */}
                        {parseFloat(line?.rate || "0") > 0 && (
                          <div className="col-span-12 flex justify-end text-[12px] text-fg-muted font-mono">
                            {formatINR(parseFloat(line.quantity || "1") * parseFloat(line.rate || "0"))} + {formatINR(gst.taxAmount)} tax = {formatINR(gst.lineTotal)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea {...register("notes")} rows={2} placeholder="Payment terms, thank you note, etc." />
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-4">
            <Card className="sticky top-16">
              <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <SummaryRow label="Subtotal" value={summary.subtotal} />
                {summary.cgst > 0 && <SummaryRow label="CGST" value={summary.cgst} />}
                {summary.sgst > 0 && <SummaryRow label="SGST" value={summary.sgst} />}
                {summary.igst > 0 && <SummaryRow label="IGST" value={summary.igst} />}
                <div className="border-t border-border pt-2 mt-2">
                  <SummaryRow label="Total" value={summary.total} bold />
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Invoice"}
            </Button>
            <Button type="button" variant="secondary" className="w-full" asChild>
              <Link href="/invoices">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold text-fg" : "text-fg-muted"}`}>
      <span className="text-[13px]">{label}</span>
      <span className="font-mono tabular-nums text-[13px]">{formatINR(value)}</span>
    </div>
  );
}
