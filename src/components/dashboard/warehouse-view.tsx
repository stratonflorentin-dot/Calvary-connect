"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { RoleDashboard } from "./shared/role-dashboard";
import { EmptyState } from "@/components/shell";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Package,
  PackageCheck,
  Wallet,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface InventoryItem {
  id: string;
  item_name?: string;
  category?: string;
  quantity_available?: number;
  min_stock_level?: number;
  unit?: string;
}

export function WarehouseView() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [partsRequests, setPartsRequests] = useState<any[]>([]);

  const load = async () => {
    const [inv, pr] = await Promise.all([
      supabase.from("inventory").select("*"),
      supabase.from("parts_requests").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setInventory(inv.data ?? []);
    setPartsRequests(pr.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const isLowStock = (i: InventoryItem) => (i.quantity_available ?? 0) <= (i.min_stock_level ?? 0);

  const stats = useMemo(() => {
    const totalItems = inventory.length;
    const lowStock = inventory.filter(isLowStock).length;
    const pending = partsRequests.filter((r) => r.status === "pending").length;
    const approved = partsRequests.filter((r) => r.status === "approved").length;
    return { totalItems, lowStock, pending, approved };
  }, [inventory, partsRequests]);

  const lowStockItems = useMemo(
    () => inventory.filter(isLowStock).sort((a, b) => (a.quantity_available ?? 0) - (b.quantity_available ?? 0)).slice(0, 8),
    [inventory],
  );
  const requestQueue = useMemo(
    () => partsRequests.filter((r) => ["pending", "approved"].includes(r.status)).slice(0, 8),
    [partsRequests],
  );

  return (
    <RoleDashboard
      eyebrow="Warehouse Console"
      title="Welcome"
      subtitle={`${stats.totalItems} item${stats.totalItems === 1 ? "" : "s"} · ${stats.lowStock} low on stock · ${stats.pending} parts request${stats.pending === 1 ? "" : "s"} pending`}
      onRefresh={load}
      storageKey="warehouse-dash"
      kpis={[
        { label: "Stock items", value: stats.totalItems, icon: Boxes, accent: "bg-primary/10 text-primary", href: "/inventory" },
        { label: "Low stock", value: stats.lowStock, icon: AlertTriangle, accent: "bg-red-100 text-red-700", href: "/inventory" },
        { label: "Requests pending", value: stats.pending, icon: ClipboardList, accent: "bg-amber-100 text-amber-700", href: "/parts-requests" },
        { label: "Ready to issue", value: stats.approved, icon: PackageCheck, accent: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]", href: "/parts-requests" },
      ]}
      sections={[
        {
          title: "Low stock — reorder",
          subtitle: "At or below minimum level",
          href: "/inventory",
          padded: false,
          colSpan: 2,
          content: lowStockItems.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Stock levels healthy" description="No items are at or below their minimum." />
          ) : (
            <ul className="divide-y divide-border">
              {lowStockItems.map((i) => (
                <li key={i.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{i.item_name ?? "Item"}</p>
                    <p className="text-xs text-muted-foreground truncate">{i.category ?? "Uncategorized"}</p>
                  </div>
                  <span className="cv-chip cv-chip-warning">
                    {i.quantity_available ?? 0}{i.unit ? ` ${i.unit}` : ""} left
                  </span>
                </li>
              ))}
            </ul>
          ),
        },
        {
          title: "Parts requests",
          subtitle: "Pending and approved",
          href: "/parts-requests",
          padded: false,
          content: requestQueue.length === 0 ? (
            <EmptyState icon={Package} title="No open requests" description="Nothing waiting to be issued." />
          ) : (
            <ul className="divide-y divide-border">
              {requestQueue.map((r) => (
                <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    r.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary",
                  )}>
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{r.purpose ?? "Parts request"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Qty {r.quantity_requested ?? r.quantity ?? "—"} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <span className={cn("cv-chip", r.status === "pending" ? "cv-chip-warning" : "cv-chip-info")}>
                    {String(r.status).replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          ),
        },
      ]}
      quickActions={[
        { href: "/inventory", label: "Inventory", icon: Boxes, tone: "bg-primary/10 text-primary" },
        { href: "/parts-requests", label: "Parts requests", icon: ClipboardList, tone: "bg-amber-100 text-amber-700" },
        { href: "/spare-parts", label: "Spare parts", icon: Package, tone: "bg-sky-100 text-sky-700" },
        { href: "/finance/cash-requests", label: "Cash request", icon: Wallet, tone: "bg-emerald-100 text-emerald-700" },
      ]}
    />
  );
}
