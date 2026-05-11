"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useEffect, Suspense } from "react";
import { Monitor, Smartphone } from "lucide-react";

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

const profileSchema = z.object({ name: z.string().min(1, "Name is required") });
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword: z.string().min(8, "Minimum 8 characters"),
  confirmPassword: z.string().min(1, "Required"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "org";

  const org = trpc.settings.org.useQuery();
  const coa = trpc.settings.coa.useQuery({ type: "all" });
  const taxRates = trpc.settings.taxRates.useQuery();
  const profile = trpc.settings.profile.useQuery();
  const activeSessions = trpc.settings.activeSessions.useQuery();

  const updateOrg = trpc.settings.updateOrg.useMutation({
    onSuccess: () => { toast.success("Organization updated"); org.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const updateProfile = trpc.settings.updateProfile.useMutation({
    onSuccess: () => { toast.success("Profile updated"); profile.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const changePassword = trpc.settings.changePassword.useMutation({
    onSuccess: () => { toast.success("Password changed"); pwForm.reset(); },
    onError: (err) => toast.error(err.message),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrgValues>({
    resolver: zodResolver(orgSchema),
  });
  const profileForm = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });
  const pwForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    if (profile.data) profileForm.reset({ name: profile.data.name });
  }, [profile.data]);

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

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="org">Organization</TabsTrigger>
          <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="tax">Tax Rates</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          {/* Name */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your display name.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile.isLoading ? (
                <div className="space-y-2">
                  <ShimmerSkeleton className="h-8 w-48 rounded" />
                  <ShimmerSkeleton className="h-8 rounded" />
                </div>
              ) : (
                <form onSubmit={profileForm.handleSubmit((d) => updateProfile.mutate(d))} className="space-y-3 max-w-sm">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input value={profile.data?.email ?? ""} disabled className="text-fg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Name *</Label>
                    <Input {...profileForm.register("name")} placeholder="Your name" />
                    {profileForm.formState.errors.name && (
                      <p className="text-[12px] text-negative">{profileForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <Button type="submit" disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? "Saving..." : "Save"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Minimum 8 characters.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={pwForm.handleSubmit((d) => changePassword.mutate(d))} className="space-y-3 max-w-sm">
                <div className="space-y-1.5">
                  <Label>Current password</Label>
                  <Input {...pwForm.register("currentPassword")} type="password" autoComplete="current-password" />
                  {pwForm.formState.errors.currentPassword && (
                    <p className="text-[12px] text-negative">{pwForm.formState.errors.currentPassword.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>New password</Label>
                  <Input {...pwForm.register("newPassword")} type="password" autoComplete="new-password" />
                  {pwForm.formState.errors.newPassword && (
                    <p className="text-[12px] text-negative">{pwForm.formState.errors.newPassword.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm new password</Label>
                  <Input {...pwForm.register("confirmPassword")} type="password" autoComplete="new-password" />
                  {pwForm.formState.errors.confirmPassword && (
                    <p className="text-[12px] text-negative">{pwForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
                <Button type="submit" disabled={changePassword.isPending}>
                  {changePassword.isPending ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Devices where you're currently signed in.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-1">
              {activeSessions.isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => <ShimmerSkeleton key={i} className="h-12 rounded" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Signed in</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSessions.data?.map((s) => {
                      const isMobile = /mobile|android|iphone/i.test(s.userAgent ?? "");
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <span className="flex items-center gap-1.5 text-fg-muted text-[12px]">
                              {isMobile ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                              {s.userAgent?.slice(0, 40) ?? "Unknown device"}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-[12px] text-fg-muted">{s.ipAddress ?? "—"}</TableCell>
                          <TableCell className="text-[12px] text-fg-muted">
                            {new Date(s.createdAt).toLocaleDateString("en-IN")}
                          </TableCell>
                          <TableCell className="text-[12px] text-fg-muted">
                            {new Date(s.expiresAt).toLocaleDateString("en-IN")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
