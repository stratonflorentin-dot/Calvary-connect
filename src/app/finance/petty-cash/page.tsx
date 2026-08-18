"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, SectionCard, StatCard, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { format } from "date-fns";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Loader2, Plus, Smartphone, Wallet } from "lucide-react";

// Petty Cash — a simple debit/credit ledger for a cash box a Cashier
// operates directly (tolls, small purchases), distinct from Cash Requests'
// multi-step advance/retire/approval workflow. This posts through real
// journal entries same as everything else in Finance, just without an
// approval step first — a cashier records what already happened.
const CAN_USE_ROLES = ["CEO", "ADMIN", "ACCOUNTANT", "CASHIER"];

interface TxnRow {
  id: string;
  transaction_number: string;
  transaction_date: string;
  type: "debit" | "credit";
  amount: number;
  description: string;
  contra_account_code: string | null;
  reference: string | null;
  running_balance: number;
  payment_method: "cash" | "mobile_money";
  mobile_money_account_id: string | null;
}

interface ExpenseAccountOption {
  code: string;
  name: string;
}

interface BankAccountOption {
  id: string;
  account_name: string;
  bank_name: string;
  currency: string;
}

export default function PettyCashPage() {
  const { role, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const canUse = CAN_USE_ROLES.includes(String(role || "").toUpperCase());

  const [rows, setRows] = useState<TxnRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expenseAccounts, setExpenseAccounts] = useState<ExpenseAccountOption[]>([]);
  const [tzsBankAccounts, setTzsBankAccounts] = useState<BankAccountOption[]>([]);
  // Explicitly resolved from the Chart of Accounts rather than a hardcoded
  // code, same as bank_accounts.coa_account_code links a bank account to
  // its COA row — shown on the page so the link is visible, not silent.
  const [pettyCashAccount, setPettyCashAccount] = useState<{ code: string; name: string } | null>(null);
  const [assetAccounts, setAssetAccounts] = useState<ExpenseAccountOption[]>([]);
  const [changeAccountOpen, setChangeAccountOpen] = useState(false);
  const [newLinkedCode, setNewLinkedCode] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const canChangeLink = ["CEO", "ADMIN", "ACCOUNTANT"].includes(String(role || "").toUpperCase());

  const [entryOpen, setEntryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<"debit" | "credit">("debit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reference, setReference] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [fundingAccountId, setFundingAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money">("cash");
  const [mobileMoneyAccountId, setMobileMoneyAccountId] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("petty_cash_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Couldn't load petty cash ledger", description: error.message, variant: "destructive" });
    }
    const list = (data as TxnRow[]) ?? [];
    setRows(list);
    setBalance(list[0]?.running_balance ?? 0);
    setLoading(false);
  };

  const loadPettyCashAccount = async () => {
    // Explicit, persisted link (petty_cash_settings.account_code) rather
    // than resolving "Petty Cash" by name at runtime — same shape as
    // bank_accounts.coa_account_code.
    const { data: setting } = await supabase
      .from("petty_cash_settings")
      .select("account_code, accounts:account_code(code, name, currency)")
      .eq("id", true)
      .maybeSingle();
    const acct = (setting as any)?.accounts ?? null;
    if (acct) setPettyCashAccount({ code: acct.code, name: acct.name });
    else setPettyCashAccount(null);

    // Funding source is scoped to the linked account's own currency — a
    // cross-currency replenishment would fail post_journal_entry's
    // currency guard (verified live elsewhere in this session against the
    // same chart of accounts).
    const { data: banks } = await supabase
      .from("bank_accounts")
      .select("id, account_name, bank_name, currency")
      .eq("currency", acct?.currency ?? "TZS");
    setTzsBankAccounts(banks ?? []);
  };

  const saveLinkedAccount = async () => {
    if (!newLinkedCode) return;
    setSavingLink(true);
    const { error } = await supabase
      .from("petty_cash_settings")
      .upsert({ id: true, account_code: newLinkedCode, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
    setSavingLink(false);
    if (error) {
      toast({ title: "Couldn't update linked account", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Petty Cash linked account updated" });
    setChangeAccountOpen(false);
    setNewLinkedCode("");
    loadPettyCashAccount();
  };

  useEffect(() => {
    if (!canUse) return;
    load();
    loadPettyCashAccount();
    supabase
      .from("accounts")
      .select("code, name")
      .in("category", ["COST_OF_SALES", "OPERATING_EXPENSES", "OTHER_EXPENSES"])
      .eq("is_postable", true)
      .order("code")
      .then(({ data }) => setExpenseAccounts(data ?? []));
    if (canChangeLink) {
      supabase
        .from("accounts")
        .select("code, name")
        .eq("category", "ASSETS")
        .eq("is_postable", true)
        .order("code")
        .then(({ data }) => setAssetAccounts(data ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse]);

  const resetForm = () => {
    setType("debit");
    setAmount("");
    setDescription("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setReference("");
    setAccountCode("");
    setFundingAccountId("");
    setPaymentMethod("cash");
    setMobileMoneyAccountId("");
  };

  const submit = async () => {
    if (!pettyCashAccount) {
      toast({ title: "No Petty Cash account found", description: 'Add a postable "Petty Cash" account to the Chart of Accounts first.', variant: "destructive" });
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    if (type === "debit" && !accountCode) {
      toast({ title: "Choose which expense account this belongs to", variant: "destructive" });
      return;
    }
    if (type === "debit" && paymentMethod === "mobile_money" && !mobileMoneyAccountId) {
      toast({ title: "Choose which mobile money account paid this", variant: "destructive" });
      return;
    }
    if (type === "credit" && !fundingAccountId) {
      toast({ title: "Choose which bank account funded this", variant: "destructive" });
      return;
    }
    if (type === "debit" && paymentMethod === "cash" && amt > balance) {
      toast({ title: "Insufficient petty cash balance", description: `Current balance is ${formatCurrency(balance, "TZS")}.`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: transactionNumber, error: numErr } = await supabase.rpc("next_doc_number", { p_type: "petty_cash" });
      if (numErr) throw numErr;

      let journalEntryId: string | null = null;
      let bankTransactionId: string | null = null;

      if (type === "debit" && paymentMethod === "cash") {
        // Dr [expense account] / Cr Petty Cash — draws down the physical box.
        const { data: je, error: jeErr } = await supabase
          .from("journal_entries")
          .insert({
            entry_date: date,
            description: `Petty cash: ${description.trim()}`,
            is_posted: false,
            status: "draft",
            reference_type: "petty_cash",
            currency: "TZS",
          })
          .select("id")
          .single();
        if (jeErr) throw jeErr;

        const { error: lineErr } = await supabase.from("journal_entry_lines").insert([
          { journal_entry_id: je.id, account_code: accountCode, debit_amount: amt, credit_amount: 0, description: description.trim(), currency: "TZS" },
          { journal_entry_id: je.id, account_code: pettyCashAccount.code, debit_amount: 0, credit_amount: amt, description: description.trim(), currency: "TZS" },
        ]);
        if (lineErr) throw lineErr;

        const { error: postErr } = await supabase.rpc("post_journal_entry", { p_id: je.id });
        if (postErr) throw postErr;
        journalEntryId = je.id;
      } else if (type === "debit" && paymentMethod === "mobile_money") {
        // Dr [expense account] / Cr the mobile money account — a real
        // withdrawal against that account's own balance, same mechanism
        // as a credit top-up below. Does NOT touch the cash box's
        // running_balance: this money never passed through the box.
        const { data: txn, error: txnErr } = await supabase.rpc("post_bank_transaction", {
          p_bank_account_id: mobileMoneyAccountId,
          p_amount: amt,
          p_direction: "out",
          p_transaction_type: "petty_cash_mobile_payment",
          p_currency: "TZS",
          p_description: `Petty cash (mobile money): ${description.trim()}`,
          p_reference_type: "petty_cash",
          p_transaction_date: date,
          p_contra_account_code: accountCode,
          p_idempotency_key: crypto.randomUUID(),
        });
        if (txnErr) throw txnErr;
        journalEntryId = (txn as any)?.journal_entry_id ?? null;
        bankTransactionId = (txn as any)?.id ?? null;
      } else {
        // Dr Petty Cash / Cr Bank — a real withdrawal, same mechanism as
        // Cash Requests' disbursement leg.
        const { data: txn, error: txnErr } = await supabase.rpc("post_bank_transaction", {
          p_bank_account_id: fundingAccountId,
          p_amount: amt,
          p_direction: "out",
          p_transaction_type: "petty_cash_replenishment",
          p_currency: "TZS",
          p_description: `Petty cash top-up: ${description.trim()}`,
          p_reference_type: "petty_cash",
          p_transaction_date: date,
          p_contra_account_code: pettyCashAccount.code,
          p_idempotency_key: crypto.randomUUID(),
        });
        if (txnErr) throw txnErr;
        journalEntryId = (txn as any)?.journal_entry_id ?? null;
        bankTransactionId = (txn as any)?.id ?? null;
      }

      // Only cash moves the box's own balance — a mobile money payment
      // draws from a different pool of money entirely.
      const newBalance = type === "credit" ? balance + amt : paymentMethod === "cash" ? balance - amt : balance;
      const { data: pettyCashTxn, error: insertErr } = await supabase
        .from("petty_cash_transactions")
        .insert({
          transaction_number: transactionNumber,
          transaction_date: date,
          type,
          amount: amt,
          description: description.trim(),
          contra_account_code: type === "debit" ? accountCode : null,
          reference: reference.trim() || null,
          running_balance: newBalance,
          journal_entry_id: journalEntryId,
          funded_from_account_id: type === "credit" ? fundingAccountId : null,
          bank_transaction_id: bankTransactionId,
          payment_method: type === "debit" ? paymentMethod : "cash",
          mobile_money_account_id: type === "debit" && paymentMethod === "mobile_money" ? mobileMoneyAccountId : null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      // A debit is money a cashier already paid out — record it as a real
      // (already-paid) expense too, linked back to this ledger entry, so
      // it shows up on the main Expenses Management page like every other
      // expense instead of only existing in this ledger and the GL.
      if (type === "debit") {
        const { error: expenseErr } = await supabase.from("expenses").insert({
          description: description.trim(),
          amount: amt,
          category: "other",
          account_code: accountCode,
          date,
          status: "paid",
          currency: "TZS",
          payment_method: paymentMethod,
          client_reference: reference.trim() || null,
          journal_entry_id: journalEntryId,
          petty_cash_transaction_id: pettyCashTxn.id,
          created_by: user?.id ?? null,
        });
        if (expenseErr) throw expenseErr;
      }

      toast({
        variant: "success",
        title: `${transactionNumber} recorded`,
        description: paymentMethod === "mobile_money" && type === "debit"
          ? "Paid via mobile money — cash box balance unchanged."
          : `New balance: ${formatCurrency(newBalance, "TZS")}`,
      });
      setEntryOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      toast({ title: "Couldn't record entry", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) return null;
  if (!canUse) {
    return (
      <div className="space-y-6 pb-8">
        <EmptyState icon={Wallet} title="Access denied" description="Only the Cashier and Finance roles can view the petty cash ledger." />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Finance"
        title="Petty Cash"
        subtitle="Cash box for small day-to-day payments — tolls, parking, minor purchases"
        icon={Wallet}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Finance
            </Link>
            <Button size="sm" onClick={() => setEntryOpen(true)} disabled={!pettyCashAccount} className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> New entry
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Current balance" value={formatCurrency(balance, "TZS")} icon={Wallet} accent="bg-primary/10 text-primary" />
      </div>

      {pettyCashAccount ? (
        <p className="text-xs text-muted-foreground -mt-2 flex items-center gap-2">
          Linked to <span className="font-mono font-bold text-foreground">{pettyCashAccount.code}</span> · {pettyCashAccount.name} in the Chart of Accounts.
          {canChangeLink && (
            <button
              type="button"
              onClick={() => { setNewLinkedCode(pettyCashAccount.code); setChangeAccountOpen(true); }}
              className="text-primary hover:underline font-semibold"
            >
              Change
            </button>
          )}
        </p>
      ) : !loading && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 text-sm flex items-center justify-between gap-3">
          <span>No Petty Cash account is linked yet.</span>
          {canChangeLink && (
            <Button size="sm" variant="outline" onClick={() => setChangeAccountOpen(true)}>Link an account</Button>
          )}
        </div>
      )}

      <SectionCard title="Transactions">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Wallet} title="No entries yet" description="Record the first debit or credit above." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.transaction_number}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.transaction_date}</TableCell>
                    <TableCell className="text-sm">{r.description}{r.reference ? ` · ${r.reference}` : ""}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Badge variant={r.type === "credit" ? "default" : "secondary"} className="gap-1">
                          {r.type === "credit" ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                          {r.type}
                        </Badge>
                        {r.type === "debit" && r.payment_method === "mobile_money" && (
                          <Badge variant="outline" className="gap-1" title="Paid via mobile money — cash box unaffected">
                            <Smartphone className="w-3 h-3" /> mobile
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-mono ${r.type === "credit" ? "text-success" : "text-destructive"}`}>
                      {r.type === "credit" ? "+" : "-"}{formatCurrency(r.amount, "TZS")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.type === "debit" && r.payment_method === "mobile_money" ? "—" : formatCurrency(r.running_balance, "TZS")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Dialog open={entryOpen} onOpenChange={(o) => { setEntryOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <DialogTitle>New petty cash entry</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {(["debit", "credit"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 h-10 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors flex items-center justify-center gap-1.5 ${
                    type === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {t === "credit" ? <ArrowUpCircle className="w-3.5 h-3.5" /> : <ArrowDownCircle className="w-3.5 h-3.5" />}
                  {t === "debit" ? "Debit (paid out)" : "Credit (top-up)"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount (TZS) *</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description *</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === "debit" ? "e.g. Toll fee — T 123 ABC" : "e.g. Box top-up"} />
            </div>

            {type === "debit" ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Paid using</Label>
                  <div className="flex items-center gap-2">
                    {(["cash", "mobile_money"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`flex-1 h-9 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                          paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {m === "cash" ? <Wallet className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                        {m === "cash" ? "Cash (box)" : "Mobile money"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expense account *</Label>
                  <Select value={accountCode} onValueChange={setAccountCode}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {expenseAccounts.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod === "mobile_money" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Mobile money account *</Label>
                    <Select value={mobileMoneyAccountId} onValueChange={setMobileMoneyAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {tzsBankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.bank_name} · {b.account_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Withdraws directly from this account — the cash box balance won't change.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Funded from *</Label>
                <Select value={fundingAccountId} onValueChange={setFundingAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                  <SelectContent>
                    {tzsBankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.bank_name} · {b.account_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Reference (optional)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt number" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setEntryOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Record entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={changeAccountOpen} onOpenChange={setChangeAccountOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Change linked account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Every petty cash entry posts against this Chart of Accounts row. Changing it only affects entries recorded from now on — past journal entries already posted keep their original account.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Petty Cash account</Label>
              <Select value={newLinkedCode} onValueChange={setNewLinkedCode}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {assetAccounts.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setChangeAccountOpen(false)} disabled={savingLink}>Cancel</Button>
              <Button onClick={saveLinkedAccount} disabled={savingLink || !newLinkedCode} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                {savingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
