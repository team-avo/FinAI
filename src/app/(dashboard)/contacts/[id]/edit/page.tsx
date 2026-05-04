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
  type: z.enum(["customer", "vendor", "both"]),
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(15).optional(),
  gstin: z.string().max(15).optional(),
  pan: z.string().max(10).optional(),
  billingAddress: z.string().optional(),
  billingCity: z.string().max(100).optional(),
  billingState: z.string().max(100).optional(),
  billingStateCode: z.string().max(2).optional(),
  billingPincode: z.string().max(6).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function EditContactPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: contact, isLoading } = trpc.contacts.get.useQuery({ id: params.id });

  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success("Contact updated");
      router.push(`/contacts/${params.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "customer" },
  });

  useEffect(() => {
    if (contact) {
      reset({
        type: contact.type,
        name: contact.name,
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        gstin: contact.gstin ?? "",
        pan: contact.pan ?? "",
        billingAddress: contact.billingAddress ?? "",
        billingCity: contact.billingCity ?? "",
        billingState: contact.billingState ?? "",
        billingStateCode: contact.billingStateCode ?? "",
        billingPincode: contact.billingPincode ?? "",
        notes: contact.notes ?? "",
      });
    }
  }, [contact, reset]);

  const onSubmit = (data: FormValues) => {
    updateMutation.mutate({ id: params.id, ...data, email: data.email || undefined });
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <ShimmerSkeleton className="h-8 w-48" />
        <ShimmerSkeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!contact) {
    return <div className="text-fg-muted text-[13px]">Contact not found</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/contacts/${params.id}`} className="text-fg-muted hover:text-fg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-semibold text-fg">Edit Contact</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select defaultValue={contact.type} onValueChange={(v) => setValue("type", v as "customer" | "vendor" | "both")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input {...register("name")} />
                {errors.name && <p className="text-[12px] text-negative">{errors.name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...register("email")} type="email" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register("phone")} className="font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input {...register("gstin")} className="font-mono uppercase" placeholder="29AABCU9603R1ZX" />
              </div>
              <div className="space-y-1.5">
                <Label>PAN</Label>
                <Input {...register("pan")} className="font-mono uppercase" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Billing Address</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea {...register("billingAddress")} rows={2} placeholder="Street address..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input {...register("billingCity")} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input {...register("billingState")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>State Code</Label>
                <Input {...register("billingStateCode")} className="font-mono" placeholder="29" maxLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Pincode</Label>
                <Input {...register("billingPincode")} className="font-mono" maxLength={6} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea {...register("notes")} rows={3} placeholder="Internal notes..." />
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" asChild>
            <Link href={`/contacts/${params.id}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
