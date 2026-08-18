"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ChartOfAccountsService, COAAccount } from "@/services/chart-of-accounts-service";
import { ArrowLeft, Download, Loader2, Plus, Receipt, Trash2, Upload } from "lucide-react";
import { format } from "date-fns";

// Bulk Expenses: CSV import + a spreadsheet-style manual grid, both funneling
// into the same rows array and the same `expenses` insert shape the single
// New Expense form uses (expenses/page.tsx) — same status='pending' entry
// point into the normal approval workflow, no separate posting logic.
//
// The CSV template is deliberately minimal (date, description, amount,
// reference) — COA Account, Vendor and Payment Method are NEVER typed as
// CSV text. They're picked from real selectors after import, same reasoning
// as the bank-statement importer: eliminates name/code typos at the source
// instead of validating them after the fact. This app's expenses table has
// no VAT column, so unlike the generic spec this template doesn't carry one.

const CSV_TEMPLATE = "date,description,amount,reference\n2026-08-01,Example fuel top-up,50000,REF001\n";

interface Row {
  localId: string;
  date: string;
  description: string;
  amount: string;
  reference: string;
  accountCode: string;
  vendor: string;
  paymentMethod: string;
  vehicleId: string;
}

function emptyRow(): Row {
  return {
    localId: crypto.randomUUID(),
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    amount: "",
    reference: "",
    accountCode: "",
    vendor: "",
    paymentMethod: "cash",
    vehicleId: "none",
  };
}

function rowErrors(r: Row): string[] {
  const errs: string[] = [];
  if (!r.date) errs.push("date");
  if (!r.description.trim()) errs.push("description");
  if (!r.amount || Number(r.amount) <= 0) errs.push("amount");
  if (!r.accountCode) errs.push("account");
  return errs;
}

export default function BulkExpensesPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [accounts, setAccounts] = useState<COAAccount[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate_number: string }[]>([]);
  const [bulkAccountCode, setBulkAccountCode] = useState("");
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ChartOfAccountsService.getAccounts().then((a) => setAccounts(a.filter((x) => x.is_postable !== false)));
    supabase.from("vehicles").select("id, plate_number").order("plate_number").then(({ data }) => setVehicles(data ?? []));
  }, []);

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.localId === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.localId !== id) : prev));

  const onFilePicked = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      toast({ title: "Nothing to import", description: "The file has no data rows.", variant: "destructive" });
      return;
    }
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = {
      date: header.findIndex((h) => h.includes("date")),
      description: header.findIndex((h) => h.includes("desc")),
      amount: header.findIndex((h) => h.includes("amount")),
      reference: header.findIndex((h) => h.includes("ref")),
    };
    if (idx.date < 0 || idx.amount < 0) {
      toast({ title: "Couldn't read file", description: 'Expected at least "date" and "amount" columns.', variant: "destructive" });
      return;
    }
    const imported: Row[] = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return {
        ...emptyRow(),
        date: idx.date >= 0 ? cols[idx.date] ?? "" : "",
        description: idx.description >= 0 ? cols[idx.description] ?? "" : "",
        amount: idx.amount >= 0 ? cols[idx.amount] ?? "" : "",
        reference: idx.reference >= 0 ? cols[idx.reference] ?? "" : "",
      };
    });
    setRows((prev) => [...prev.filter((r) => rowErrors(r).length === 0 || r.description || r.amount), ...imported]);
    toast({ variant: "success", title: `${imported.length} row(s) imported`, description: "Pick an account for each row below before saving." });
    if (fileRef.current) fileRef.current.value = "";
  };

  const applyToAll = () => {
    if (!bulkAccountCode) {
      toast({ title: "Pick an account first", variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => ({ ...r, accountCode: bulkAccountCode, paymentMethod: bulkPaymentMethod })));
  };

  const validRows = rows.filter((r) => rowErrors(r).length === 0);
  const invalidCount = rows.length - validRows.length;

  const saveAll = async () => {
    if (validRows.length === 0) {
      toast({ title: "Nothing valid to save", description: "Every row needs a date, description, amount and account.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = validRows.map((r) => ({
      description: r.description.trim(),
      amount: Number(r.amount),
      date: r.date,
      account_code: r.accountCode,
      vendor: r.vendor || null,
      payment_method: r.paymentMethod,
      vehicle_id: r.vehicleId === "none" ? null : r.vehicleId,
      currency: "TZS",
      status: "pending",
      driver_id: user?.id ?? null,
      created_by: user?.id ?? null,
    }));
    const { error } = await supabase.from("expenses").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: `${payload.length} expense(s) saved`, description: "Entered as pending, same as the single-expense form." });
    setRows([emptyRow()]);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-expenses-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <Link href="/expenses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
                <ArrowLeft className="size-4" /> Back to Expenses
              </Link>
              <h1 className="text-3xl font-bold flex items-center gap-2"><Receipt className="size-7 text-primary" /> Bulk Expenses</h1>
              <p className="text-muted-foreground text-sm mt-1">Import a CSV or enter multiple rows manually, then save them all at once.</p>
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFilePicked(e.target.files[0])} />
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Import CSV
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={downloadTemplate}>
                <Download className="size-4" /> Template
              </Button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Apply to all rows — account</Label>
              <Select value={bulkAccountCode} onValueChange={setBulkAccountCode}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment method</Label>
              <Select value={bulkPaymentMethod} onValueChange={setBulkPaymentMethod}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={applyToAll}>Apply to all rows</Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRows((p) => [...p, emptyRow()])}>
              <Plus className="size-4" /> Add row
            </Button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Description</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Account</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Vendor</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Vehicle</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Payment</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-muted-foreground uppercase">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Ref</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const errs = rowErrors(r);
                  return (
                    <tr key={r.localId} className={errs.length > 0 ? "bg-destructive/5" : ""}>
                      <td className="px-2 py-1.5"><Input type="date" value={r.date} onChange={(e) => updateRow(r.localId, { date: e.target.value })} className="h-8 w-36" /></td>
                      <td className="px-2 py-1.5"><Input value={r.description} onChange={(e) => updateRow(r.localId, { description: e.target.value })} className="h-8 min-w-[180px]" /></td>
                      <td className="px-2 py-1.5">
                        <Select value={r.accountCode} onValueChange={(v) => updateRow(r.localId, { accountCode: v })}>
                          <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5"><Input value={r.vendor} onChange={(e) => updateRow(r.localId, { vendor: e.target.value })} className="h-8 w-32" /></td>
                      <td className="px-2 py-1.5">
                        <Select value={r.vehicleId} onValueChange={(v) => updateRow(r.localId, { vehicleId: v })}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_number}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={r.paymentMethod} onValueChange={(v) => updateRow(r.localId, { paymentMethod: v })}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="mobile_money">Mobile Money</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5"><Input type="number" value={r.amount} onChange={(e) => updateRow(r.localId, { amount: e.target.value })} className="h-8 w-28 text-right" /></td>
                      <td className="px-2 py-1.5"><Input value={r.reference} onChange={(e) => updateRow(r.localId, { reference: e.target.value })} className="h-8 w-24" /></td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeRow(r.localId)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {validRows.length} ready to save{invalidCount > 0 ? ` · ${invalidCount} row(s) need a date, description, amount and account` : ""}
            </p>
            <Button onClick={saveAll} disabled={saving || validRows.length === 0} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
              Save All Expenses ({validRows.length})
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
