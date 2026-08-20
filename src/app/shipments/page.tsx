"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/components/ui/currency-badge";
import { Loader2, Plus, Search, Ship } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUSES = ["created", "approved", "active", "delivered", "invoiced", "paid", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
  created: "Created", approved: "Approved", active: "In Transit", delivered: "Delivered",
  invoiced: "Invoiced", paid: "Paid", cancelled: "Cancelled",
};
const STATUS_BADGE: Record<Status, string> = {
  created: "bg-muted text-muted-foreground border-border",
  approved: "bg-info/10 text-info border-info/20",
  active: "bg-warning/10 text-warning border-warning/20",
  delivered: "bg-primary/10 text-primary border-primary/20",
  invoiced: "bg-accent/10 text-accent-foreground border-accent/20",
  paid: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / 86400000));
}

export default function ShipmentsListPage() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [historicalOnly, setHistoricalOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("shipments")
      .select("*, customer:customer_id(company_name, contact_person)")
      .order("created_at", { ascending: false });
    setShipments(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // One filtered array feeds both the stat cards and the table — the
  // stat/list-disagreement bug called out for this exact kind of page
  // this session can't happen when both read the same array.
  const scoped = useMemo(() => shipments.filter((s) => (historicalOnly ? s.is_historical : true)), [shipments, historicalOnly]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: scoped.length };
    for (const st of STATUSES) c[st] = scoped.filter((s) => s.status === st).length;
    return c;
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (!q) return true;
      const hay = [s.shipment_number, s.customer?.company_name, s.customer?.contact_person, s.origin_city, s.destination_city]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [scoped, search, filter]);

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-headline tracking-tighter flex items-center gap-2">
                <Ship className="size-7 text-primary" /> Shipments
              </h1>
              <p className="text-muted-foreground">Every shipment traces back to the accepted quotation that created it</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={historicalOnly} onChange={(e) => setHistoricalOnly(e.target.checked)} className="size-4" />
              Historical only
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 overflow-x-auto">
            <button onClick={() => setFilter("all")} className={cn("text-left bg-card border rounded-xl p-3", filter === "all" ? "border-primary" : "border-border")}>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
              <p className="text-xl font-black text-foreground">{counts.all}</p>
            </button>
            {STATUSES.map((st) => (
              <button key={st} onClick={() => setFilter(st)} className={cn("text-left bg-card border rounded-xl p-3", filter === st ? "border-primary" : "border-border")}>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{STATUS_LABEL[st]}</p>
                <p className="text-xl font-black text-foreground">{counts[st] ?? 0}</p>
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search shipments..." className="pl-9 max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Ship className="size-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="font-bold text-foreground">No shipments</p>
                <p className="text-sm text-muted-foreground">Shipments are created automatically when a Quotation is accepted.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3">Shipment #</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3">Rental Period</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const days = daysBetween(s.requested_pickup, s.promised_delivery);
                      return (
                        <tr key={s.id} className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => (window.location.href = `/shipments/${s.id}`)}>
                          <td className="px-4 py-3 font-mono text-xs font-black text-foreground">{s.shipment_number}{s.is_historical && <Badge variant="outline" className="ml-1.5 text-[9px]">historical</Badge>}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{s.customer?.company_name ?? s.customer?.contact_person ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{s.origin_city && s.destination_city ? `${s.origin_city} → ${s.destination_city}` : "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {s.requested_pickup ? new Date(s.requested_pickup).toLocaleDateString() : "—"} – {s.promised_delivery ? new Date(s.promised_delivery).toLocaleDateString() : "—"}
                            {days != null && <span className="ml-1">({days}d)</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(s.final_amount ?? s.quoted_amount) || 0, s.currency || "TZS")}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className={STATUS_BADGE[s.status as Status] ?? ""}>{STATUS_LABEL[s.status as Status] ?? s.status}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
