"use client";

import { useState } from "react";
import { PageShell, PageHeader, SectionCard, StatCard, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import {
  Wallet, Play, CheckCircle2, BookCheck, Loader2, FileText, Landmark,
  Users, TrendingDown, HandCoins,
} from "lucide-react";

const formatAmount = (value: number) =>
  `TZS ${Number(value ?? 0).toLocaleString("en-TZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "outline" },
  approved: { label: "Approved", variant: "secondary" },
  posted: { label: "Posted", variant: "default" },
  paid: { label: "Paid", variant: "default" },
};

async function authedFetch(url: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function PayrollRunPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [payDate, setPayDate] = useState(() => now.toISOString().slice(0, 10));
  const [loading, setLoading] = useState<string | null>(null);
  const [period, setPeriod] = useState<any>(null);
  const [payslips, setPayslips] = useState<any[]>([]);

  const loadPeriod = async (y = year, m = month) => {
    setLoading("load");
    try {
      const data = await authedFetch(`/api/admin/hr/payroll/run?year=${y}&month=${m}`);
      setPeriod(data.period);
      setPayslips(data.payslips || []);
    } catch (error: any) {
      toast({ title: "Couldn't load payroll period", description: error.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const runAction = async (action: "generate" | "approve" | "post") => {
    setLoading(action);
    try {
      if (action === "generate") {
        await authedFetch("/api/admin/hr/payroll/run", {
          method: "POST",
          body: JSON.stringify({ action, year, month, payDate }),
        });
        toast({ variant: "success", title: "Payroll generated", description: `Draft payslips created for ${monthNames[month - 1]} ${year}.` });
      } else {
        await authedFetch("/api/admin/hr/payroll/run", {
          method: "POST",
          body: JSON.stringify({ action, payrollPeriodId: period.id }),
        });
        toast({
          title: action === "approve" ? "Payroll approved" : "Posted to the ledger",
          description: action === "post" ? "A journal entry now reflects this payroll run." : undefined,
        });
      }
      await loadPeriod();
    } catch (error: any) {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const downloadFile = async (path: string, filenameFallback: string) => {
    setLoading("download");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(path, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Export failed");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameFallback;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const totals = payslips.reduce(
    (acc, p) => ({
      gross: acc.gross + Number(p.gross_pay),
      net: acc.net + Number(p.net_pay),
      statutory: acc.statutory + Number(p.paye) + Number(p.nssf_employee) + Number(p.nhif_employee),
    }),
    { gross: 0, net: 0, statutory: 0 },
  );

  const badge = period ? (STATUS_BADGE[period.status] ?? { label: period.status, variant: "outline" as const }) : null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Payroll"
        title="Run payroll"
        subtitle="Generate payslips from current salary structures, approve, then post to the general ledger."
        icon={Wallet}
      />

      <SectionCard title="Period" subtitle="Choose the month to run, then generate payslips.">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-28">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Year</label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="w-44">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Month</label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthNames.map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Pay date</label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => loadPeriod()} disabled={loading === "load"}>
            {loading === "load" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Load
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5 pt-5 border-t border-border">
          <Button onClick={() => runAction("generate")} disabled={!!loading || (period && period.status !== "draft")}>
            {loading === "generate" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {period ? "Regenerate draft" : "Generate payroll"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => runAction("approve")}
            disabled={!!loading || !period || period.status !== "draft"}
          >
            {loading === "approve" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Approve
          </Button>
          <Button
            onClick={() => runAction("post")}
            disabled={!!loading || !period || period.status !== "approved"}
          >
            {loading === "post" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BookCheck className="h-4 w-4 mr-2" />}
            Post to ledger
          </Button>

          {period && badge && (
            <Badge variant={badge.variant} className="ml-auto">{badge.label}</Badge>
          )}
        </div>
      </SectionCard>

      {payslips.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <StatCard label="Employees" value={payslips.length} icon={Users} accent="bg-primary/10 text-primary" />
          <StatCard label="Gross pay" value={formatAmount(totals.gross)} icon={HandCoins} accent="bg-info/10 text-info" />
          <StatCard label="Statutory deductions" value={formatAmount(totals.statutory)} icon={TrendingDown} accent="bg-warning/10 text-warning" />
          <StatCard label="Net pay" value={formatAmount(totals.net)} icon={Wallet} accent="bg-success/10 text-success" />
        </div>
      )}

      <SectionCard
        title="Payslips"
        className="mt-6"
        actions={
          payslips.length > 0 && period ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!!loading}
                onClick={() => downloadFile(
                  `/api/admin/hr/payroll/run/payslip-pdf?payrollPeriodId=${period.id}`,
                  `payslips_${month}_${year}.pdf`,
                )}
              >
                <FileText className="h-4 w-4 mr-2" /> Payslips (PDF)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!loading || period.status === "draft"}
                onClick={() => downloadFile(
                  `/api/admin/hr/payroll/run/bank-file?payrollPeriodId=${period.id}`,
                  `payroll_bank_file_${month}_${year}.csv`,
                )}
              >
                <Landmark className="h-4 w-4 mr-2" /> Bank file
              </Button>
            </div>
          ) : undefined
        }
      >
        {payslips.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payslips loaded"
            description="Generate a payroll run above, or load an existing period to review it."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Gross pay</TableHead>
                  <TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">NSSF</TableHead>
                  <TableHead className="text-right">NHIF</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((p) => {
                  const rowBadge = STATUS_BADGE[p.status] ?? { label: p.status, variant: "outline" as const };
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.employee?.name || p.employee_id}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{p.cost_category}</TableCell>
                      <TableCell className="text-right">{formatAmount(p.gross_pay)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatAmount(p.paye)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatAmount(p.nssf_employee)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatAmount(p.nhif_employee)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatAmount(p.net_pay)}</TableCell>
                      <TableCell><Badge variant={rowBadge.variant}>{rowBadge.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            {period?.status === "draft" && (
              <p className="text-xs text-muted-foreground mt-3">
                Approve this period to unlock the bank disbursement file.
              </p>
            )}
          </>
        )}
      </SectionCard>
    </PageShell>
  );
}
