"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { AlertTriangle, RefreshCw, Save, User } from "lucide-react";
import { IndustryCard } from "@/components/industry/card";
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from "@/components/industry/table";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";
import {
  IndustryDialog,
  IndustryDialogContent,
  IndustryDialogTitle,
  IndustryDialogActions,
} from "@/components/industry/dialog";
import { DRIVER_DOCUMENT_TYPES } from "@/lib/compliance/driver-documents";
import { complianceStatus, daysRemaining, STATUS_META, type ComplianceStatus } from "@/lib/compliance/status";
import { runDriverReminderScan } from "@/app/admin/hr/driver-compliance/actions";

type DisplayStatus = ComplianceStatus | "missing";

// Rank a row for sorting/filtering — missing and expired documents are the
// most urgent (a document that was never dated is not evidence it's fine,
// same trap complianceStatus() itself guards against for dated documents).
const STATUS_RANK: Record<DisplayStatus, number> = {
  missing: 0,
  expired: 0,
  due_today: 1,
  due_7: 2,
  due_30: 3,
  unknown: 4,
  ok: 5,
};

const TAG_VARIANT: Record<DisplayStatus, "danger" | "warning" | "neutral" | "accent"> = {
  missing: "neutral",
  expired: "danger",
  due_today: "danger",
  due_7: "warning",
  due_30: "warning",
  unknown: "neutral",
  ok: "accent",
};

interface DriverRow {
  id: string;
  name: string;
  license_class?: string | null;
  [key: string]: unknown;
}

interface DocRow {
  driverId: string;
  driverName: string;
  docKey: string;
  docLabel: string;
  critical: boolean;
  expiry: string | null;
  status: DisplayStatus;
  statusLabel: string;
}

function docStatus(expiry: string | null | undefined): { status: DisplayStatus; label: string } {
  if (!expiry) return { status: "missing", label: "Not on file" };
  const status = complianceStatus(expiry);
  const days = daysRemaining(expiry);
  const meta = STATUS_META[status];
  const label =
    status === "ok"
      ? `Valid — ${format(parseISO(expiry), "dd MMM yyyy")}`
      : status === "expired"
        ? `Expired ${Math.abs(days ?? 0)}d ago`
        : meta.label;
  return { status, label };
}

// "Cannot be dispatched" / "Cannot cross border" are only shown for a
// present grounding event (expired / due today / never on file) — a document
// due in 30 days is a warning, not yet a consequence, per the design spec's
// "expiry is a grounding event, not a date."
function consequence(row: DocRow): string {
  const isGrounding = row.status === "expired" || row.status === "due_today" || row.status === "missing";
  if (!isGrounding) return "—";
  return row.critical ? "Cannot be dispatched" : "Cannot cross border";
}

function EditDriverDocDialog({
  driver,
  open,
  onClose,
  onSaved,
}: {
  driver: DriverRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (driver) {
      const initial: Record<string, string> = {};
      DRIVER_DOCUMENT_TYPES.forEach((doc) => {
        const value = driver[doc.key] as string | null | undefined;
        initial[doc.key] = value ? format(parseISO(value), "yyyy-MM-dd") : "";
      });
      setForm(initial);
    }
  }, [driver]);

  const handleSave = async () => {
    if (!driver) return;
    try {
      setSaving(true);
      const updates: Record<string, string | null> = {};
      DRIVER_DOCUMENT_TYPES.forEach((doc) => {
        updates[doc.key] = form[doc.key] ? new Date(form[doc.key]).toISOString() : null;
      });
      updates.updated_at = new Date().toISOString();

      // .select() is required here, not just error-checking: RLS on
      // user_profiles only allows CEO/ADMIN or the row's own owner to
      // update it, so an HR user editing someone else's record has this
      // UPDATE silently matched to zero rows — no Postgres error, just an
      // empty result.
      const { data, error } = await supabase.from("user_profiles").update(updates).eq("id", driver.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to edit this driver's compliance dates. Only CEO/ADMIN can edit another user's profile.");
      }
      toast({ variant: "success", title: "Documents updated", description: "Driver compliance dates saved." });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <IndustryDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <IndustryDialogContent open={open}>
        <IndustryDialogTitle>Update documents — {driver?.name}</IndustryDialogTitle>
        <div className="flex flex-col gap-3 mt-2">
          {DRIVER_DOCUMENT_TYPES.map((doc) => (
            <div key={doc.key}>
              <label className="ci-lbl flex items-center gap-1.5 mb-1">
                <doc.icon className="size-3.5 text-[var(--ci-text-tertiary)]" />
                {doc.label}
                {doc.critical && <span className="text-[#8c1d18]">required</span>}
              </label>
              <input
                type="date"
                value={form[doc.key] || ""}
                onChange={(e) => setForm((p) => ({ ...p, [doc.key]: e.target.value }))}
                className="w-full text-[14px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[7px] outline-none focus-visible:border-[var(--ci-accent)]"
              />
            </div>
          ))}
        </div>
        <IndustryDialogActions>
          <IndustryButton variant="secondary" onClick={onClose} disabled={saving}>Cancel</IndustryButton>
          <IndustryButton variant="primary" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : "Save documents"}
          </IndustryButton>
        </IndustryDialogActions>
      </IndustryDialogContent>
    </IndustryDialog>
  );
}

