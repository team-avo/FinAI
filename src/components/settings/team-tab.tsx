"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { toast } from "sonner";

type Role = "owner" | "accountant" | "viewer";
const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  accountant: "Accountant",
  viewer: "Viewer · read-only",
};

function RoleOptions() {
  return (
    <SelectContent>
      <SelectItem value="viewer">Viewer · read-only</SelectItem>
      <SelectItem value="accountant">Accountant</SelectItem>
      <SelectItem value="owner">Owner</SelectItem>
    </SelectContent>
  );
}

export function TeamTab() {
  const utils = trpc.useUtils();
  const members = trpc.members.list.useQuery();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");

  const self = members.data?.find((m) => m.isSelf);
  const isOwner = self?.role === "owner";

  const add = trpc.members.add.useMutation({
    onSuccess: () => {
      toast.success("Team member added");
      setEmail("");
      utils.members.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const setRoleM = trpc.members.setRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.members.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.members.remove.useMutation({
    onSuccess: () => {
      toast.success("Member removed");
      utils.members.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>
          Invite your accountant or CA. Give a CA the <strong>Viewer</strong> role so they can review
          your books and GST returns without being able to change anything.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isOwner && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email) add.mutate({ email, role });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="ca@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <RoleOptions />
              </Select>
            </div>
            <Button type="submit" disabled={!email || add.isPending}>
              {add.isPending ? "Adding…" : "Add member"}
            </Button>
          </form>
        )}

        {members.isLoading ? (
          <ShimmerSkeleton className="h-32 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {isOwner && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.data?.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell>
                    {m.name}
                    {m.isSelf && <span className="text-muted-foreground"> (you)</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    {isOwner && !m.isSelf ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) => setRoleM.mutate({ userId: m.userId, role: v as Role })}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <RoleOptions />
                      </Select>
                    ) : (
                      <Badge variant="ghost">{ROLE_LABEL[m.role as Role]}</Badge>
                    )}
                  </TableCell>
                  {isOwner && (
                    <TableCell className="text-right">
                      {!m.isSelf && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm(`Remove ${m.email} from the team?`)) {
                              remove.mutate({ userId: m.userId });
                            }
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!isOwner && (
          <p className="text-sm text-muted-foreground">Only an owner can change the team.</p>
        )}
      </CardContent>
    </Card>
  );
}
