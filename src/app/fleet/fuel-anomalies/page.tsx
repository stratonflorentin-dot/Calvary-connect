"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { toast } from "@/hooks/use-toast";
import { PageShell, PageHeader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { ShieldAlert, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, Settings2, DollarSign, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

type Anomaly = {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  fuel_log_id: string;
  anomaly_type: string;
  rule_code: string | null;
  severity: "low" | "medium" | "high";
  risk_score: number | null;
  confidence: "high" | "medium" | "low" | null;
  expected_value: number | null;
  actual_value: number | null;
  deviation_pct: number | null;
  description: string;
  evidence: Record<string, any> | null;
  driver_response: { explanation: string; attachment_url?: string; submitted_at: string } | null;
  status: string;
  created_at: string;
  finance_adjustment_journal_entry_id: string | null;
  vehicles?: { plate_number: string };
  driver?: { name: string } | null;
};

const RULE_LABELS: Record<string, string> = {
  GPS_MISMATCH: "GPS Mismatch",
  OFF_ROUTE_FUELING: "Off-Route Fueling",
  FUEL_CARD_MISMATCH: "Fuel Card Mismatch",
  FUEL_DUPLICATE_RECEIPT: "Duplicate Receipt",
  TANK_CAPACITY_EXCEEDED: "Tank Capacity Exceeded",
  FUEL_CONSUMPTION_HIGH: "Consumption Anomaly",
  ODOMETER_ROLLBACK: "Odometer Anomaly",
  RAPID_REFUELING: "Rapid Refueling",
  EXCESSIVE_FUELING: "Excessive Fueling",
  FUEL_PRICE_ANOMALY: "Price Anomaly",
  STATIONARY_LOCATION_MISMATCH: "Stationary Location Mismatch",
  POSSIBLE_SIPHONING: "Possible Siphoning",
  EXCESSIVE_IDLING: "Excessive Idling",
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground border-border",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-warning/10 text-warning border-warning/20",
  under_review: "bg-info/10 text-info border-info/20",
  investigating: "bg-primary/10 text-primary border-primary/20",
  reviewed: "bg-info/10 text-info border-info/20",
  resolved: "bg-success/10 text-success border-success/20",
  confirmed: "bg-destructive/10 text-destructive border-destructive/20",
  confirmed_fraud: "bg-destructive/10 text-destructive border-destructive/20",
  dismissed: "bg-muted text-muted-foreground border-border",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  low: "bg-muted text-muted-foreground",
};

export default function FuelAnomaliesPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncingGps, setSyncingGps] = useState(false);

  const canReview = ["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT"].includes(role ?? "");
  const canManageRules = ["CEO", "ADMIN", "OPERATOR"].includes(role ?? "");
  const canConfirmFinance = ["CEO", "ADMIN", "ACCOUNTANT"].includes(role ?? "");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fuel_anomalies")
        .select("*, vehicles(plate_number), driver:user_profiles!fuel_anomalies_driver_id_fkey(name)")
        .order("risk_score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(300);
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

  const syncGps = async () => {
    setSyncingGps(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch("/api/telematics/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "GPS sync failed");
      toast({
        title: "GPS sync complete",
        description: `${json.synced}/${json.totalMapped} tracked vehicles updated.${json.errors?.length ? ` ${json.errors.length} error(s).` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "GPS sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncingGps(false);
    }
  };

  const ruleCodes = useMemo(
    () => [...new Set(anomalies.map((a) => a.rule_code).filter(Boolean))] as string[],
    [anomalies],
  );

  const filtered = anomalies.filter(
    (a) =>
      (statusFilter === "all" || a.status === statusFilter) &&
      (ruleFilter === "all" || a.rule_code === ruleFilter),
  );
  const openCount = anomalies.filter((a) => a.status === "open").length;
  const highCount = anomalies.filter((a) => ["open", "under_review", "investigating"].includes(a.status) && a.severity === "high").length;
  const confirmedCount = anomalies.filter((a) => a.status === "confirmed_fraud" || a.status === "confirmed").length;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Fleet"
        title="Fuel Fraud & Anomalies"
        subtitle="GPS, card, receipt, tank, odometer, and consumption checks across every fuel transaction"
        icon={ShieldAlert}
        crumbs={[{ label: "Fleet", href: "/fleet" }, { label: "Fuel Anomalies" }]}
        actions={
          <>
            {canManageRules && (
              <Link href="/fleet/fuel-anomalies/rules">
                <Button variant="outline">
                  <Settings2 className="size-4 mr-2" /> Rules
                </Button>
              </Link>
            )}
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
            </Button>
            {canReview && (
              <Button variant="outline" onClick={syncGps} disabled={syncingGps} title="Pull live position/ignition data from Cartrack/Wialon for mapped vehicles">
                <Satellite className={cn("size-4 mr-2", syncingGps && "animate-pulse")} /> {syncingGps ? "Syncing…" : "Sync GPS"}
              </Button>
            )}
            {canReview && (
              <Button onClick={runScan} disabled={scanning}>
                <ShieldAlert className={cn("size-4 mr-2", scanning && "animate-spin")} /> {scanning ? "Scanning…" : "Scan Now"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
              <ShieldAlert className="size-4 text-destructive" /> High Severity (Active)
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{highCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Confirmed Fraud</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{confirmedCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Flagged (180d)</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{anomalies.length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <CardTitle>Flagged Transactions</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={ruleFilter} onValueChange={setRuleFilter}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rules</SelectItem>
                {ruleCodes.map((code) => (
                  <SelectItem key={code} value={code}>{RULE_LABELS[code] ?? code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="confirmed_fraud">Confirmed Fraud</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Description</TableHead>
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
                filtered.map((a) => {
                  const isExpanded = expandedId === a.id;
                  return (
                    <>
                      <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                        <TableCell>{isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</TableCell>
                        <TableCell className="font-medium">{a.vehicles?.plate_number ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={cn(SEVERITY_STYLES[a.severity], "capitalize")}>{a.severity}</Badge>
                            <span className="text-sm">{RULE_LABELS[a.rule_code ?? a.anomaly_type] ?? a.rule_code ?? a.anomaly_type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm">{a.risk_score ?? "—"}</span>
                            {a.confidence && (
                              <Badge className={cn(CONFIDENCE_STYLES[a.confidence], "text-[10px] capitalize")}>{a.confidence}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md text-sm text-muted-foreground">{a.description}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(a.created_at)}</TableCell>
                        <TableCell><Badge className={cn(STATUS_STYLES[a.status], "capitalize")}>{a.status.replace(/_/g, " ")}</Badge></TableCell>
                        {canReview && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <TransitionButtons
                              kind="fuel_anomaly"
                              entity={a}
                              actorId={user?.id ?? ""}
                              actorRole={role ?? undefined}
                              size="sm"
                              onDone={(next) => setAnomalies((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...next } : x)))}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${a.id}-detail`}>
                          <TableCell colSpan={8} className="bg-muted/20 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Evidence</p>
                                {a.evidence && Object.keys(a.evidence).length > 0 ? (
                                  <pre className="text-xs bg-card border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(a.evidence, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">No structured evidence captured for this finding.</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">
                                  Expected: {a.expected_value ?? "—"} · Actual: {a.actual_value ?? "—"} · Deviation: {a.deviation_pct !== null ? `${a.deviation_pct}%` : "—"}
                                </p>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Driver Response</p>
                                  {a.driver_response ? (
                                    <div className="bg-card border border-border rounded-lg p-3">
                                      <p className="text-sm">{a.driver_response.explanation}</p>
                                      {a.driver_response.attachment_url && (
                                        <a href={a.driver_response.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 inline-block">
                                          View attachment
                                        </a>
                                      )}
                                      <p className="text-[10px] text-muted-foreground mt-1">Submitted {formatDate(a.driver_response.submitted_at)}</p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">
                                      {a.driver_id ? "No response submitted yet." : "No driver linked to this transaction."}
                                    </p>
                                  )}
                                </div>
                                {(a.status === "confirmed_fraud" || a.status === "confirmed") && canConfirmFinance && (
                                  <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Finance</p>
                                    {a.finance_adjustment_journal_entry_id ? (
                                      <Link
                                        href={`/finance/accounting/journal-entries?entry=${a.finance_adjustment_journal_entry_id}`}
                                        className="text-xs text-primary underline"
                                      >
                                        View posted adjustment
                                      </Link>
                                    ) : (
                                      <Link
                                        href={`/finance/accounting/journal-entries?new=1&description=${encodeURIComponent(`Fuel fraud adjustment — ${a.description}`)}&amount=${a.actual_value ?? ""}&fuel_anomaly_id=${a.id}`}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg px-3 py-1.5"
                                      >
                                        <DollarSign className="size-3.5" /> Create finance adjustment
                                      </Link>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
