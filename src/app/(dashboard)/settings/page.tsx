"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { toast } from "sonner";
import { useEffect } from "react";

const orgSchema = z.object({
  name: z.string().min(1, "Name is required"),
  gstin: z.string().max(15).optional(),
  pan: z.string().max(10).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().max(2).optional(),
  pincode: z.string().max(6).optional(),
  phone: z.string().max(15).optional(),
  email: z.string().email().optional().or(z.literal("")),
  fiscalYearStart: z.string().optional(),
});

type OrgValues = z.infer<typeof orgSchema>;

export default function SettingsPage() {
  const org = trpc.settings.org.useQuery();
  const coa = trpc.settings.coa.useQuery({ type: "all" });
  const taxRates = trpc.settings.taxRates.useQuery();
  const updateOrg = trpc.settings.updateOrg.useMutation({
    onSuccess: () => { toast.success("Organization updated"); org.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrgValues>({
    resolver: zodResolver(orgSchema),
  });

  useEffect(() => {
    if (org.data) {
      reset({
        name: org.data.name,
        gstin: org.data.gstin ?? "",
        pan: org.data.pan ?? "",
        address: org.data.address ?? "",
        city: org.data.city ?? "",
        state: org.data.state ?? "",
        stateCode: org.data.stateCode ?? "",
        pincode: org.data.pincode ?? "",
        phone: org.data.phone ?? "",
        email: org.data.email ?? "",
        fiscalYearStart: org.data.fiscalYearStart,
      });
    }
  }, [org.data, reset]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-base font-semibold text-fg">Settings</h1>

      <Tabs defaultValue="org">
        <TabsList>
          <TabsTrigger value="org">Organization</TabsTrigger>
          <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="tax">Tax Rates</TabsTrigger>
        </TabsList>

        {/* Organization Tab */}
        <TabsContent value="org">
          <form onSubmit={handleSubmit((data) => updateOrg.mutate(data))} className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Organization Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {org.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <ShimmerSkeleton key={i} className="h-8 rounded" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 col-span-2">
                        <Label>Organization Name *</Label>
                        <Input {...register("name")} placeholder="AdvertOut" />
                        {errors.name && <p className="text-[12px] text-negative">{errors.name.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>GSTIN</Label>
                        <Input {...register("gstin")} placeholder="29AABCU9603R1ZX" className="font-mono" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>PAN</Label>
                        <Input {...register("pan")} placeholder="AABCU9603R" className="font-mono" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Phone</Label>
                        <Input {...register("phone")} placeholder="+91 98765 43210" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input {...register("email")} type="email" placeholder="hello@advertout.in" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Address</Label>
                      <Input {...register("address")} placeholder="Street address" />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>City</Label>
                        <Input {...register("city")} placeholder="Bengaluru" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>State</Label>
                        <Input {...register("state")} placeholder="Karnataka" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Pincode</Label>
                        <Input {...register("pincode")} placeholder="560001" className="font-mono" />
                      </div>
                    </div>

                    <div className="space-y-1.5 max-w-xs">
                      <Label>Fiscal Year Start (MM-DD)</Label>
                      <Input {...register("fiscalYearStart")} placeholder="04-01" className="font-mono" />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateOrg.isPending}>
                {updateOrg.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Chart of Accounts Tab */}
        <TabsContent value="coa">
          <Card>
            <CardHeader><CardTitle>Chart of Accounts</CardTitle></CardHeader>
            <CardContent className="p-0 pb-1">
              {coa.isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => <ShimmerSkeleton key={i} className="h-8 rounded" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>System</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coa.data?.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-mono text-[12px] text-fg-muted">{acc.code}</TableCell>
                        <TableCell className="text-fg">{acc.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              acc.type === "asset" ? "info" :
                              acc.type === "liability" ? "warning" :
                              acc.type === "income" ? "positive" :
                              acc.type === "expense" ? "negative" :
                              "default"
                            }
                          >
                            {acc.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {acc.isSystem && <Badge variant="accent">System</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Rates Tab */}
        <TabsContent value="tax">
          <Card>
            <CardHeader><CardTitle>GST Tax Rates</CardTitle></CardHeader>
            <CardContent className="p-0 pb-1">
              {taxRates.isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <ShimmerSkeleton key={i} className="h-8 rounded" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxRates.data?.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell className="font-medium text-fg">{rate.name}</TableCell>
                        <TableCell>
                          <Badge variant="default">{rate.type.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{rate.rate}%</TableCell>
                        <TableCell>
                          <Badge variant={rate.isActive ? "positive" : "default"}>
                            {rate.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
