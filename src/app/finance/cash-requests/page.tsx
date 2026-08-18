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
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { applyTransition } from "@/lib/workflow/engine";
import { formatCurrency } from "@/components/ui/currency-badge";
import { ArrowLeft, Loader2, Plus, Wallet } from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "outline" },
  pending: { label: "Pending approval", variant: "secondary" },
  approved: { label: "Approved", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
  disbursed: { label: "Disbursed", variant: "default" },
  retired: { label: "Retired", variant: "default" },
};

interface CashRequest {
  id: string;
  request_number: string | null;
  requester_id: string;
  trip_id: string | null;
  amount: number;
  currency: string;
  purpose: string;
  status: string;
  disbursed_from_account_id: string | null;
  actual_spent: number | null;
  returned_amount: number | null;
  retirement_notes: string | null;
  created_at: string;
  requester?: { name: string } | null;
}

interface BankAccountOption {
  id: string;
  account_name: string;
  bank_name: string;
  currency: string;
}

interface AccountOption {
  code: string;
  name: string;
  type: string;
}

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

export default function CashRequestsPage() {
  const { role } = useRole();
  const { user } = useSupabase();

  const [requests, setRequests] = useState<CashRequest[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("TZS");
  const [purpose, setPurpose] = useState("");

  const [detail, setDetail] = useState<CashRequest | null>(null);
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [disburseAccountId, setDisburseAccountId] = useState("");
  const [retireOpen, setRetireOpen] = useState(false);
  const [actualSpent, setActualSpent] = useState("");
  const [expenseAccountCode, setExpenseAccountCode] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [returnedAmount, setReturnedAmount] = useState("");
  const [returnAccountId, setReturnAccountId] = useState("");
  const [retirementNotes, setRetirementNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cash_requests")
      .select("*, requester:user_profiles!requester_id(name)")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Couldn't load cash requests", description: error.message, variant: "destructive" });
    setRequests((data as unknown as CashRequest[]) ?? []);
    setLoading(false);
  };

  const loadOptions = async () => {
    const [bankRes, acctRes] = await Promise.all([
      supabase.from("bank_accounts").select("id, account_name, bank_name, currency").order("account_name"),
      supabase.from("accounts").select("code, name, type").eq("is_postable", true).eq("is_active", true),
    ]);
    setBankAccounts((bankRes.data as BankAccountOption[]) ?? []);
    setExpenseAccounts(((acctRes.data as AccountOption[]) ?? []).filter((a) => a.type === "expense"));
  };

  useEffect(() => {
    load();
    loadOptions();
  }, []);

  const createRequest = async () => {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!purpose.trim()) {
      toast({ title: "Describe what this cash is for", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: requestNumber, error: numErr } = await supabase.rpc("next_doc_number", { p_type: "cash_request" });
    if (numErr) {
      setSaving(false);
      toast({ title: "Couldn't generate request number", description: numErr.message, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("cash_requests").insert({
      request_number: requestNumber,
      requester_id: user?.id ?? null,
      amount: amountNum,
      currency,
      purpose: purpose.trim(),
      status: "draft",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't create request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Cash request created", description: `${requestNumber} saved as draft.` });
    setCreateOpen(false);
    setAmount("");
    setPurpose("");
    load();
  };

  const refreshDetail = (updated: any) => {
    setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
    load();
  };

  const submitDisburse = async () => {
    if (!detail || !disburseAccountId) return;
    setBusy(true);
    const result = await applyTransition({
      kind: "cash_request", entityId: detail.id, toState: "disbursed",
      actorId: user?.id ?? "", actorRole: (role as any) ?? undefined,
      payload: { disbursed_from_account_id: disburseAccountId },
    });
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Disbursement failed", description: result.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Disbursed" });
    setDisburseOpen(false);
    setDisburseAccountId("");
    refreshDetail(result.entity);
  };

  const submitRetire = async () => {
    if (!detail) return;
    const spent = Number(actualSpent) || 0;
    if (spent > 0 && !expenseAccountCode) {
      toast({ title: "Choose an expense account", variant: "destructive" });
      return;
    }
    const returned = Number(returnedAmount) || 0;
    if (returned > 0 && !returnAccountId) {
      toast({ title: "Choose where the returned cash went", variant: "destructive" });
      return;
    }
    setBusy(true);
    const result = await applyTransition({
      kind: "cash_request", entityId: detail.id, toState: "retired",
      actorId: user?.id ?? "", actorRole: (role as any) ?? undefined,
      payload: {
        actual_spent: spent,
        expense_account_code: expenseAccountCode || undefined,
        expense_category: expenseCategory || undefined,
        returned_amount: returned,
        return_bank_account_id: returnAccountId || undefined,
        notes: retirementNotes || undefined,
      },
    });
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Retirement failed", description: result.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Retired", description: "Posted to the ledger." });
    setRetireOpen(false);
    setActualSpent(""); setExpenseAccountCode(""); setExpenseCategory("");
    setReturnedAmount(""); setReturnAccountId(""); setRetirementNotes("");
    refreshDetail(result.entity);
  };

  if (!role) return null;

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const disbursedCount = requests.filter((r) => r.status === "disbursed").length;
  // Never summed across currencies — grouped per currency, same "Mixed
  // currencies" convention as the rest of Finance.
  const openAdvanceByCurrency: Record<string, number> = {};
  for (const r of requests.filter((r) => r.status === "disbursed")) {
    const cur = (r.currency || "TZS").toUpperCase();
    openAdvanceByCurrency[cur] = (openAdvanceByCurrency[cur] || 0) + Number(r.amount);
  }
  const openAdvanceCurrencies = Object.keys(openAdvanceByCurrency);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Finance"
        title="Cash Requests"
        subtitle="Petty cash advances: request, approve, disburse and retire"
        icon={Wallet}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Finance
            </Link>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> New request
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total requests" value={requests.length} icon={Wallet} accent="bg-primary/10 text-primary" />
        <StatCard label="Pending approval" value={pendingCount} icon={Wallet} accent="bg-warning/10 text-warning" />
        <StatCard label="Awaiting retirement" value={disbursedCount} icon={Wallet} accent="bg-info/10 text-info" />
      </div>
      {openAdvanceCurrencies.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {openAdvanceCurrencies.map((cur) => (
            <div key={cur} className="bg-card border border-destructive/20 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Outstanding advances ({cur})</p>
              <p className="text-lg font-black text-destructive">{fmt(openAdvanceByCurrency[cur], cur)}</p>
            </div>
          ))}
        </div>
      )}

      <SectionCard title="All requests">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : requests.length === 0 ? (
          <EmptyState icon={Wallet} title="No cash requests" description="Create one above." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => {
                  const meta = STATUS_BADGE[r.status] ?? { label: r.status, variant: "outline" as const };
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetail(r)}>
                      <TableCell className="font-mono text-xs font-semibold">{r.request_number ?? r.id.slice(0, 8)}</TableCell>
                      <TableCell>{r.requester?.name ?? r.requester_id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[240px]">{r.purpose}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(r.amount), r.currency)}</TableCell>
                      <TableCell className="text-center"><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
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
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>New cash request</DialogTitle></DialogHeader>
          <div className="space-y-4">
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
              <Label className="text-xs">Purpose *</Label>
              <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} placeholder="What is this cash for?" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={createRequest} disabled={saving} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save as draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.request_number ?? detail.id.slice(0, 8)}
                  <Badge variant={(STATUS_BADGE[detail.status] ?? { variant: "outline" as const }).variant}>
                    {(STATUS_BADGE[detail.status] ?? { label: detail.status }).label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><Label className="text-xs text-muted-foreground">Requester</Label><p className="font-medium">{detail.requester?.name ?? detail.requester_id}</p></div>
                  <div><Label className="text-xs text-muted-foreground">Amount</Label><p className="font-medium">{fmt(Number(detail.amount), detail.currency)}</p></div>
                </div>
                <div><Label className="text-xs text-muted-foreground">Purpose</Label><p className="text-sm mt-1">{detail.purpose}</p></div>

                {detail.status === "retired" && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Actual spent</span><span className="font-mono">{fmt(Number(detail.actual_spent) || 0, detail.currency)}</span></div>
                    {Number(detail.returned_amount) > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Returned</span><span className="font-mono">{fmt(Number(detail.returned_amount) || 0, detail.currency)}</span></div>
                    )}
                    {detail.retirement_notes && <p className="text-xs text-muted-foreground pt-1">{detail.retirement_notes}</p>}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {detail.status === "approved" && (
                    <Button size="sm" onClick={() => setDisburseOpen(true)}>Disburse</Button>
                  )}
                  {detail.status === "disbursed" && (
                    <Button size="sm" onClick={() => setRetireOpen(true)}>Retire</Button>
                  )}
                  <TransitionButtons
                    kind="cash_request"
                    entity={detail}
                    actorId={user?.id ?? ""}
                    actorRole={role as any}
                    size="sm"
                    exclude={["disbursed", "retired"]}
                    onDone={refreshDetail}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Disburse modal */}
      <Dialog open={disburseOpen} onOpenChange={setDisburseOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Disburse cash</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Posts Dr Driver Float/Staff Advance / Cr the account below.</p>
            <div className="space-y-1">
              <Label className="text-xs">Pay from *</Label>
              <Select value={disburseAccountId} onValueChange={setDisburseAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.bank_name} · {a.account_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDisburseOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={submitDisburse} disabled={busy || !disburseAccountId} className="gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Disburse
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Retire modal */}
      <Dialog open={retireOpen} onOpenChange={setRetireOpen}>
        <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Retire cash advance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Actual spent *</Label>
              <Input type="number" value={actualSpent} onChange={(e) => setActualSpent(e.target.value)} placeholder="0" />
            </div>
            {Number(actualSpent) > 0 && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Expense account *</Label>
                  <Select value={expenseAccountCode} onValueChange={setExpenseAccountCode}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {expenseAccounts.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category label (optional)</Label>
                  <Input value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} placeholder="e.g. Fuel" />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Unspent, returned</Label>
              <Input type="number" value={returnedAmount} onChange={(e) => setReturnedAmount(e.target.value)} placeholder="0" />
            </div>
            {Number(returnedAmount) > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Returned to *</Label>
                <Select value={returnAccountId} onValueChange={setReturnAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.bank_name} · {a.account_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={retirementNotes} onChange={(e) => setRetirementNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setRetireOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={submitRetire} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Retire
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
