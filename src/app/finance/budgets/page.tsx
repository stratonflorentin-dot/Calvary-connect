"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, SectionCard, StatCard, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { format } from "date-fns";
import { ArrowLeft, Loader2, Plus, RefreshCw, Wallet } from "lucide-react";

const ALLOWED_ROLES = ["CEO", "ADMIN", "HR", "ACCOUNTANT"];
const CAN_WRITE_ROLES = ["CEO", "ADMIN", "ACCOUNTANT"];

const PERIOD_LABEL: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  custom: "Custom",
};

const BAND_META: Record<string, { label: string; chip: string }> = {
  ok: { label: "On track", chip: "bg-success/10 text-success" },
  warning: { label: "Near limit", chip: "bg-warning/10 text-warning" },
  over: { label: "Over budget", chip: "bg-destructive/10 text-destructive" },
};

interface BudgetRow {
  id: string;
  budgetName: string;
  amount: number;
  currency: string;
  periodType: string;
  startDate: string;
  endDate: string;
  status: string;
  department: string | null;
  categoryName: string | null;
  vehiclePlate: string | null;
  actual: number;
  remaining: number;
  pctUsed: number | null;
  band: "ok" | "warning" | "over" | null;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface VehicleOption {
  id: string;
  plate_number: string;
}

export default function BudgetsPage() {
  const { role, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const canView = !roleLoading && ALLOWED_ROLES.includes(String(role || "").toUpperCase());
  const canWrite = CAN_WRITE_ROLES.includes(String(role || "").toUpperCase());

  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [summary, setSummary] = useState<{
    byCurrency: Record<string, { budgeted: number; actual: number }>;
    currencies: string[];
    overCount: number;
    warningCount: number;
  } | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [budgetName, setBudgetName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [vehicleId, setVehicleId] = useState("none");
  const [department, setDepartment] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("TZS");
  const [periodType, setPeriodType] = useState("monthly");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-01"));
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/finance/budgets", {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const result = await res.json();
      if (result.success) {
        setRows(result.data);
        setSummary(result.summary);
      } else {
        toast({ title: "Couldn't load budgets", description: result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Couldn't load budgets", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    const [catRes, vehRes] = await Promise.all([
      supabase.from("financial_categories").select("id, name").eq("type", "expense").order("name"),
      supabase.from("vehicles").select("id, plate_number").order("plate_number"),
    ]);
    setCategories((catRes.data as CategoryOption[]) ?? []);
    setVehicles((vehRes.data as VehicleOption[]) ?? []);
  };

  useEffect(() => {
    if (canView) {
      load();
      loadOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const createBudget = async () => {
    if (!budgetName.trim()) {
      toast({ title: "Name the budget", variant: "destructive" });
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!endDate) {
      toast({ title: "Set an end date", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("budgets").insert({
      budget_name: budgetName.trim(),
      category_id: categoryId || null,
      vehicle_id: vehicleId === "none" ? null : vehicleId,
      department: department.trim() || null,
      amount: amountNum,
      currency,
      period_type: periodType,
      start_date: startDate,
      end_date: endDate,
      status: "active",
      notes: notes.trim() || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't create budget", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Budget created" });
    setCreateOpen(false);
    setBudgetName("");
    setCategoryId("");
    setVehicleId("none");
    setDepartment("");
    setAmount("");
    setEndDate("");
    setNotes("");
    load();
  };

  const closeBudget = async (id: string) => {
    const { error } = await supabase.from("budgets").update({ status: "closed" }).eq("id", id);
    if (error) {
      toast({ title: "Couldn't close budget", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  if (roleLoading) return null;
  if (!canView) {
    return (
      <div className="space-y-6 pb-8">
        <EmptyState icon={Wallet} title="Access denied" description="You don't have permission to view budgets." />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Finance"
        title="Budget vs Actual"
        subtitle="Set spending caps by category, vehicle or department, and track real spend against them"
        icon={Wallet}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Finance
            </Link>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            {canWrite && (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-3.5 h-3.5" /> New budget
              </Button>
            )}
          </div>
        }
      />

      {summary && (
        <div className="space-y-4 mb-6">
          {/* One budgeted/actual pair per currency — never summed together,
              same "Mixed currencies" convention as the rest of Finance. */}
          {summary.currencies.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {summary.currencies.map((cur) => (
                <div key={cur} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{cur} budgeted</p>
                    <p className="text-lg font-black text-foreground">{formatCurrency(summary.byCurrency[cur].budgeted, cur)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{cur} actual</p>
                    <p className="text-lg font-black text-foreground">{formatCurrency(summary.byCurrency[cur].actual, cur)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Near limit" value={summary.warningCount} icon={Wallet} accent="bg-warning/10 text-warning" />
            <StatCard label="Over budget" value={summary.overCount} icon={Wallet} accent="bg-destructive/10 text-destructive" />
          </div>
        </div>
      )}

      <SectionCard title="All budgets">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Wallet} title="No budgets set" description="Create one above." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Budget</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Budgeted</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const bandMeta = r.band ? BAND_META[r.band] : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.budgetName}
                        {r.status === "closed" && <Badge variant="outline" className="ml-2">Closed</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[r.categoryName, r.vehiclePlate, r.department].filter(Boolean).join(" · ") || "Company-wide"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {PERIOD_LABEL[r.periodType] ?? r.periodType}
                        <div className="text-xs">{r.startDate} → {r.endDate}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(r.amount, r.currency)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(r.actual, r.currency)}</TableCell>
                      <TableCell className={`text-right font-mono ${r.remaining < 0 ? "text-destructive" : ""}`}>
                        {formatCurrency(r.remaining, r.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        {bandMeta ? (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${bandMeta.chip}`}>
                            {bandMeta.label}{r.pctUsed !== null ? ` (${r.pctUsed}%)` : ""}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {canWrite && r.status !== "closed" && (
                          <Button size="sm" variant="outline" onClick={() => closeBudget(r.id)}>Close</Button>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <DialogTitle>New budget</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Budget name *</Label>
              <Input value={budgetName} onChange={(e) => setBudgetName(e.target.value)} placeholder="e.g. Q1 Fuel — Fleet" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vehicle (optional)</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Company-wide</SelectItem>
                    {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department (optional, informational only)</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Operations" />
              <p className="text-xs text-muted-foreground">Expenses aren't tagged by department, so this label doesn't affect the actual-spend match.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount *</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TZS">TZS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Period</Label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start date *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End date *</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={createBudget} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create budget
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
