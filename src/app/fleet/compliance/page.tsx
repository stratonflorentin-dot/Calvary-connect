"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageShell, PageHeader, StatCard, SectionCard, EmptyState, PageSkeleton, RefreshControl } from "@/components/shell";
import { Input } from "@/components/ui/input";
import { format as formatDate } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileWarning,
  Flame,
  Search,
  Shield,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "insurance" | "registration" | "inspection";
type Row = {
  id: string;
  vehicle_id: string;
  plate: string;
  make?: string;
  model?: string;
  kind: Kind;
  expires: string;
  days: number;
};

const KIND_META: Record<Kind, { label: string; icon: any; accent: string }> = {
  insurance:    { label: "Insurance",    icon: Shield,         accent: "bg-primary/10 text-primary" },
  registration: { label: "Registration", icon: ClipboardCheck, accent: "bg-sky-100 text-sky-700" },
  inspection:   { label: "Inspection",   icon: FileWarning,    accent: "bg-amber-100 text-amber-700" },
};

function daysUntil(d?: string | null): number | null {
  if (!d) return null;
  return Math.floor((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function CompliancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "expired" | "week" | "month" | "ok">("all");
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vehicles")
      .select("id, plate_number, make, model, insuranceExpiry, insurance_expiry, registrationExpiry, registration_expiry, next_inspection_due");
    const list: Row[] = [];
    for (const v of data ?? []) {
      const ins = v.insuranceExpiry ?? v.insurance_expiry;
      const reg = v.registrationExpiry ?? v.registration_expiry;
      const insp = (v as any).next_inspection_due;
      if (ins) list.push({ id: `${v.id}-ins`, vehicle_id: v.id, plate: v.plate_number, make: v.make, model: v.model, kind: "insurance", expires: ins, days: daysUntil(ins)! });
      if (reg) list.push({ id: `${v.id}-reg`, vehicle_id: v.id, plate: v.plate_number, make: v.make, model: v.model, kind: "registration", expires: reg, days: daysUntil(reg)! });
      if (insp) list.push({ id: `${v.id}-insp`, vehicle_id: v.id, plate: v.plate_number, make: v.make, model: v.model, kind: "inspection", expires: insp, days: daysUntil(insp)! });
    }
    list.sort((a, b) => a.days - b.days);
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    expired: rows.filter((r) => r.days < 0).length,
    week: rows.filter((r) => r.days >= 0 && r.days <= 7).length,
    month: rows.filter((r) => r.days > 7 && r.days <= 30).length,
    ok: rows.filter((r) => r.days > 30).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (q && !`${r.plate} ${r.make ?? ""} ${r.model ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "expired") return r.days < 0;
      if (filter === "week") return r.days >= 0 && r.days <= 7;
      if (filter === "month") return r.days > 7 && r.days <= 30;
      if (filter === "ok") return r.days > 30;
      return true;
    });
  }, [rows, search, filter, kindFilter]);

  const chips: { key: typeof filter; label: string; count: number; tone: string }[] = [
    { key: "all",     label: "All",           count: stats.total,   tone: "border-border bg-card text-foreground" },
    { key: "expired", label: "Expired",       count: stats.expired, tone: "border-red-200 bg-red-50 text-red-700" },
    { key: "week",    label: "≤ 7 days",      count: stats.week,    tone: "border-amber-200 bg-amber-50 text-amber-700" },
    { key: "month",   label: "8-30 days",     count: stats.month,   tone: "border-sky-200 bg-sky-50 text-sky-700" },
    { key: "ok",      label: "OK",            count: stats.ok,      tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  ];

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Fleet"
        title="Compliance & Insurance"
        subtitle={`${stats.expired} expired · ${stats.week} in ≤7 days · ${stats.month} in ≤30 days`}
        icon={Shield}
        iconAccent="bg-primary text-primary-foreground"
        crumbs={[{ label: "Fleet", href: "/fleet" }, { label: "Compliance" }]}
        actions={<RefreshControl onRefresh={load} storageKey="compliance" />}
      />

      {loading ? (
        <PageSkeleton kpiCount={5} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard label="Documents tracked" value={stats.total} icon={ClipboardCheck} accent="bg-primary/10 text-primary" />
            <StatCard label="Expired" value={stats.expired} icon={Flame} accent="bg-red-100 text-red-700" />
            <StatCard label="≤ 7 days" value={stats.week} icon={AlertTriangle} accent="bg-amber-100 text-amber-700" />
            <StatCard label="8-30 days" value={stats.month} icon={Clock} accent="bg-sky-100 text-sky-700" />
            <StatCard label="OK (> 30d)" value={stats.ok} icon={CheckCircle2} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  filter === c.key ? "border-primary bg-[hsl(var(--primary-soft))] text-primary shadow-sm" : c.tone,
                )}
              >
                {c.label} <span className="text-[10px] font-black bg-background/60 rounded-full px-1.5">{c.count}</span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-full border border-border bg-card p-0.5">
                {(["all", "insurance", "registration", "inspection"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKindFilter(k)}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-full transition-colors capitalize",
                      kindFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {k === "all" ? "All types" : k}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plate…" className="pl-9 h-9" />
              </div>
            </div>
          </div>

          <SectionCard title={`Documents (${filtered.length})`} padded={false}>
            {filtered.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing matches this view" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">Document</th>
                      <th className="px-4 py-3">Expires</th>
                      <th className="px-4 py-3 text-right">Days</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const meta = KIND_META[r.kind];
                      const Icon = meta.icon;
                      const chipCls =
                        r.days < 0 ? "cv-chip-danger" :
                        r.days <= 7 ? "cv-chip-warning" :
                        r.days <= 30 ? "cv-chip-info" :
                        "cv-chip-success";
                      const label =
                        r.days < 0 ? `Expired ${Math.abs(r.days)}d ago` :
                        r.days === 0 ? "Expires today" :
                        `In ${r.days}d`;
                      return (
                        <tr key={r.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                                <Truck className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-mono font-black text-xs text-foreground">{r.plate}</p>
                                <p className="text-[10px] text-muted-foreground">{r.make} {r.model}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", meta.accent)}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-sm font-medium text-foreground">{meta.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(new Date(r.expires), "d MMM yyyy")}</td>
                          <td className={cn("px-4 py-3 text-right text-xs font-bold", r.days < 0 ? "text-red-600" : r.days <= 7 ? "text-amber-700" : "text-muted-foreground")}>
                            {r.days}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("cv-chip", chipCls)}>{label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </PageShell>
  );
}
