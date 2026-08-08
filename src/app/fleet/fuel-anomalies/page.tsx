"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { toast } from "@/hooks/use-toast";
import { AuditTrailService } from "@/services/audit-trail-service";
import { PageShell, PageHeader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

type Anomaly = {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  fuel_log_id: string;
  anomaly_type: string;
  severity: "low" | "medium" | "high";
  expected_value: number | null;
  actual_value: number | null;
  deviation_pct: number | null;
  description: string;
  status: "open" | "reviewed" | "dismissed" | "confirmed";
  created_at: string;
  vehicles?: { plate_number: string };
  driver?: { name: string } | null;
};

const TYPE_LABELS: Record<string, string> = {
  efficiency_outlier: "Efficiency Outlier",
  impossible_volume: "Impossible Volume",
  frequency_outlier: "Refuel Frequency",
  price_outlier: "Price Outlier",
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground border-border",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-warning/10 text-warning border-warning/20",
  reviewed: "bg-info/10 text-info border-info/20",
  confirmed: "bg-destructive/10 text-destructive border-destructive/20",
  dismissed: "bg-muted text-muted-foreground border-border",
};

export default function FuelAnomaliesPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("open");

  const canReview = ["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT"].includes(role ?? "");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fuel_anomalies")
        .select("*, vehicles(plate_number)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setAnomalies(data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load anomalies", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch("/api/fuel/detect-anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      toast({ title: "Scan complete", description: `${json.flagged} new anomaly(ies) flagged out of ${json.scanned} checked.` });
      await load();
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const updateStatus = async (anomaly: Anomaly, status: "reviewed" | "dismissed" | "confirmed") => {
    const { error } = await supabase
      .from("fuel_anomalies")
      .update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", anomaly.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await AuditTrailService.log({
      user_id: user?.id,
      module: "operations",
      action: "update",
      entity_type: "vehicle",
      entity_id: anomaly.id,
      new_value: { status },
      description: `Marked fuel anomaly (${TYPE_LABELS[anomaly.anomaly_type] ?? anomaly.anomaly_type}) as ${status}`,
    });
    setAnomalies((prev) => prev.map((a) => (a.id === anomaly.id ? { ...a, status } : a)));
  };

  const filtered = statusFilter === "all" ? anomalies : anomalies.filter((a) => a.status === statusFilter);
  const openCount = anomalies.filter((a) => a.status === "open").length;
  const highCount = anomalies.filter((a) => a.status === "open" && a.severity === "high").length;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Fleet"
        title="Fuel Anomalies"
        subtitle="Review flagged efficiency, volume, frequency, and price outliers"
        icon={ShieldAlert}
        crumbs={[{ label: "Fleet", href: "/fleet" }, { label: "Fuel Anomalies" }]}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
            </Button>
            {canReview && (
              <Button onClick={runScan} disabled={scanning}>
                <ShieldAlert className={cn("size-4 mr-2", scanning && "animate-spin")} /> {scanning ? "Scanning…" : "Scan Now"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="size-4" /> Open Flags
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{openCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="size-4 text-destructive" /> High Severity (Open)
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{highCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Flagged (all time)</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{anomalies.length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fuel Anomalies</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Deviation</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                {canReview && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No anomalies match this filter.</TableCell></TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.vehicles?.plate_number ?? "—"}</TableCell>
                    <TableCell>{TYPE_LABELS[a.anomaly_type] ?? a.anomaly_type}</TableCell>
                    <TableCell><Badge className={cn(SEVERITY_STYLES[a.severity], "capitalize")}>{a.severity}</Badge></TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">{a.description}</TableCell>
                    <TableCell>{a.deviation_pct !== null ? `${a.deviation_pct > 0 ? "+" : ""}${a.deviation_pct}%` : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(a.created_at)}</TableCell>
                    <TableCell><Badge className={cn(STATUS_STYLES[a.status], "capitalize")}>{a.status}</Badge></TableCell>
                    {canReview && (
                      <TableCell>
                        {a.status === "open" && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" title="Confirm as fraud" onClick={() => updateStatus(a, "confirmed")}>
                              <ShieldAlert className="size-4 text-destructive" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Mark reviewed" onClick={() => updateStatus(a, "reviewed")}>
                              <CheckCircle2 className="size-4 text-info" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Dismiss" onClick={() => updateStatus(a, "dismissed")}>
                              <XCircle className="size-4 text-muted-foreground" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