export function DriverComplianceDashboard() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "missing" | "ok">("all");
  const [scanning, setScanning] = useState(false);
  const [editDriver, setEditDriver] = useState<DriverRow | null>(null);

  const loadDrivers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_profiles")
      .select(`id, name, license_class, ${DRIVER_DOCUMENT_TYPES.map((d) => d.key).join(", ")}`)
      .eq("role", "DRIVER")
      .order("name");
    setDrivers((data as unknown as DriverRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadDrivers(); }, []);

  const rows: DocRow[] = drivers
    .flatMap((driver) =>
      DRIVER_DOCUMENT_TYPES.map((doc) => {
        const expiry = (driver[doc.key] as string | null) ?? null;
        const { status, label } = docStatus(expiry);
        return {
          driverId: driver.id,
          driverName: driver.name,
          docKey: doc.key,
          docLabel: doc.label,
          critical: doc.critical,
          expiry,
          status,
          statusLabel: label,
        };
      })
    )
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  const criticalCount = rows.filter((r) => r.status === "expired" || r.status === "due_today").length;
  const warningCount = rows.filter((r) => r.status === "due_7" || r.status === "due_30").length;
  const missingCount = rows.filter((r) => r.status === "missing").length;
  const okCount = rows.filter((r) => r.status === "ok").length;

  const filteredRows = rows.filter((r) => {
    if (filter === "critical") return r.status === "expired" || r.status === "due_today";
    if (filter === "warning") return r.status === "due_7" || r.status === "due_30";
    if (filter === "missing") return r.status === "missing";
    if (filter === "ok") return r.status === "ok";
    return true;
  });

  const runReminders = async () => {
    setScanning(true);
    try {
      const result = await runDriverReminderScan();
      toast({ variant: "success", title: "Reminders sent", description: `${result.sent} notification(s) created.` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not run scan.", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const FILTER_TABS: { key: typeof filter; label: string }[] = [
    { key: "all", label: `All (${rows.length})` },
    { key: "critical", label: `Critical (${criticalCount})` },
    { key: "warning", label: `Due soon (${warningCount})` },
    { key: "missing", label: `Not on file (${missingCount})` },
    { key: "ok", label: `Valid (${okCount})` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">
          License, medical certificate, and cross-border pass expiry — one row per document.
        </p>
        <div className="flex gap-2">
          <IndustryButton variant="secondary" onClick={runReminders} disabled={scanning} className="gap-1.5">
            <RefreshCw className={scanning ? "size-4 animate-spin" : "size-4"} />
            Run reminders
          </IndustryButton>
          <IndustryButton variant="secondary" onClick={loadDrivers} disabled={loading} className="gap-1.5">
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </IndustryButton>
        </div>
      </div>

      {criticalCount > 0 && (
        <div className="flex items-start gap-2 border border-[color-mix(in_srgb,#b3261e_30%,transparent)] bg-[color-mix(in_srgb,#b3261e_6%,transparent)] p-[10px]">
          <AlertTriangle className="size-4 text-[#8c1d18] mt-0.5 shrink-0" />
          <p className="text-[12px] text-[#8c1d18]">
            {criticalCount} document(s) expired or expiring today. Any driver with a critical document in this state cannot be dispatched.
          </p>
        </div>
      )}

      <div className="flex gap-1 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={
              "px-3 py-[6px] text-[12px] border transition-colors duration-150 " +
              (filter === tab.key
                ? "bg-[var(--ci-text)] text-[var(--ci-bg)] border-[var(--ci-text)]"
                : "border-[var(--ci-divider)] text-[var(--ci-text-secondary)] hover:bg-[var(--ci-row-hover)]")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      <IndustryCard>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Driver</IndustryTh>
              <IndustryTh>Document</IndustryTh>
              <IndustryTh>Expiry</IndustryTh>
              <IndustryTh>Status</IndustryTh>
              <IndustryTh>Consequence</IndustryTh>
              <IndustryTh align="right">Action</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><IndustryTd colSpan={6} className="text-center text-[var(--ci-text-tertiary)]">Loading…</IndustryTd></tr>
            ) : filteredRows.length === 0 ? (
              <tr><IndustryTd colSpan={6} className="text-center text-[var(--ci-text-tertiary)]">No documents in this category.</IndustryTd></tr>
            ) : (
              filteredRows.map((r) => {
                const cons = consequence(r);
                return (
                  <IndustryTr key={`${r.driverId}-${r.docKey}`}>
                    <IndustryTd className="flex items-center gap-1.5">
                      <User className="size-3.5 text-[var(--ci-text-tertiary)]" />
                      {r.driverName}
                    </IndustryTd>
                    <IndustryTd>{r.docLabel}{r.critical && <span className="text-[10px] text-[var(--ci-text-tertiary)] ml-1">required</span>}</IndustryTd>
                    <IndustryTd mono>{r.expiry ? format(parseISO(r.expiry), "dd MMM yyyy") : "—"}</IndustryTd>
                    <IndustryTd><IndustryTag variant={TAG_VARIANT[r.status]}>{r.statusLabel}</IndustryTag></IndustryTd>
                    <IndustryTd className={cons === "—" ? "text-[var(--ci-text-tertiary)]" : "text-[#8c1d18] font-semibold"}>{cons}</IndustryTd>
                    <IndustryTd align="right">
                      <IndustryButton
                        variant="ghost"
                        onClick={() => setEditDriver(drivers.find((d) => d.id === r.driverId) ?? null)}
                      >
                        Edit
                      </IndustryButton>
                    </IndustryTd>
                  </IndustryTr>
                );
              })
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>

      <EditDriverDocDialog driver={editDriver} open={!!editDriver} onClose={() => setEditDriver(null)} onSaved={loadDrivers} />
    </div>
  );
}
