"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle, CheckCircle2, Clock, FileText,
  RefreshCw, ChevronDown, ChevronUp, X, Save, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DRIVER_DOCUMENT_TYPES } from "@/lib/compliance/driver-documents";
import { complianceStatus, daysRemaining, STATUS_META, type ComplianceStatus } from "@/lib/compliance/status";
import { runDriverReminderScan } from "@/app/admin/hr/driver-compliance/actions";

// A missing expiry date is its own display case — `complianceStatus(null)`
// reads as "ok" (nothing to warn about yet), which is right for optional
// docs but misleading for a critical one like a license, so this component
// checks for a missing date before deferring to the shared primitive.
type DisplayStatus = ComplianceStatus | "missing";

function docDisplay(expiry?: string | null): { status: DisplayStatus; label: string; chip: string } {
  if (!expiry) return { status: "missing", label: "Not on file", chip: "cv-chip-neutral" };
  const status = complianceStatus(expiry);
  const days = daysRemaining(expiry);
  const meta = STATUS_META[status];
  const label = status === "ok" ? `Valid — ${format(parseISO(expiry), "dd MMM yyyy")}` : status === "expired" ? `Expired ${Math.abs(days ?? 0)}d ago` : meta.label;
  return { status, label, chip: meta.chip };
}

function StatusIcon({ status }: { status: DisplayStatus }) {
  if (status === "ok") return <CheckCircle2 className="size-4 text-success" />;
  if (status === "expired" || status === "due_today") return <AlertTriangle className="size-4 text-destructive" />;
  if (status === "due_7" || status === "due_30") return <Clock className="size-4 text-warning" />;
  return <FileText className="size-4 text-muted-foreground" />;
}

// ─── Edit Dialog ─────────────────────────────────────────────────────────────
interface EditDriverDocDialogProps {
  driver: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}
