"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShimmerSkeleton } from "@/components/effects/shimmer-skeleton";
import { GridBg } from "@/components/effects/grid-bg";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";
import { Search } from "lucide-react";

export default function ItemsPage() {
  const [search, setSearch] = useState("");

  const { data: items, isLoading, refetch } = trpc.items.list.useQuery({
    search: search || undefined,
  });

  const deleteMutation = trpc.items.delete.useMutation({
    onSuccess: () => { toast.success("Item deleted"); refetch(); },
    onError: () => toast.error("Failed to delete item"),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-fg">Items & Services</h1>
          <p className="text-[13px] text-fg-muted">{items?.length ?? "—"} items</p>
        </div>
        <Button asChild size="sm">
          <Link href="/items/new">
            <Plus className="h-3.5 w-3.5" /> New Item
          </Link>
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fg-muted" />
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <ShimmerSkeleton key={i} className="h-8 rounded" />
            ))}
          </div>
        ) : items?.length === 0 ? (
          <div className="relative h-[280px] flex flex-col items-center justify-center">
            <GridBg className="opacity-30" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <BookOpen className="h-8 w-8 text-fg-muted" />
              <p className="text-[13px] text-fg-muted">No items yet</p>
              <Button asChild size="sm">
                <Link href="/items/new"><Plus className="h-3.5 w-3.5" /> Add Item</Link>
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>HSN/SAC</TableHead>
                <TableHead className="text-right">Default Rate</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium text-fg">{item.name}</p>
                    {item.description && (
                      <p className="text-[12px] text-fg-muted truncate max-w-xs">{item.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.type === "service" ? "info" : "default"}>
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-fg-muted text-[12px]">
                    {item.hsnCode ?? item.sacCode ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatINR(parseFloat(item.defaultRate))}
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
                          <Link href={`/items/${item.id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-negative focus:text-negative"
                          onClick={() => confirm("Delete?") && deleteMutation.mutate({ id: item.id })}
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
