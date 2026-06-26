"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays, isPast, parseISO } from "date-fns";
import {
  Shield, AlertTriangle, CheckCircle2, Clock, FileText,
  Upload, RefreshCw, ChevronDown, ChevronUp, Bell, X, Save,
  Globe, Package, Scale, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Document definitions ────────────────────────────────────────────────────
const VEHICLE_DOCUMENTS = [
  { key: "insurance_expiry",        label: "Motor Insurance",           icon: Shield, critical: true  },
  { key: "road_license_expiry",     label: "Road License (TANROADS)",   icon: FileText, critical: true  },
  { key: "fitness_expiry",          label: "Roadworthiness Certificate", icon: CheckCircle2, critical: true  },
  { key: "tra_cert_expiry",         label: "TRA Registration Cert.",    icon: FileText, critical: true  },
  { key: "comesa_expiry",           label: "COMESA Yellow Card",        icon: Globe, critical: false },
  { key: "goods_transit_expiry",    label: "Goods-in-Transit Permit",   icon: Package, critical: false },
  { key: "tatoa_expiry",            label: "TATOA Weight Certificate",  icon: Scale, critical: false },
  { key: "fire_extinguisher_expiry",label: "Fire Extinguisher",         icon: ShieldAlert, critical: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDocStatus(expiryDate?: string | null) {
  if (!expiryDate) return { status: "missing", label: "Not Set", color: "text-muted-foreground bg-muted/50", days: null };
  const d = parseISO(expiryDate);
  const days = differenceInDays(d, new Date());
  if (isPast(d))          return { status: "expired",  label: `Expired ${Math.abs(days)}d ago`, color: "text-destructive bg-destructive/10",    days };
  if (days <= 14)         return { status: "critical",  label: `${days}d left`,                  color: "text-destructive bg-destructive/10",    days };
  if (days <= 30)         return { status: "warning",   label: `${days}d left`,                  color: "text-warning bg-warning/10", days };
  if (days <= 60)         return { status: "due-soon",  label: `${days}d left`,                  color: "text-warning bg-warning/10", days };
  return                         { status: "valid",     label: `Valid — ${format(d, "dd MMM yyyy")}`, color: "text-success bg-success/10", days };
}

function StatusIcon({ status }: { status: string }) {
  if (status === "valid")    return <CheckCircle2 className="size-4 text-success" />;
  if (status === "expired" || status === "critical") return <AlertTriangle className="size-4 text-destructive" />;
  if (status === "warning" || status === "due-soon") return <Clock className="size-4 text-warning" />;
  return <FileText className="size-4 text-muted-foreground" />;
}

// ─── Edit Dialog ─────────────────────────────────────────────────────────────
interface EditDocDialogProps {
  vehicle: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}
function EditDocDialog({ vehicle, open, onClose, onSaved }: EditDocDialogProps) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vehicle) {
      const initial: Record<string, string> = {};
      VEHICLE_DOCUMENTS.forEach(doc => {
        initial[doc.key] = vehicle[doc.key]
          ? format(parseISO(vehicle[doc.key]), "yyyy-MM-dd")
          : "";
      });
      setForm(initial);
    }
  }, [vehicle]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const updates: Record<string, string | null> = {};
      VEHICLE_DOCUMENTS.forEach(doc => {
        updates[doc.key] = form[doc.key] ? new Date(form[doc.key]).toISOString() : null;
      });
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("vehicles")
        .update(updates)
        .eq("id", vehicle.id);

      if (error) throw error;
      toast({ title: "Documents Updated", description: "Compliance dates saved successfully." });
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
            <Shield className="size-5 text-primary" />
            Update Compliance Docs — {vehicle?.plate_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {VEHICLE_DOCUMENTS.map(doc => (
            <div key={doc.key} className="space-y-1">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <doc.icon className="size-4 text-muted-foreground" />
                {doc.label}
                {doc.critical && <span className="text-destructive text-xs">*required</span>}
              </Label>
              <Input
                type="date"
                value={form[doc.key] || ""}
                onChange={e => setForm(p => ({ ...p, [doc.key]: e.target.value }))}
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

// ─── Single Vehicle Compliance Card ──────────────────────────────────────────
interface VehicleComplianceCardProps {
  vehicle: any;
  onUpdate: () => void;
  compact?: boolean;
}
export function VehicleComplianceCard({ vehicle, onUpdate, compact = false }: VehicleComplianceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const docStatuses = VEHICLE_DOCUMENTS.map(doc => ({
    ...doc,
    expiry: vehicle[doc.key] as string | null,
    ...getDocStatus(vehicle[doc.key]),
  }));

  const expired  = docStatuses.filter(d => d.status === "expired").length;
  const critical = docStatuses.filter(d => d.status === "critical").length;
  const warnings = docStatuses.filter(d => d.status === "warning" || d.status === "due-soon").length;
  const valid    = docStatuses.filter(d => d.status === "valid").length;
  const missing  = docStatuses.filter(d => d.status === "missing").length;

  const overallHealth = expired > 0 || critical > 0
    ? "critical"
    : warnings > 0
    ? "warning"
    : missing > 2
    ? "incomplete"
    : "good";

  const healthConfig = {
    critical:   { label: "Action Required", color: "border-destructive bg-destructive/5",    badge: "bg-destructive/10 text-destructive" },
    warning:    { label: "Due Soon",        color: "border-warning bg-warning/5", badge: "bg-warning/10 text-warning" },
    incomplete: { label: "Incomplete",      color: "border-muted bg-muted/50",              badge: "bg-muted/50 text-muted-foreground" },
    good:       { label: "Compliant",       color: "border-success bg-success/5", badge: "bg-success/10 text-success" },
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
              <span className="text-xs text-muted-foreground">{vehicle.plate_number}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {expired > 0 && <span className="text-destructive font-bold">{expired} expired</span>}
              {critical > 0 && <span className="text-destructive font-bold">{critical} critical</span>}
              {warnings > 0 && <span className="text-warning">{warnings} warning</span>}
              <span className="text-success">{valid} valid</span>
              {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </div>
          </div>

          {expanded && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {docStatuses.map(doc => (
                <div key={doc.key} className="flex items-center justify-between bg-card rounded-lg px-2 py-1.5 border border-border">
                  <div className="flex items-center gap-1.5">
                    <doc.icon className="size-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{doc.label}</span>
                  </div>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", doc.color)}>{doc.label}</span>
                </div>
              ))}
              <Button size="sm" variant="outline" className="col-span-2" onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}>
                <FileText className="size-3 mr-1" /> Update Documents
              </Button>
            </div>
          )}
        </div>
        <EditDocDialog vehicle={vehicle} open={editOpen} onClose={() => setEditOpen(false)} onSaved={onUpdate} />
      </>
    );
  }

  return (
    <>
      <Card className={cn("border-2 transition-all", healthConfig.color)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{vehicle.plate_number}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{vehicle.make} {vehicle.model} · {vehicle.type}</p>
            </div>
            <span className={cn("px-2 py-1 rounded-full text-xs font-bold", healthConfig.badge)}>
              {healthConfig.label}
            </span>
          </div>
          {/* Summary pills */}
          <div className="flex gap-2 flex-wrap mt-2">
            {expired > 0  && <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold">{expired} Expired</span>}
            {critical > 0 && <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold">{critical} Critical</span>}
            {warnings > 0 && <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full">{warnings} Warning</span>}
            <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full">{valid} Valid</span>
            {missing > 0  && <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">{missing} Missing</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {docStatuses.map(doc => (
            <div key={doc.key} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <StatusIcon status={doc.status} />
                <div className="flex items-center gap-1.5">
                  <doc.icon className="size-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{doc.label}</span>
                </div>
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", doc.color)}>
                {doc.label}
              </span>
            </div>
          ))}
          <Button size="sm" className="w-full mt-2" variant="outline" onClick={() => setEditOpen(true)}>
            <FileText className="size-4 mr-2" />Update Documents
          </Button>
        </CardContent>
      </Card>
      <EditDocDialog vehicle={vehicle} open={editOpen} onClose={() => setEditOpen(false)} onSaved={onUpdate} />
    </>
  );
}

// ─── Full Fleet Compliance Dashboard ─────────────────────────────────────────
export function FleetComplianceDashboard() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "good">("all");

  const loadVehicles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vehicles")
      .select(`id, plate_number, make, model, type, status, ${VEHICLE_DOCUMENTS.map(d => d.key).join(", ")}`)
      .order("plate_number");
    setVehicles(data || []);
    setLoading(false);
  };

  useEffect(() => { loadVehicles(); }, []);

  // Compute overall stats
  const allDocStatuses = vehicles.flatMap(v =>
    VEHICLE_DOCUMENTS.map(doc => getDocStatus(v[doc.key]).status)
  );
  const totalExpired  = allDocStatuses.filter(s => s === "expired").length;
  const totalCritical = allDocStatuses.filter(s => s === "critical").length;
  const totalWarning  = allDocStatuses.filter(s => s === "warning" || s === "due-soon").length;
  const totalValid    = allDocStatuses.filter(s => s === "valid").length;

  const getVehicleHealth = (vehicle: any) => {
    const statuses = VEHICLE_DOCUMENTS.map(doc => getDocStatus(vehicle[doc.key]).status);
    if (statuses.some(s => s === "expired" || s === "critical")) return "critical";
    if (statuses.some(s => s === "warning" || s === "due-soon")) return "warning";
    return "good";
  };

  const filteredVehicles = vehicles.filter(v => {
    if (filter === "all") return true;
    return getVehicleHealth(v) === filter;
  });

  const criticalCount = vehicles.filter(v => getVehicleHealth(v) === "critical").length;
  const warningCount  = vehicles.filter(v => getVehicleHealth(v) === "warning").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="size-7 text-primary" />
            Fleet Compliance
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Tanzania regulatory document tracking — TRA, TANROADS, TATOA, Insurance</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadVehicles} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Expired", value: totalExpired,  color: "text-destructive",   bg: "bg-destructive/5 border-destructive/20",    icon: <X className="size-5 text-destructive" /> },
          { label: "Critical (≤14d)", value: totalCritical, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20", icon: <AlertTriangle className="size-5 text-destructive" /> },
          { label: "Due Soon (≤60d)", value: totalWarning,  color: "text-warning", bg: "bg-warning/5 border-warning/20", icon: <Bell className="size-5 text-warning" /> },
          { label: "Valid",    value: totalValid,   color: "text-success", bg: "bg-success/5 border-success/20", icon: <CheckCircle2 className="size-5 text-success" /> },
        ].map(stat => (
          <Card key={stat.label} className={cn("border", stat.bg)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                <p className={cn("text-3xl font-black", stat.color)}>{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">documents</p>
              </div>
              {stat.icon}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alert Banner */}
      {(criticalCount > 0 || totalExpired > 0) && (
        <div className="bg-destructive/5 border-2 border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-destructive">Immediate Action Required</p>
            <p className="text-sm text-destructive/80 mt-0.5">
              {totalExpired > 0 && `${totalExpired} document(s) are expired. `}
              {criticalCount > 0 && `${criticalCount} vehicle(s) have documents expiring within 14 days.`}
              {" "}Operating with expired documents may result in fines or fleet grounding.
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all",      label: `All Vehicles (${vehicles.length})` },
          { key: "critical", label: `Action Required (${criticalCount})`, className: criticalCount > 0 ? "!bg-destructive !text-destructive-foreground" : "" },
          { key: "warning",  label: `Due Soon (${warningCount})`,         className: warningCount > 0 ? "!bg-warning !text-warning-foreground" : "" },
          { key: "good",     label: `Compliant (${vehicles.length - criticalCount - warningCount})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
              filter === tab.key ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground hover:bg-muted border-border",
              tab.className
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vehicle Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="size-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No vehicles in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map(v => (
            <VehicleComplianceCard key={v.id} vehicle={v} onUpdate={loadVehicles} />
          ))}
        </div>
      )}
    </div>
  );
}
