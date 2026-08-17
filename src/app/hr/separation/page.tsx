"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell, PageHeader, SectionCard, StatCard, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { applyTransition } from "@/lib/workflow/engine";
import { calculatePayslip } from "@/lib/finance/payroll/statutory-rates";
import { format } from "date-fns";
import { Calculator, LogOut, Loader2, Plus, Receipt } from "lucide-react";

const ALLOWED_ROLES = ["CEO", "ADMIN", "HR", "ACCOUNTANT"];

const TYPE_LABEL: Record<string, string> = {
  resignation: "Resignation",
  termination: "Termination",
  end_of_contract: "End of Contract",
  retirement: "Retirement",
  redundancy: "Redundancy",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  initiated: { label: "Initiated", variant: "outline" },
  clearance_in_progress: { label: "Clearance in progress", variant: "secondary" },
  pending_final_pay: { label: "Pending final pay", variant: "default" },
  completed: { label: "Completed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const formatTZS = (v: number) => `TZS ${Math.round(v).toLocaleString("en-TZ")}`;

interface FinalPayBreakdown {
  compensation_effective_from: string;
  monthly_gross: number;
  days_in_month: number;
  day_of_month: number;
  prorated_gross: number;
  loan_payoff: number;
  paye: number;
  nssf_employee: number;
  nhif_employee: number;
  net_pay: number;
}

interface SeparationCase {
  id: string;
  case_number: string;
  employee_id: string;
  separation_type: string;
  reason: string | null;
  notice_date: string;
  last_working_day: string;
  status: string;
  clearance_it: boolean;
  clearance_assets: boolean;
  clearance_finance: boolean;
  final_pay_breakdown: FinalPayBreakdown | null;
  final_pay_computed_at: string | null;
  final_pay_expense_id: string | null;
  employee?: { name: string; employee_id: string | null } | null;
}

interface StaffOption {
  id: string;
  name: string;
  employee_id: string | null;
}

export default function SeparationCasesPage() {
  const { role, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const canView = !roleLoading && ALLOWED_ROLES.includes(String(role || "").toUpperCase());

  const [cases, setCases] = useState<SeparationCase[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [computing, setComputing] = useState(false);
  const [raising, setRaising] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [separationType, setSeparationType] = useState("resignation");
  const [reason, setReason] = useState("");
  const [noticeDate, setNoticeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lastWorkingDay, setLastWorkingDay] = useState("");

  const [detail, setDetail] = useState<SeparationCase | null>(null);

  const load = async () => {
    setLoading(true);
    const [caseRes, staffRes] = await Promise.all([
      supabase
        .from("separation_cases")
        .select("*, employee:user_profiles!employee_id(name, employee_id)")
        .order("created_at", { ascending: false }),
      supabase.from("user_profiles").select("id, name, employee_id").eq("status", "active").order("name"),
    ]);
    if (caseRes.error) {
      toast({ title: "Couldn't load cases", description: caseRes.error.message, variant: "destructive" });
    } else {
      setCases((caseRes.data as unknown as SeparationCase[]) ?? []);
    }
    setStaff((staffRes.data as StaffOption[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const createCase = async () => {
    if (!employeeId) {
      toast({ title: "Pick an employee", variant: "destructive" });
      return;
    }
    if (!lastWorkingDay) {
      toast({ title: "Set the last working day", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: caseNumber, error: numErr } = await supabase.rpc("next_doc_number", { p_type: "separation_case" });
    if (numErr) {
      setSaving(false);
      toast({ title: "Couldn't generate case number", description: numErr.message, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("separation_cases").insert({
      case_number: caseNumber,
      employee_id: employeeId,
      separation_type: separationType,
      reason: reason || null,
      notice_date: noticeDate,
      last_working_day: lastWorkingDay,
      initiated_by: user?.id ?? null,
      status: "initiated",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't create case", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Separation case started", description: `${caseNumber} created.` });
    setCreateOpen(false);
    setEmployeeId("");
    setReason("");
    setLastWorkingDay("");
    load();
  };

  const refreshDetail = (updated: any) => {
    setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
    load();
  };

  const toggleClearance = async (field: "clearance_it" | "clearance_assets" | "clearance_finance", value: boolean) => {
    if (!detail) return;
    const { error } = await supabase.from("separation_cases").update({ [field]: value }).eq("id", detail.id);
    if (error) {
      toast({ title: "Couldn't update clearance", description: error.message, variant: "destructive" });
      return;
    }
    refreshDetail({ [field]: value });
  };

  const computeFinalPay = async () => {
    if (!detail) return;
    setComputing(true);
    try {
      const { data: comp, error: compErr } = await supabase
        .from("employee_compensation")
        .select("base_salary, housing_allowance, transport_allowance, other_allowances, effective_from")
        .eq("employee_id", detail.employee_id)
        .lte("effective_from", detail.last_working_day)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (compErr) throw compErr;
      if (!comp) {
        toast({ title: "No compensation record found", description: "This employee has no employee_compensation row effective by their last working day.", variant: "destructive" });
        return;
      }

      const { data: loans, error: loanErr } = await supabase
        .from("employee_loans")
        .select("outstanding_balance")
        .eq("employee_id", detail.employee_id)
        .eq("status", "active");
      if (loanErr) throw loanErr;
      const loanPayoff = (loans ?? []).reduce((s, l: any) => s + (Number(l.outstanding_balance) || 0), 0);

      const lwd = new Date(detail.last_working_day);
      const daysInMonth = new Date(lwd.getFullYear(), lwd.getMonth() + 1, 0).getDate();
      const dayOfMonth = lwd.getDate();
      const monthlyGross =
        Number(comp.base_salary) + Number(comp.housing_allowance) + Number(comp.transport_allowance) + Number(comp.other_allowances);
      const proratedGross = Math.round((monthlyGross / daysInMonth) * dayOfMonth);

      const calc = calculatePayslip(proratedGross, loanPayoff, detail.last_working_day);

      const breakdown: FinalPayBreakdown = {
        compensation_effective_from: comp.effective_from,
        monthly_gross: monthlyGross,
        days_in_month: daysInMonth,
        day_of_month: dayOfMonth,
        prorated_gross: proratedGross,
        loan_payoff: loanPayoff,
        paye: calc.paye,
        nssf_employee: calc.nssfEmployee,
        nhif_employee: calc.nhifEmployee,
        net_pay: calc.netPay,
      };

      const { error: updErr } = await supabase
        .from("separation_cases")
        .update({ final_pay_breakdown: breakdown, final_pay_computed_at: new Date().toISOString(), final_pay_computed_by: user?.id ?? null })
        .eq("id", detail.id);
      if (updErr) throw updErr;

      toast({ variant: "success", title: "Final pay computed", description: `Net pay: ${formatTZS(calc.netPay)}` });
      refreshDetail({ final_pay_breakdown: breakdown, final_pay_computed_at: new Date().toISOString() });
    } catch (err: any) {
      toast({ title: "Couldn't compute final pay", description: err.message, variant: "destructive" });
    } finally {
      setComputing(false);
    }
  };

  const raiseFinalPayExpense = async () => {
    if (!detail || !detail.final_pay_breakdown) return;
    setRaising(true);
    try {
      const { data: expense, error: expErr } = await supabase
        .from("expenses")
        .insert({
          type: "payroll",
          category: "Final Pay",
          description: `Final pay — ${detail.employee?.name || detail.employee_id} (${detail.case_number})`,
          amount: detail.final_pay_breakdown.net_pay,
          currency: "TZS",
          status: "pending",
          employee_id: detail.employee?.employee_id ?? null,
          created_by: user?.id ?? null,
          date: format(new Date(), "yyyy-MM-dd"),
        })
        .select("id")
        .single();
      if (expErr) throw expErr;

      const { error: updErr } = await supabase
        .from("separation_cases")
        .update({ final_pay_expense_id: expense.id })
        .eq("id", detail.id);
      if (updErr) throw updErr;

      toast({ variant: "success", title: "Final pay expense raised", description: "Approve and pay it from Finance → Expenses like any other expense." });
      refreshDetail({ final_pay_expense_id: expense.id });
    } catch (err: any) {
      toast({ title: "Couldn't raise expense", description: err.message, variant: "destructive" });
    } finally {
      setRaising(false);
    }
  };

  if (roleLoading) return null;
  if (!canView) {
    return (
      <PageShell>
        <EmptyState icon={LogOut} title="Access denied" description="You don't have permission to view separation cases." />
      </PageShell>
    );
  }

  const activeCount = cases.filter((c) => !["completed", "cancelled"].includes(c.status)).length;
  const completedCount = cases.filter((c) => c.status === "completed").length;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Human Resources"
        title="Separation & exit cases"
        subtitle="Clearance checklist and final pay, from notice to last working day"
        icon={LogOut}
        crumbs={[{ label: "HR", href: "/hr" }, { label: "Separation Cases" }]}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> Start separation
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total cases" value={cases.length} icon={LogOut} accent="bg-primary/10 text-primary" />
        <StatCard label="In progress" value={activeCount} icon={LogOut} accent="bg-warning/10 text-warning" />
        <StatCard label="Completed" value={completedCount} icon={LogOut} accent="bg-success/10 text-success" />
      </div>

      <SectionCard title="All cases">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : cases.length === 0 ? (
          <EmptyState icon={LogOut} title="No separation cases" description="Start one above." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case #</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last working day</TableHead>
                  <TableHead>Net final pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => {
                  const statusMeta = STATUS_BADGE[c.status] ?? { label: c.status, variant: "outline" as const };
                  return (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetail(c)}>
                      <TableCell className="font-mono text-xs font-semibold">{c.case_number}</TableCell>
                      <TableCell className="font-medium">{c.employee?.name || c.employee_id}</TableCell>
                      <TableCell>{TYPE_LABEL[c.separation_type] ?? c.separation_type}</TableCell>
                      <TableCell className="text-muted-foreground">{c.last_working_day}</TableCell>
                      <TableCell>{c.final_pay_breakdown ? formatTZS(c.final_pay_breakdown.net_pay) : "—"}</TableCell>
                      <TableCell><Badge variant={statusMeta.variant}>{statusMeta.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <DialogTitle>Start separation case</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Employee *</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={separationType} onValueChange={setSeparationType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Notice date</Label>
                <Input type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last working day *</Label>
                <Input type="date" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={createCase} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Start case
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <DialogTitle className="flex items-center gap-2">
                    {detail.case_number}
                    <Badge variant={(STATUS_BADGE[detail.status] ?? { variant: "outline" as const }).variant}>
                      {(STATUS_BADGE[detail.status] ?? { label: detail.status }).label}
                    </Badge>
                  </DialogTitle>
                </div>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Employee</Label>
                    <p className="font-medium">{detail.employee?.name || detail.employee_id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <p>{TYPE_LABEL[detail.separation_type] ?? detail.separation_type}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Notice date</Label>
                    <p>{detail.notice_date}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Last working day</Label>
                    <p>{detail.last_working_day}</p>
                  </div>
                </div>
                {detail.reason && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Reason</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{detail.reason}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Clearance checklist</Label>
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    {([
                      ["clearance_it", "IT access revoked"],
                      ["clearance_assets", "Company assets returned"],
                      ["clearance_finance", "Finance clearance (advances, fuel card, etc.)"],
                    ] as const).map(([field, label]) => (
                      <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={detail[field]}
                          onCheckedChange={(v) => toggleClearance(field, v === true)}
                          disabled={["completed", "cancelled"].includes(detail.status)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Final pay</Label>
                    {!["completed", "cancelled"].includes(detail.status) && (
                      <Button size="sm" variant="outline" onClick={computeFinalPay} disabled={computing} className="gap-1.5">
                        {computing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
                        {detail.final_pay_breakdown ? "Recompute" : "Compute"}
                      </Button>
                    )}
                  </div>
                  {detail.final_pay_breakdown ? (
                    <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">Prorated gross ({detail.final_pay_breakdown.day_of_month}/{detail.final_pay_breakdown.days_in_month} days)</span><span className="font-mono">{formatTZS(detail.final_pay_breakdown.prorated_gross)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">PAYE</span><span className="font-mono">-{formatTZS(detail.final_pay_breakdown.paye)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">NSSF</span><span className="font-mono">-{formatTZS(detail.final_pay_breakdown.nssf_employee)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">NHIF</span><span className="font-mono">-{formatTZS(detail.final_pay_breakdown.nhif_employee)}</span></div>
                      {detail.final_pay_breakdown.loan_payoff > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Outstanding loan payoff</span><span className="font-mono">-{formatTZS(detail.final_pay_breakdown.loan_payoff)}</span></div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-border font-bold"><span>Net pay</span><span className="font-mono">{formatTZS(detail.final_pay_breakdown.net_pay)}</span></div>
                      <p className="text-xs text-muted-foreground pt-1">
                        Based on the employee_compensation record effective {detail.final_pay_breakdown.compensation_effective_from}. Doesn't include leave payout — this system has no leave-balance ledger, so add that manually if applicable before paying.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not yet computed.</p>
                  )}
                  {detail.final_pay_breakdown && !detail.final_pay_expense_id && (
                    <Button size="sm" onClick={raiseFinalPayExpense} disabled={raising} className="gap-1.5">
                      {raising ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />}
                      Raise as expense
                    </Button>
                  )}
                  {detail.final_pay_expense_id && (
                    <p className="text-xs text-success flex items-center gap-1">
                      <Receipt className="w-3.5 h-3.5" /> Expense raised —{" "}
                      <Link href="/expenses" className="underline">view in Finance → Expenses</Link>
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-border">
                  <TransitionButtons
                    kind="separation_case"
                    entity={detail}
                    actorId={user?.id ?? ""}
                    actorRole={role as any}
                    size="sm"
                    onDone={refreshDetail}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
