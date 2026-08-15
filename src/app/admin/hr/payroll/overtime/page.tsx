"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell, PageHeader, SectionCard, EmptyState } from "@/components/shell";
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
import { Clock, Loader2, Send } from "lucide-react";

const HR_ROLES = ["CEO", "ADMIN", "HR", "ACCOUNTANT"];

// Suggested-only: hours worked per month used to derive an hourly rate, and
// the overtime premium multiplier. NEITHER is verified against Tanzania's
// Employment and Labour Relations Act — same caveat as the statutory tax
// rates. This only pre-fills a field a human must confirm before approving;
// it never writes a number nobody looked at.
const ASSUMED_MONTHLY_HOURS = 208;
const SUGGESTED_MULTIPLIER = 1.5;

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

interface OvertimeRow {
  id: string;
  employee_id: string;
  year: number;
  month: number;
  hours: number;
  computed_amount: number;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  employee?: { name: string } | null;
}

interface EmployeeOption {
  id: string;
  name: string;
}

export default function OvertimePage() {
  const { role, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const isHr = HR_ROLES.includes(String(role || "").toUpperCase());

  const now = new Date();
  const [rows, setRows] = useState<OvertimeRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [hours, setHours] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const query = supabase
      .from("overtime_entries")
      .select("id, employee_id, year, month, hours, computed_amount, status, note, employee:user_profiles!employee_id(name)")
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    const res = isHr ? await query.limit(200) : await query.eq("employee_id", user.id);
    if (res.error) {
      toast({ title: "Couldn't load overtime entries", description: res.error.message, variant: "destructive" });
    } else {
      setRows((res.data as unknown as OvertimeRow[]) ?? []);
    }
    if (isHr) {
      const empRes = await supabase.from("user_profiles").select("id, name").eq("status", "active").order("name");
      setEmployees((empRes.data as EmployeeOption[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!roleLoading && user?.id) {
      if (!isHr) setEmployeeId(user.id);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, user?.id, isHr]);

  const suggestAmount = async () => {
    const targetEmployee = employeeId || user?.id;
    const hrs = Number(hours);
    if (!targetEmployee || !hrs) return;
    const { data } = await supabase
      .from("employee_compensation")
      .select("base_salary")
      .eq("employee_id", targetEmployee)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.base_salary) {
      const hourly = Number(data.base_salary) / ASSUMED_MONTHLY_HOURS;
      setAmount(String(Math.round(hourly * SUGGESTED_MULTIPLIER * hrs)));
    }
  };

  const submit = async () => {
    const targetEmployee = employeeId || user?.id;
    const hrs = Number(hours);
    const amt = Number(amount);
    if (!targetEmployee || !hrs || hrs <= 0) {
      toast({ title: "Enter hours worked", variant: "destructive" });
      return;
    }
    if (!amt || amt <= 0) {
      toast({ title: "Enter or confirm the overtime amount", description: "Use \"Suggest\" for a starting point, then confirm it's right.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("overtime_entries").upsert(
      {
        employee_id: targetEmployee,
        year,
        month,
        hours: hrs,
        rate_multiplier: SUGGESTED_MULTIPLIER,
        computed_amount: amt,
        note: note || null,
        status: "pending",
      },
      { onConflict: "employee_id,year,month" },
    );
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't submit overtime", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Overtime submitted", description: "Awaiting approval before it's included in payroll." });
    setHours("");
    setAmount("");
    setNote("");
    load();
  };

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("overtime_entries")
      .update({ status, approved_by: user?.id ?? null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Couldn't update overtime entry", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  if (roleLoading) return null;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Payroll"
        title="Overtime"
        subtitle="Submit hours worked beyond the normal schedule; approved entries are added to the next payroll run for that month."
        icon={Clock}
      />

      <SectionCard title="Submit overtime">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {isHr && (
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
          )}
          <div>
            <Label className="text-xs mb-1.5 block">Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthNames.map((n, i) => (
                  <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Hours</Label>
            <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} onBlur={suggestAmount} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Amount (TZS)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Confirm before submitting" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          The amount is only ever a suggestion ({SUGGESTED_MULTIPLIER}× an assumed {ASSUMED_MONTHLY_HOURS}-hour month) — not verified against labour law. Confirm or correct it before submitting.
        </p>
        <div className="mt-3">
          <Label className="text-xs mb-1.5 block">Note (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>
        <div className="flex justify-end mt-4 pt-4 border-t border-border">
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Submit
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={isHr ? "All overtime entries" : "My overtime entries"} className="mt-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Clock} title="No overtime entries yet" description="Submit one above." />
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isHr && <TableHead>Employee</TableHead>}
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                {isHr && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const badge = STATUS_BADGE[r.status] ?? { label: r.status, variant: "outline" as const };
                return (
                  <TableRow key={r.id}>
                    {isHr && <TableCell className="font-medium">{r.employee?.name || r.employee_id}</TableCell>}
                    <TableCell className="text-muted-foreground">{monthNames[r.month - 1]} {r.year}</TableCell>
                    <TableCell className="text-right">{r.hours}</TableCell>
                    <TableCell className="text-right font-semibold">TZS {Number(r.computed_amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    {isHr && (
                      <TableCell className="text-right">
                        {r.status === "pending" && (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                            <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
