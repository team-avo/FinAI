"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  vendorName: z.string().optional(),
  accountId: z.string().min(1, "Category is required"),
  amount: z.string().min(1, "Amount is required"),
  cgst: z.string(),
  sgst: z.string(),
  igst: z.string(),
  notes: z.string().optional(),
  reference: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewExpensePage() {
  const router = useRouter();
  const [ocrLoading, setOcrLoading] = useState(false);
  const expenseAccounts = trpc.expenses.expenseAccounts.useQuery();

  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: () => { toast.success("Expense recorded"); router.push("/expenses"); },
    onError: (err) => toast.error(err.message),
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      cgst: "0",
      sgst: "0",
      igst: "0",
    },
  });

  const amount = watch("amount");
  const cgst = watch("cgst");
  const sgst = watch("sgst");
  const igst = watch("igst");
  const totalTax = (parseFloat(cgst || "0") + parseFloat(sgst || "0") + parseFloat(igst || "0"));
  const total = (parseFloat(amount || "0") + totalTax);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr/parse", { method: "POST", body: formData });
      if (!res.ok) throw new Error("OCR failed");

      const data = await res.json();
      if (data.vendorName) setValue("vendorName", data.vendorName);
      if (data.amount) setValue("amount", String(data.amount));
      if (data.date) setValue("date", data.date);
      if (data.cgst) setValue("cgst", String(data.cgst));
      if (data.sgst) setValue("sgst", String(data.sgst));
      if (data.igst) setValue("igst", String(data.igst));

      toast.success("Bill scanned — please verify the fields");
    } catch {
      toast.error("Failed to scan bill. Please fill manually.");
    } finally {
      setOcrLoading(false);
    }
  }, [setValue]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"], "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({
      ...data,
      amount: parseFloat(data.amount),
      cgst: parseFloat(data.cgst || "0"),
      sgst: parseFloat(data.sgst || "0"),
      igst: parseFloat(data.igst || "0"),
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/expenses" className="text-fg-muted hover:text-fg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-semibold text-fg">Record Expense</h1>
      </div>

      {/* Bill Upload / OCR */}
      <Card>
        <CardHeader><CardTitle>Upload Bill (Optional)</CardTitle></CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              "relative flex flex-col items-center justify-center h-28 rounded border-2 border-dashed border-border",
              "cursor-pointer transition-colors",
              isDragActive && "border-accent bg-accent/5",
              ocrLoading && "pointer-events-none opacity-50",
            )}
          >
            <input {...getInputProps()} />
            {ocrLoading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <p className="text-[12px] text-fg-muted">Scanning with AI...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <Upload className="h-5 w-5 text-fg-muted" />
                <p className="text-[13px] text-fg-muted">
                  {isDragActive ? "Drop it here" : "Drag a bill/receipt or click to upload"}
                </p>
                <p className="text-[11px] text-fg-subtle">JPG, PNG, PDF • AI will auto-fill the form</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Expense Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input {...register("date")} type="date" />
                {errors.date && <p className="text-[12px] text-negative">{errors.date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Vendor / Description</Label>
                <Input {...register("vendorName")} placeholder="Swiggy, AWS, etc." />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select onValueChange={(v) => setValue("accountId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {expenseAccounts.data?.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} — {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountId && <p className="text-[12px] text-negative">{errors.accountId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Base Amount (₹) *</Label>
              <Input
                {...register("amount")}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="font-mono"
              />
              {errors.amount && <p className="text-[12px] text-negative">{errors.amount.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>GST (if applicable)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>CGST (₹)</Label>
                <Input {...register("cgst")} type="number" min="0" step="0.01" className="font-mono" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>SGST (₹)</Label>
                <Input {...register("sgst")} type="number" min="0" step="0.01" className="font-mono" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>IGST (₹)</Label>
                <Input {...register("igst")} type="number" min="0" step="0.01" className="font-mono" placeholder="0.00" />
              </div>
            </div>
            {total > 0 && (
              <div className="flex items-center justify-between rounded bg-bg-subtle px-3 py-2 border border-border">
                <span className="text-[13px] text-fg-muted">Total (including tax)</span>
                <span className="font-mono tabular-nums font-semibold text-fg">{formatINR(total)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Additional Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reference / Invoice #</Label>
              <Input {...register("reference")} placeholder="INV-12345" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register("notes")} rows={2} placeholder="Additional notes..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link href="/expenses">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Saving..." : "Record Expense"}
          </Button>
        </div>
      </form>
    </div>
  );
}
