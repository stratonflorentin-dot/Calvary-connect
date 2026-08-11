"use client";

import { useEffect, useState } from "react";
import { PageShell, PageHeader, SectionCard, StatCard, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { HandCoins, Loader2, Plus, Users, Wallet } from "lucide-react";

const ALLOWED_ROLES = ["CEO", "ADMIN", "HR", "ACCOUNTANT"];

const formatAmount = (value: number, currency: string) =>
  `${currency} ${Number(value ?? 0).toLocaleString("en-TZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  active: { label: "Active", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

interface LoanRow {
  id: string;
  employee_id: string;
  principal_amount: number;
  outstanding_balance: number;
  installment_amount: number;
  currency: string;
  reason: string | null;
  status: "active" | "completed" | "cancelled";
  issued_date: string;
  employee?: { name: string } | null;
}

interface EmployeeOption {
  id: string;
  name: string;
}

export default function EmployeeLoansPage() {
  const { role, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const canView = !roleLoading && ALLOWED_ROLES.includes(String(role || "").toUpperCase());

  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [installment, setInstallment] = useState("");
  const [currency, setCurrency] = useState("TZS");
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    const [loanRes, empRes] = await Promise.all([
      supabase
        .from("employee_loans")
        .select("id, employee_id, principal_amount, outstanding_balance, installment_amount, currency, reason, status, issued_date, employee:user_profiles!employee_id(name)")
        .order("created_at", { ascending: false }),
      supabase.from("user_profiles").select("id, name").eq("status", "active").order("name"),
    ]);
    if (loanRes.error) {
      toast({ title: "Couldn't load loans", description: loanRes.error.message, variant: "destructive" });
    } else {
      setLoans((loanRes.data as unknown as LoanRow[]) ?? []);
    }
    setEmployees((empRes.data as EmployeeOption[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const issueLoan = async () => {
    const principalNum = Number(principal);
    const installmentNum = Number(installment);
    if (!employeeId) {
      toast({ title: "Pick an employee", variant: "destructive" });
      return;
    }
    if (!principalNum || principalNum <= 0 || !installmentNum || installmentNum <= 0) {
      toast({ title: "Enter a valid principal and installment amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("employee_loans").insert({
      employee_id: employeeId,
      principal_amount: principalNum,
      outstanding_balance: principalNum,
      installment_amount: installmentNum,
      currency,
      reason: reason || null,
      status: "active",
      approved_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't issue loan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Loan issued", description: `${formatAmount(installmentNum, currency)} will be deducted each payroll run until repaid.` });
    setEmployeeId("");
    setPrincipal("");
    setInstallment("");
    setReason("");
    load();
  };

  const cancelLoan = async (id: string) => {
    if (!window.confirm("Cancel this loan? No further deductions will be applied.")) return;
    const { error } = await supabase.from("employee_loans").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      toast({ title: "Couldn't cancel loan", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  if (roleLoading) return null;
  if (!canView) {
    return (
      <PageShell>
        <EmptyState icon={HandCoins} title="Access denied" description="You don't have permission to view employee loans." />
      </PageShell>
    );
  }

  const activeLoans = loans.filter((l) => l.status === "active");
  const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Payroll"
        title="Employee loans & salary advances"
        subtitle="Issue a loan; its installment is deducted automatically from every payroll run until repaid."
        icon={HandCoins}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Active loans" value={activeLoans.length} icon={Users} accent="bg-primary/10 text-primary" />
        <StatCard label="Outstanding (TZS)" value={formatAmount(totalOutstanding, "TZS")} icon={Wallet} accent="bg-warning/10 text-warning" />
      </div>

      <SectionCard title="Issue a new loan">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label className="text-xs mb-1.5 block">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Principal</Label>
            <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Installment / run</Label>
            <Input type="number" value={installment} onChange={(e) => setInstallment(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TZS">TZS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={issueLoan} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Issue loan
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <Label className="text-xs mb-1.5 block">Reason (optional)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
      </SectionCard>

      <SectionCard title="All loans" className="mt-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : loans.length === 0 ? (
          <EmptyState icon={HandCoins} title="No loans issued yet" description="Issue one above." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Installment</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((l) => {
                const badge = STATUS_BADGE[l.status] ?? { label: l.status, variant: "outline" as const };
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.employee?.name || l.employee_id}</TableCell>
                    <TableCell className="text-right">{formatAmount(l.principal_amount, l.currency)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatAmount(l.outstanding_balance, l.currency)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatAmount(l.installment_amount, l.currency)}</TableCell>
                    <TableCell className="text-muted-foreground">{l.issued_date}</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {l.status === "active" && (
                        <Button variant="outline" size="sm" onClick={() => cancelLoan(l.id)}>Cancel</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </PageShell>
  );
}
