"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { AuditTrailService } from "@/services/audit-trail-service";
import { PageShell, PageHeader, SectionCard, EmptyState, PageSkeleton, RefreshControl } from "@/components/shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  complianceStatus,
  daysRemaining,
  DOC_TYPE_LABELS,
  DOCUMENT_TYPES,
  REMINDER_THRESHOLDS,
  STATUS_META,
  type ComplianceStatus,
} from "@/lib/compliance/status";
import { cn } from "@/lib/utils";
import { format as formatDate } from "date-fns";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
} from "lucide-react";

interface Row {
  id: string;
  source: "document" | "insurance";
  vehicle_id: string | null;
  plate: string;
  vehicle_label: string;
  doc_type: string;
  number: string | null;
  provider: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  cost: number | null;
  currency: string;
  file_url: string | null;
  notes: string | null;
  renewed_from?: string | null;
  status: ComplianceStatus;
  days: number | null;
}

const emptyForm = () => ({
  vehicle_id: "",
  doc_type: "registration",
  number: "",
  provider: "",
  issue_date: formatDate(new Date(), "yyyy-MM-dd"),
  expiry_date: "",
  reminder_days: 30,
  cost: "" as number | "",
  currency: "TZS",
  notes: "",
});

const MANAGER_ROLES = ["CEO", "ADMIN", "OPERATOR", "HR"];

