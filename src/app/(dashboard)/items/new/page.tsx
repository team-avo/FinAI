"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["good", "service"]),
  hsnCode: z.string().optional(),
  sacCode: z.string().optional(),
  defaultRate: z.string(),
});

type FormValues = z.infer<typeof schema>;

export default function NewItemPage() {
  const router = useRouter();
  const settingsQuery = trpc.settings.incomeAccounts.useQuery();

  const createMutation = trpc.items.create.useMutation({
    onSuccess: () => { toast.success("Item created"); router.push("/items"); },
    onError: (err) => toast.error(err.message),
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "service", defaultRate: "0" },
  });

  const type = watch("type");

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/items" className="text-fg-muted hover:text-fg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-semibold text-fg">New Item</h1>
      </div>

      <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Item Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select defaultValue="service" onValueChange={(v) => setValue("type", v as "good" | "service")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input {...register("name")} placeholder="Digital Marketing Services" />
                {errors.name && <p className="text-[12px] text-negative">{errors.name.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...register("description")} placeholder="Brief description..." rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{type === "service" ? "SAC Code" : "HSN Code"}</Label>
                <Input
                  {...register(type === "service" ? "sacCode" : "hsnCode")}
                  placeholder={type === "service" ? "998361" : "84713020"}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Default Rate (₹)</Label>
                <Input
                  {...register("defaultRate")}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link href="/items">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Item"}
          </Button>
        </div>
      </form>
    </div>
  );
}
