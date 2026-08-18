"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, SectionCard } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarClock, Loader2, Lock, LockOpen, Unlock } from "lucide-react";

const CAN_CLOSE_ROLES = ["CEO", "ADMIN"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface PeriodRow {
  year: number;
  month: number;
  status: "open" | "closed" | "locked";
  closed_by: string | null;
  closed_at: string | null;
  closedByName?: string | null;
}

// Trailing 15 months (current + 14 back) — enough runway to close last
// month's books without hunting for a date picker, matching how the rest
// of this app scopes rolling lists. Months further back can still be
// closed directly via the RPC; this list is just the common case.
function trailingMonths(count: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return out;
}

export default function DayEndClosingsPage() {
  const { role } = useRole();
  const canClose = CAN_CLOSE_ROLES.includes(String(role || "").toUpperCase());

  const [periods, setPeriods] = useState<Record<string, PeriodRow>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reopenTarget, setReopenTarget] = useState<{ year: number; month: number } | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  const months = useMemo(() => trailingMonths(15), []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fiscal_periods")
      .select("*, closer:user_profiles!closed_by(name)")
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    if (error) {
      toast({ title: "Couldn't load periods", description: error.message, variant: "destructive" });
    }
    const map: Record<string, PeriodRow> = {};
    for (const row of (data as any[]) ?? []) {
      map[`${row.year}-${row.month}`] = { ...row, closedByName: row.closer?.name ?? null };
    }
    setPeriods(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const rowFor = (year: number, month: number): PeriodRow =>
    periods[`${year}-${month}`] ?? { year, month, status: "open", closed_by: null, closed_at: null };

  const close = async (year: number, month: number, lock: boolean) => {
    const key = `${year}-${month}`;
    setBusyKey(key);
    const { error } = await supabase.rpc("close_fiscal_period", { p_year: year, p_month: month, p_lock: lock });
    setBusyKey(null);
    if (error) {
      toast({ title: "Couldn't close period", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: lock ? "Period closed and locked" : "Period closed", description: "New journal entries dated inside it are now blocked." });
    load();
  };

  const submitReopen = async () => {
    if (!reopenTarget || !reopenReason.trim()) return;
    const key = `${reopenTarget.year}-${reopenTarget.month}`;
    setBusyKey(key);
    const { error } = await supabase.rpc("reopen_fiscal_period", {
      p_year: reopenTarget.year,
      p_month: reopenTarget.month,
      p_reason: reopenReason.trim(),
    });
    setBusyKey(null);
    if (error) {
      toast({ title: "Couldn't reopen period", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Period reopened" });
    setReopenTarget(null);
    setReopenReason("");
    load();
  };

  if (!role) return null;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Finance"
        title="Day-End Closings"
        subtitle="Locks a month against new or edited journal postings once its books are final. Granularity is monthly, matching this ledger's own period model."
        icon={CalendarClock}
        actions={
          <Link href="/finance" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Finance
          </Link>
        }
      />

      {!canClose && (
        <div className="bg-warning/10 border border-warning/20 text-warning rounded-xl p-3 text-sm">
          Only CEO/ADMIN can close or reopen periods. You can view status here.
        </div>
      )}

      <SectionCard title="Recent periods">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Closed by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map(({ year, month }) => {
                  const r = rowFor(year, month);
                  const key = `${year}-${month}`;
                  const busy = busyKey === key;
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{MONTH_NAMES[month - 1]} {year}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "open" ? "outline" : r.status === "locked" ? "destructive" : "secondary"} className="capitalize">
                          {r.status === "locked" && <Lock className="w-3 h-3 mr-1" />}
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.closedByName ? `${r.closedByName} · ${r.closed_at ? new Date(r.closed_at).toLocaleDateString() : ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {canClose && (
                          <div className="flex justify-end gap-2">
                            {r.status === "open" && (
                              <>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => close(year, month, false)} className="gap-1.5">
                                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LockOpen className="w-3.5 h-3.5" />} Close
                                </Button>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => close(year, month, true)} className="gap-1.5">
                                  <Lock className="w-3.5 h-3.5" /> Close &amp; Lock
                                </Button>
                              </>
                            )}
                            {r.status === "closed" && (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => setReopenTarget({ year, month })} className="gap-1.5">
                                <Unlock className="w-3.5 h-3.5" /> Reopen
                              </Button>
                            )}
                            {r.status === "locked" && (
                              <span className="text-xs text-muted-foreground italic">Locked — cannot be reopened</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Dialog open={!!reopenTarget} onOpenChange={(o) => !o && setReopenTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Reopen period</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {reopenTarget ? `${MONTH_NAMES[reopenTarget.month - 1]} ${reopenTarget.year}` : ""} will accept new journal postings again. This is recorded on the audit trail.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Reason *</Label>
              <Input value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReopenTarget(null)}>Cancel</Button>
              <Button onClick={submitReopen} disabled={!reopenReason.trim() || busyKey !== null} className="gap-2">
                <Unlock className="w-4 h-4" /> Reopen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