export default function CompliancePage() {
  const { user } = useSupabase();
  const { role } = useRole();
  const { toast } = useToast();

  const [docs, setDocs] = useState<any[]>([]);
  const [insurance, setInsurance] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [renewingFrom, setRenewingFrom] = useState<Row | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canWrite = MANAGER_ROLES.includes(role ?? "");
  const canDelete = ["CEO", "ADMIN"].includes(role ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const [v, ins] = await Promise.all([
      supabase.from("vehicles").select("id, plate_number, make, model").order("plate_number"),
      supabase.from("truck_insurance").select("*").order("expiry_date"),
    ]);
    // New columns arrive with migration 010 — fall back to the base shape before it runs.
    let d = await supabase.from("vehicle_documents").select("*").order("expiry_date");
    if (d.error) d = await supabase.from("vehicle_documents").select("id, vehicle_id, doc_type, doc_name, expiry_date, issued_date, document_number, file_url, status, created_at");
    setVehicles(v.data ?? []);
    setInsurance(ins.data ?? []);
    setDocs(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const vehicleById = useMemo(() => {
    const m = new Map<string, any>();
    for (const v of vehicles) m.set(v.id, v);
    return m;
  }, [vehicles]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const d of docs) {
      const v = vehicleById.get(d.vehicle_id);
      out.push({
        id: d.id,
        source: "document",
        vehicle_id: d.vehicle_id,
        plate: v?.plate_number ?? "—",
        vehicle_label: v ? `${v.plate_number} · ${v.make ?? ""} ${v.model ?? ""}`.trim() : "Unknown vehicle",
        doc_type: d.doc_type ?? "other",
        number: d.document_number ?? d.doc_name ?? null,
        provider: d.provider ?? null,
        issue_date: d.issued_date ?? null,
        expiry_date: d.expiry_date ?? null,
        cost: d.cost != null ? Number(d.cost) : null,
        currency: d.currency ?? "TZS",
        file_url: d.file_url ?? null,
        notes: d.notes ?? null,
        renewed_from: d.renewed_from ?? null,
        status: complianceStatus(d.expiry_date),
        days: daysRemaining(d.expiry_date),
      });
    }
    for (const i of insurance) {
      const v = vehicleById.get(i.vehicle_id);
      out.push({
        id: i.id,
        source: "insurance",
        vehicle_id: i.vehicle_id,
        plate: v?.plate_number ?? "—",
        vehicle_label: v ? `${v.plate_number} · ${v.make ?? ""} ${v.model ?? ""}`.trim() : "Unknown vehicle",
        doc_type: "insurance",
        number: i.policy_number ?? i.tira_reference_number ?? null,
        provider: i.insurer_name ?? null,
        issue_date: i.start_date ?? null,
        expiry_date: i.expiry_date ?? null,
        cost: i.annual_premium != null ? Number(i.annual_premium) : null,
        currency: i.currency ?? "TZS",
        file_url: i.policy_document_url ?? null,
        notes: i.notes ?? null,
        status: complianceStatus(i.expiry_date),
        days: daysRemaining(i.expiry_date),
      });
    }
    return out.sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  }, [docs, insurance, vehicleById]);

  const counts = useMemo(() => {
    const c = { total: rows.length, expired: 0, due_7: 0, due_30: 0, ok: 0 };
    for (const r of rows) {
      if (r.status === "expired" || r.status === "due_today") c.expired += 1;
      else if (r.status === "due_7") c.due_7 += 1;
      else if (r.status === "due_30") c.due_30 += 1;
      else c.ok += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all") {
        if (statusFilter === "expired" && !(r.status === "expired" || r.status === "due_today")) return false;
        if (statusFilter !== "expired" && r.status !== statusFilter) return false;
      }
      if (typeFilter !== "all" && r.doc_type !== typeFilter) return false;
      if (vehicleFilter !== "all" && r.vehicle_id !== vehicleFilter) return false;
      if (!q) return true;
      return [r.plate, r.vehicle_label, r.number, r.provider, DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [rows, statusFilter, typeFilter, vehicleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, vehicleFilter, search]);

  const exportCsv = () => {
    const header = ["Vehicle", "Plate", "Type", "Provider", "Number", "Issue", "Expiry", "Days", "Status", "Cost", "Currency"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([
        `"${r.vehicle_label}"`, r.plate, DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type, `"${r.provider ?? ""}"`,
        r.number ?? "", r.issue_date ?? "", r.expiry_date ?? "", r.days ?? "", STATUS_META[r.status].label,
        r.cost ?? "", r.currency,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-${formatDate(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAdd = () => {
    setRenewingFrom(null);
    setForm(emptyForm());
    setFile(null);
    setDialogOpen(true);
  };

  const openRenew = (r: Row) => {
    setRenewingFrom(r);
    setForm({
      vehicle_id: r.vehicle_id ?? "",
      doc_type: r.doc_type,
      number: r.number ?? "",
      provider: r.provider ?? "",
      issue_date: formatDate(new Date(), "yyyy-MM-dd"),
      expiry_date: "",
      reminder_days: 30,
      cost: r.cost ?? "",
      currency: r.currency,
      notes: r.notes ?? "",
    });
    setFile(null);
    setDialogOpen(true);
  };

  const uploadAttachment = async (): Promise<string | null> => {
    if (!file) return null;
    const path = `${form.vehicle_id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("compliance-docs").upload(path, file, { upsert: false });
    if (error) throw new Error(`Attachment upload failed: ${error.message}`);
    return supabase.storage.from("compliance-docs").getPublicUrl(path).data.publicUrl;
  };

  const notifyManagers = async (title: string, message: string) => {
    const { data: managers } = await supabase
      .from("user_profiles")
      .select("id")
      .in("role", MANAGER_ROLES);
    if (!managers || managers.length === 0) return;
    await supabase.from("notifications").insert(
      managers.map((m: any) => ({ user_id: m.id, type: "compliance", title, message, read: false })),
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.expiry_date) {
      toast({ title: "Missing fields", description: "Vehicle and expiry date are required.", variant: "destructive" });
      return;
    }
    if (form.issue_date && form.expiry_date <= form.issue_date) {
      toast({ title: "Invalid dates", description: "Expiry date must be after the issue date.", variant: "destructive" });
      return;
    }
    // Duplicate guard: same vehicle + type + number with a live expiry
    const dup = rows.find(
      (r) =>
        r.vehicle_id === form.vehicle_id &&
        r.doc_type === form.doc_type &&
        form.number &&
        r.number === form.number &&
        r.status !== "expired" &&
        r.id !== renewingFrom?.id,
    );
    if (dup) {
      toast({ title: "Duplicate document", description: `${DOC_TYPE_LABELS[form.doc_type]} ${form.number} is already tracked for this vehicle.`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const fileUrl = await uploadAttachment();
      const vehicle = vehicleById.get(form.vehicle_id);
      const label = `${DOC_TYPE_LABELS[form.doc_type] ?? form.doc_type} · ${vehicle?.plate_number ?? ""}`;

      let newId: string | null = null;

      if (form.doc_type === "insurance") {
        // Insurance lives in truck_insurance via the existing API (validated server-side)
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/insurance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            vehicle_id: form.vehicle_id,
            insurer_name: form.provider || "Unknown insurer",
            policy_number: form.number || undefined,
            policy_type: "third_party",
            tira_reference_number: form.number || `TZ-${Date.now()}`,
            start_date: form.issue_date,
            expiry_date: form.expiry_date,
            annual_premium: Number(form.cost) || 0,
            currency: form.currency,
            is_cross_border: false,
            has_comesa_yellow_card: false,
            covered_countries: ["Tanzania"],
            policy_document_url: fileUrl ?? undefined,
            notes: form.notes || undefined,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Insurance API rejected the record");
        newId = body.data?.id ?? null;
      } else {
        const payload: Record<string, any> = {
          vehicle_id: form.vehicle_id,
          doc_type: form.doc_type,
          doc_name: DOC_TYPE_LABELS[form.doc_type] ?? form.doc_type,
          document_number: form.number || null,
          issued_date: form.issue_date || null,
          expiry_date: form.expiry_date,
          file_url: fileUrl,
          status: complianceStatus(form.expiry_date),
          provider: form.provider || null,
          cost: form.cost === "" ? null : Number(form.cost),
          currency: form.currency,
          reminder_days: Number(form.reminder_days) || 30,
          notes: form.notes || null,
          renewed_from: renewingFrom?.source === "document" ? renewingFrom.id : null,
          created_by: user?.id && /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null,
        };
        let ins = await supabase.from("vehicle_documents").insert(payload).select().single();
        if (ins.error) {
          // Pre-010 fallback: strip the new columns
          const { provider, cost, currency, reminder_days, notes, renewed_from, created_by, ...base } = payload;
          ins = await supabase.from("vehicle_documents").insert(base).select().single();
        }
        if (ins.error) throw ins.error;
        newId = ins.data?.id ?? null;
      }

      // Finance integration: compliance costs become approved fleet expenses
      if (Number(form.cost) > 0) {
        await supabase.from("expenses").insert({
          type: "compliance",
          category: form.doc_type,
          amount: Number(form.cost),
          currency: form.currency,
          description: `${label} — ${form.provider || "provider n/a"} (${form.number || "no ref"})`,
          vehicle_id: form.vehicle_id,
          vendor_name: form.provider || null,
          date: form.issue_date || formatDate(new Date(), "yyyy-MM-dd"),
          status: "approved",
        });
      }

      await AuditTrailService.log({
        user_id: user?.id,
        module: "operations",
        action: (renewingFrom ? "renew" : "create") as any,
        entity_type: "compliance_document" as any,
        entity_id: newId ?? "unknown",
        new_value: { ...form, file_url: fileUrl },
        old_value: renewingFrom ?? undefined,
        description: `${renewingFrom ? "Renewed" : "Added"} ${label}, expires ${form.expiry_date}`,
      });

      await notifyManagers(
        renewingFrom ? "Compliance document renewed" : "Compliance document added",
        `${label} — expires ${form.expiry_date}`,
      );

      toast({ title: renewingFrom ? "Document renewed" : "Document added", description: label });
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Row) => {
    if (!canDelete) {
      toast({ title: "Not allowed", description: "Only CEO/Admin can delete compliance records.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Delete ${DOC_TYPE_LABELS[r.doc_type]} for ${r.plate}? The action is logged.`)) return;
    const res =
      r.source === "insurance"
        ? await fetch(`/api/insurance/${r.id}`, { method: "DELETE" }).then((x) => ({ error: x.ok ? null : { message: `API ${x.status}` } }))
        : await supabase.from("vehicle_documents").delete().eq("id", r.id);
    if (res.error) {
      toast({ title: "Delete failed", description: res.error.message, variant: "destructive" });
      return;
    }
    await AuditTrailService.log({
      user_id: user?.id,
      module: "operations",
      action: "delete" as any,
      entity_type: "compliance_document" as any,
      entity_id: r.id,
      old_value: r,
      description: `Deleted ${DOC_TYPE_LABELS[r.doc_type]} ${r.number ?? ""} for ${r.plate}`,
    });
    toast({ title: "Record deleted" });
    load();
  };

  // Reminder engine: create notifications for documents hitting a threshold.
  // Runs on demand; recently-notified documents are skipped via a 3-day lookback.
  const runReminderScan = async () => {
    setScanning(true);
    try {
      const due = rows.filter((r) => r.days !== null && (r.days < 0 || (REMINDER_THRESHOLDS as readonly number[]).includes(r.days)));
      if (due.length === 0) {
        toast({ title: "Reminder scan", description: "No documents at a reminder threshold today." });
        return;
      }
      const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
      const { data: recent } = await supabase
        .from("notifications")
        .select("message")
        .eq("type", "compliance_reminder")
        .gte("created_at", since);
      const recentSet = new Set((recent ?? []).map((n: any) => n.message));
      const { data: managers } = await supabase.from("user_profiles").select("id").in("role", MANAGER_ROLES);

      let created = 0;
      for (const r of due) {
        const message = `${DOC_TYPE_LABELS[r.doc_type]} for ${r.plate} (${r.number ?? "no ref"}) ${r.days! < 0 ? `expired ${Math.abs(r.days!)} day(s) ago` : r.days === 0 ? "expires today" : `expires in ${r.days} day(s)`}`;
        if (recentSet.has(message)) continue;
        await supabase.from("notifications").insert(
          (managers ?? []).map((m: any) => ({
            user_id: m.id,
            type: "compliance_reminder",
            title: r.days! < 0 ? "Compliance document EXPIRED" : "Compliance renewal due",
            message,
            read: false,
          })),
        );
        created += 1;
      }
      toast({ title: "Reminder scan complete", description: `${created} reminder(s) issued, ${due.length - created} already covered.` });
    } finally {
      setScanning(false);
    }
  };

  const cards: { key: ComplianceStatus | "all"; label: string; value: number; chip: string }[] = [
    { key: "all", label: "Documents tracked", value: counts.total, chip: "bg-primary/10 text-primary" },
    { key: "expired", label: "Expired / due today", value: counts.expired, chip: "bg-red-100 text-red-700" },
    { key: "due_7", label: "Due ≤ 7 days", value: counts.due_7, chip: "bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]" },
    { key: "due_30", label: "Due 8–30 days", value: counts.due_30, chip: "bg-[hsl(var(--info-soft))] text-[hsl(var(--info))]" },
    { key: "ok", label: "Valid", value: counts.ok, chip: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" },
  ];

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Fleet"
        title="Compliance & insurance"
        subtitle="Every vehicle document tracked, statused automatically and renewed without losing history"
        icon={Shield}
        crumbs={[{ label: "Fleet", href: "/fleet" }, { label: "Compliance" }]}
        actions={
          <>
            <RefreshControl onRefresh={load} storageKey="compliance" />
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={runReminderScan} disabled={scanning || loading}>
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />} Run reminders
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            {canWrite && (
              <Button size="sm" onClick={openAdd} className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-3.5 h-3.5" /> Add document
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <PageSkeleton kpiCount={5} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {cards.map((c) => (
              <button
                key={c.key}
                onClick={() => setStatusFilter(c.key as any)}
                className={cn(
                  "cv-kpi text-left transition-all",
                  statusFilter === c.key && "border-primary ring-1 ring-primary/40",
                )}
              >
                <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-2", c.chip)}>
                  {c.label}
                </span>
                <p className="cv-kpi-value">{c.value}</p>
              </button>
            ))}
          </div>

          <div className="cv-panel flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plate, policy number, provider, type…" className="pl-9 h-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vehicles</SelectItem>
                {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <SectionCard title={`Documents (${filtered.length})`} padded={false}>
            {filtered.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={rows.length === 0 ? "No compliance documents yet" : "Nothing matches this view"}
                description={rows.length === 0 ? "Track your first insurance policy, registration or permit." : "Clear the search or switch filters."}
                action={rows.length === 0 && canWrite ? (
                  <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                    <Plus className="w-4 h-4" /> Add document
                  </Button>
                ) : null}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                        <th className="px-4 py-3">Vehicle</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Provider</th>
                        <th className="px-4 py-3">Number</th>
                        <th className="px-4 py-3">Issue</th>
                        <th className="px-4 py-3">Expiry</th>
                        <th className="px-4 py-3 text-right">Days</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Cost</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r) => {
                        const meta = STATUS_META[r.status];
                        return (
                          <tr key={`${r.source}-${r.id}`} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-bold text-foreground">{r.plate}</p>
                              <p className="text-[10px] text-muted-foreground">{r.vehicle_label.split("·")[1]?.trim()}</p>
                            </td>
                            <td className="px-4 py-3 text-foreground">{DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type}</td>
                            <td className="px-4 py-3 text-muted-foreground">{r.provider ?? "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs text-foreground">{r.number ?? "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{r.issue_date ? formatDate(new Date(r.issue_date), "MMM d, yyyy") : "—"}</td>
                            <td className="px-4 py-3 text-foreground text-xs font-bold">{r.expiry_date ? formatDate(new Date(r.expiry_date), "MMM d, yyyy") : "—"}</td>
                            <td className={cn("px-4 py-3 text-right font-mono text-xs font-black", (r.days ?? 0) < 0 ? "text-destructive" : (r.days ?? 99) <= 7 ? "text-[hsl(var(--warning))]" : "text-foreground")}>
                              {r.days ?? "—"}
                            </td>
                            <td className="px-4 py-3"><span className={cn("cv-chip", meta.chip)}>{meta.label}</span></td>
                            <td className="px-4 py-3 text-right font-mono text-xs">{r.cost != null ? `${r.currency} ${r.cost.toLocaleString()}` : "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                {r.file_url && (
                                  <a href={r.file_url} target="_blank" rel="noreferrer" title="Open attachment"
                                     className="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center">
                                    <Paperclip className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {canWrite && (
                                  <button onClick={() => openRenew(r)} title="Renew"
                                          className="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:border-[hsl(var(--success))] hover:text-[hsl(var(--success))] flex items-center justify-center">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button onClick={() => remove(r)} title="Delete"
                                          className="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive flex items-center justify-center">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
                    <span>Page {page} of {totalPages} · {filtered.length} records</span>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </SectionCard>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <DialogTitle>{renewingFrom ? `Renew — ${renewingFrom.plate}` : "Add compliance document"}</DialogTitle>
            </div>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vehicle *</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => setForm((p) => ({ ...p, vehicle_id: v }))} disabled={!!renewingFrom}>
                  <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_number} · {v.make} {v.model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Document type *</Label>
                <Select value={form.doc_type} onValueChange={(v) => setForm((p) => ({ ...p, doc_type: v }))} disabled={!!renewingFrom}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Policy / document number</Label>
                <Input value={form.number} onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))} placeholder="e.g. TZ/2026/12345" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Provider / authority</Label>
                <Input value={form.provider} onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))} placeholder="Jubilee, TRA, LATRA…" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Issue date</Label>
                <Input type="date" value={form.issue_date} onChange={(e) => setForm((p) => ({ ...p, issue_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expiry date *</Label>
                <Input type="date" value={form.expiry_date} onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reminder (days)</Label>
                <Input type="number" min={1} value={form.reminder_days} onChange={(e) => setForm((p) => ({ ...p, reminder_days: Number(e.target.value) || 30 }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Cost</Label>
                <Input type="number" min={0} value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value === "" ? "" : Number(e.target.value) }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["TZS", "USD", "EUR", "KES"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border px-3 py-2 text-xs">
                <span className="text-muted-foreground">Status: </span>
                <span className={cn("cv-chip ml-1", STATUS_META[complianceStatus(form.expiry_date || undefined)].chip)}>
                  {STATUS_META[complianceStatus(form.expiry_date || undefined)].label}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Attachment (PDF / image)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-foreground hover:file:bg-muted/70"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className="min-h-[60px]" />
            </div>
            {form.cost !== "" && Number(form.cost) > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Saving will also record an approved fleet expense of {form.currency} {Number(form.cost).toLocaleString()} linked to this vehicle.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {renewingFrom ? "Renew document" : "Save document"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