function EditDriverDocDialog({ driver, open, onClose, onSaved }: EditDriverDocDialogProps) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (driver) {
      const initial: Record<string, string> = {};
      DRIVER_DOCUMENT_TYPES.forEach((doc) => {
        initial[doc.key] = driver[doc.key] ? format(parseISO(driver[doc.key]), "yyyy-MM-dd") : "";
      });
      setForm(initial);
    }
  }, [driver]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const updates: Record<string, string | null> = {};
      DRIVER_DOCUMENT_TYPES.forEach((doc) => {
        updates[doc.key] = form[doc.key] ? new Date(form[doc.key]).toISOString() : null;
      });
      updates.updated_at = new Date().toISOString();

      // .select() is required here, not just error-checking: RLS on
      // user_profiles only allows CEO/ADMIN or the row's own owner to
      // update it (supabase/migrations/033_fix_user_profiles_role_
      // escalation.sql), so an HR/OPERATOR user editing someone else's
      // record has this UPDATE silently matched to zero rows — no
      // Postgres error, just an empty result. Without checking that,
      // this always showed "Documents updated" even when nothing saved.
      const { data, error } = await supabase.from("user_profiles").update(updates).eq("id", driver.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to edit this driver's compliance dates. Only CEO/ADMIN can edit another user's profile.");
      }
      toast({ variant: "success", title: "Documents updated", description: "Driver compliance dates saved." });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            Update Documents — {driver?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {DRIVER_DOCUMENT_TYPES.map((doc) => (
            <div key={doc.key} className="space-y-1">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <doc.icon className="size-4 text-muted-foreground" />
                {doc.label}
                {doc.critical && <span className="text-destructive text-xs">*required</span>}
              </Label>
              <Input
                type="date"
                value={form[doc.key] || ""}
                onChange={(e) => setForm((p) => ({ ...p, [doc.key]: e.target.value }))}
                className={cn(!form[doc.key] && doc.critical && "border-destructive")}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <><RefreshCw className="size-4 mr-2 animate-spin" />Saving…</> : <><Save className="size-4 mr-2" />Save Documents</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Single Driver Compliance Card ───────────────────────────────────────────
interface DriverComplianceCardProps {
  driver: any;
  onUpdate: () => void;
  compact?: boolean;
}
export function DriverComplianceCard({ driver, onUpdate, compact = false }: DriverComplianceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const docStatuses = DRIVER_DOCUMENT_TYPES.map((doc) => ({
    ...doc,
    expiry: driver[doc.key] as string | null,
    ...docDisplay(driver[doc.key]),
  }));

  const expired = docStatuses.filter((d) => d.status === "expired").length;
  const dueSoon = docStatuses.filter((d) => d.status === "due_today" || d.status === "due_7" || d.status === "due_30").length;
  const valid = docStatuses.filter((d) => d.status === "ok").length;
  const missing = docStatuses.filter((d) => d.status === "missing").length;

  const overallHealth = expired > 0 ? "critical" : dueSoon > 0 ? "warning" : missing > 0 ? "incomplete" : "good";

  const healthConfig = {
    critical: { label: "Action Required", color: "border-destructive bg-destructive/5", badge: "bg-destructive/10 text-destructive" },
    warning: { label: "Due Soon", color: "border-warning bg-warning/5", badge: "bg-warning/10 text-warning" },
    incomplete: { label: "Incomplete", color: "border-muted bg-muted/50", badge: "bg-muted/50 text-muted-foreground" },
    good: { label: "Compliant", color: "border-success bg-success/5", badge: "bg-success/10 text-success" },
  }[overallHealth];

  if (compact) {
    return (
      <>
        <div
          className={cn("rounded-xl border-2 p-3 cursor-pointer hover:shadow-sm transition-all", healthConfig.color)}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", healthConfig.badge)}>{healthConfig.label}</span>
              <span className="text-xs text-muted-foreground">{driver.name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {expired > 0 && <span className="text-destructive font-bold">{expired} expired</span>}
              {dueSoon > 0 && <span className="text-warning">{dueSoon} due soon</span>}
              <span className="text-success">{valid} valid</span>
              {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </div>
          </div>

          {expanded && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {docStatuses.map((doc) => (
                <div key={doc.key} className="flex items-center justify-between bg-card rounded-lg px-2 py-1.5 border border-border">
                  <div className="flex items-center gap-1.5">
                    <doc.icon className="size-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{doc.label}</span>
                  </div>
                  <span className={cn("cv-chip text-[10px]", doc.chip)}>{doc.label}</span>
                </div>
              ))}
              <Button size="sm" variant="outline" className="col-span-2" onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}>
                <FileText className="size-3 mr-1" /> Update Documents
              </Button>
            </div>
          )}
        </div>
        <EditDriverDocDialog driver={driver} open={editOpen} onClose={() => setEditOpen(false)} onSaved={onUpdate} />
      </>
    );
  }

  return (
    <>
      <Card className={cn("border-2 transition-all", healthConfig.color)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{driver.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{driver.license_class ? `License class ${driver.license_class}` : "Driver"}</p>
            </div>
            <span className={cn("px-2 py-1 rounded-full text-xs font-bold", healthConfig.badge)}>{healthConfig.label}</span>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {expired > 0 && <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold">{expired} Expired</span>}
            {dueSoon > 0 && <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full">{dueSoon} Due soon</span>}
            <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full">{valid} Valid</span>
            {missing > 0 && <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">{missing} Missing</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {docStatuses.map((doc) => (
            <div key={doc.key} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <StatusIcon status={doc.status} />
                <div className="flex items-center gap-1.5">
                  <doc.icon className="size-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{doc.label}</span>
                </div>
              </div>
              <span className={cn("cv-chip text-xs", doc.chip)}>{doc.label}</span>
            </div>
          ))}
          <Button size="sm" className="w-full mt-2" variant="outline" onClick={() => setEditOpen(true)}>
            <FileText className="size-4 mr-2" />Update Documents
          </Button>
        </CardContent>
      </Card>
      <EditDriverDocDialog driver={driver} open={editOpen} onClose={() => setEditOpen(false)} onSaved={onUpdate} />
    </>
  );
}

// ─── Full Driver Compliance Dashboard ────────────────────────────────────────
export function DriverComplianceDashboard() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "incomplete" | "good">("all");
  const [scanning, setScanning] = useState(false);

  const loadDrivers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_profiles")
      .select(`id, name, license_class, ${DRIVER_DOCUMENT_TYPES.map((d) => d.key).join(", ")}`)
      .eq("role", "DRIVER")
      .order("name");
    setDrivers(data || []);
    setLoading(false);
  };

  useEffect(() => { loadDrivers(); }, []);

  // Mirrors DriverComplianceCard's own overallHealth exactly — a driver
  // with no critical/warning docs but a document missing entirely must not
  // fall through to "good" (same trap the shared complianceStatus()
  // primitive itself was just fixed for: a document that was never dated
  // is not evidence it's fine).
  const getDriverHealth = (driver: any) => {
    const statuses = DRIVER_DOCUMENT_TYPES.map((doc) => docDisplay(driver[doc.key]).status);
    if (statuses.some((s) => s === "expired" || s === "due_today")) return "critical";
    if (statuses.some((s) => s === "due_7" || s === "due_30")) return "warning";
    if (statuses.some((s) => s === "missing")) return "incomplete";
    return "good";
  };

  const criticalCount = drivers.filter((d) => getDriverHealth(d) === "critical").length;
  const warningCount = drivers.filter((d) => getDriverHealth(d) === "warning").length;
  const incompleteCount = drivers.filter((d) => getDriverHealth(d) === "incomplete").length;
  const filteredDrivers = drivers.filter((d) => filter === "all" || getDriverHealth(d) === filter);

  const runReminders = async () => {
    setScanning(true);
    try {
      const result = await runDriverReminderScan();
      toast({ variant: "success", title: "Reminders sent", description: `${result.sent} notification(s) created.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <User className="size-7 text-primary" />
            Driver Compliance
          </h2>
          <p className="text-muted-foreground text-sm mt-1">License, medical certificate and cross-border pass expiry tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runReminders} disabled={scanning}>
            <RefreshCw className={cn("size-4 mr-2", scanning && "animate-spin")} />Run reminders
          </Button>
          <Button variant="outline" size="sm" onClick={loadDrivers} disabled={loading}>
            <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />Refresh
          </Button>
        </div>
      </div>

      {(criticalCount > 0) && (
        <div className="bg-destructive/5 border-2 border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-destructive">Immediate Action Required</p>
            <p className="text-sm text-destructive/80 mt-0.5">
              {criticalCount} driver(s) have an expired or same-day-expiring document. Driving without valid documents is a compliance risk.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: `All Drivers (${drivers.length})` },
          { key: "critical", label: `Action Required (${criticalCount})`, className: criticalCount > 0 ? "!bg-destructive !text-destructive-foreground" : "" },
          { key: "warning", label: `Due Soon (${warningCount})`, className: warningCount > 0 ? "!bg-warning !text-warning-foreground" : "" },
          { key: "incomplete", label: `Incomplete (${incompleteCount})`, className: incompleteCount > 0 ? "!bg-muted-foreground/20" : "" },
          { key: "good", label: `Compliant (${drivers.length - criticalCount - warningCount - incompleteCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
              filter === tab.key ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground hover:bg-muted border-border",
              tab.className,
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-56 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <User className="size-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No drivers in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map((d) => (
            <DriverComplianceCard key={d.id} driver={d} onUpdate={loadDrivers} />
          ))}
        </div>
      )}
    </div>
  );
}
