"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
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
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  type: z.enum(["good", "service"]),
  hsnCode: z.string().optional(),
  sacCode: z.string().optional(),
  defaultRate: z.string(),
});

type FormValues = z.infer<typeof schema>;

export default function EditItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: item, isLoading } = trpc.items.get.useQuery({ id: params.id });

  const updateMutation = trpc.items.update.useMutation({
    onSuccess: () => {
      toast.success("Item updated");
      router.push("/items");
    },
    onError: (err) => toast.error(err.message),
  });

  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "service", defaultRate: "0" },
  });

  const itemType = watch("type");

  useEffect(() => {
    if (item) {
      reset({
        name: item.name,
        description: item.description ?? "",
        type: item.type,
        hsnCode: item.hsnCode ?? "",
        sacCode: item.sacCode ?? "",
        defaultRate: item.defaultRate ?? "0",
      });
    }
  }, [item, reset]);

  const onSubmit = (data: FormValues) => {
    updateMutation.mutate({ id: params.id, ...data });
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <ShimmerSkeleton className="h-8 w-48" />
        <ShimmerSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!item) {
    return <div className="text-fg-muted text-[13px]">Item not found</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/items" className="text-fg-muted hover:text-fg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-semibold text-fg">Edit Item</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Item Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  defaultValue={item.type}
                  onValueChange={(v) => setValue("type", v as "good" | "service")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input {...register("name")} />
                {errors.name && <p className="text-[12px] text-negative">{errors.name.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...register("description")} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{itemType === "service" ? "SAC Code" : "HSN Code"}</Label>
                <Input
                  {...register(itemType === "service" ? "sacCode" : "hsnCode")}
                  className="font-mono"
                  placeholder={itemType === "service" ? "998314" : "85176200"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Default Rate (₹)</Label>
                <Input {...register("defaultRate")} type="number" min="0" step="0.01" className="font-mono" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link href="/items">Cancel</Link>
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
