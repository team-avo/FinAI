"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, Search, Users } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { GridBg } from "@/components/effects/grid-bg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "customer" | "vendor" | "both">("all");

  const { data: contacts, isLoading, refetch } = trpc.contacts.list.useQuery({
    search: search || undefined,
    type: typeFilter,
  });

  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success("Contact deleted");
      refetch();
    },
    onError: () => toast.error("Failed to delete contact"),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-fg">Contacts</h1>
          <p className="text-[13px] text-fg-muted">
            {contacts?.length ?? "—"} total
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/contacts/new">
            <Plus className="h-3.5 w-3.5" />
            New Contact
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fg-muted" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "customer", "vendor", "both"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 h-7 text-[12px] rounded border transition-colors capitalize ${
                typeFilter === t
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-fg-muted hover:text-fg hover:border-border-strong"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <ShimmerSkeleton key={i} className="h-8 rounded" />
            ))}
          </div>
        ) : contacts?.length === 0 ? (
          <div className="relative h-[300px] flex flex-col items-center justify-center">
            <GridBg className="opacity-30" />
            <div className="relative z-10 flex flex-col items-center gap-2 text-center">
              <Users className="h-8 w-8 text-fg-muted" />
              <p className="text-[13px] text-fg-muted">No contacts found</p>
              <Button asChild size="sm">
                <Link href="/contacts/new">
                  <Plus className="h-3.5 w-3.5" /> Add Contact
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts?.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium text-fg hover:text-accent transition-colors"
                    >
                      {contact.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.type === "customer" ? "positive" : contact.type === "vendor" ? "info" : "accent"}>
                      {contact.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-fg-muted">{contact.email ?? "—"}</TableCell>
                  <TableCell className="font-mono text-fg-muted">{contact.phone ?? "—"}</TableCell>
                  <TableCell className="font-mono text-fg-muted text-[12px]">
                    {contact.gstin ?? "—"}
                  </TableCell>
                  <TableCell className="text-fg-muted text-[12px]">
                    {format(new Date(contact.createdAt), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-bg-subtle text-fg-muted hover:text-fg transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/contacts/${contact.id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-negative focus:text-negative"
                          onClick={() => {
                            if (confirm("Delete this contact?")) {
                              deleteMutation.mutate({ id: contact.id });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
