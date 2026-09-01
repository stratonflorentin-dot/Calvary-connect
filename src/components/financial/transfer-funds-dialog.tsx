"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { getRate } from "@/lib/finance/fx";
import { ArrowDown, ArrowRightLeft, Loader2 } from "lucide-react";

interface BankAccountOption {
  id: string;
  account_name: string;
  bank_name: string;
  currency: string;
  current_balance: number;
  is_active: boolean;
}

interface TransferFundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BankAccountOption[];
  /** Preselects this account as From — used by the per-row "Transfer" quick action. */
  defaultFromAccountId?: string | null;
  onCompleted?: () => void;
}

/**
 * Bank-to-bank transfer form + confirmation, backed entirely by
 * transfer_funds() (129_bank_transfers.sql) — this component never posts a
 * journal entry or touches balances itself, it only calls the RPC and
 * shows what it's about to do first.
 */
export function TransferFundsDialog({ open, onOpenChange, accounts, defaultFromAccountId, onCompleted }: TransferFundsDialogProps) {
  const { toast } = useToast();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateMissing, setRateMissing] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setFromId(defaultFromAccountId ?? "");
    setToId("");
    setAmount("");
    setTransferDate(new Date().toISOString().slice(0, 10));
    setReference("");
    setDescription("");
    setStep("form");
    setIdempotencyKey(crypto.randomUUID());
  }, [open, defaultFromAccountId]);

  const fromAccount = useMemo(() => accounts.find((a) => a.id === fromId) ?? null, [accounts, fromId]);
  const toAccount = useMemo(() => accounts.find((a) => a.id === toId) ?? null, [accounts, toId]);
  const sameCurrency = fromAccount && toAccount && fromAccount.currency === toAccount.currency;

  useEffect(() => {
    if (!fromAccount || !toAccount) { setRate(null); setRateMissing(false); return; }
    if (fromAccount.currency === toAccount.currency) { setRate(1); setRateMissing(false); return; }
    setRateLoading(true);
    setRateMissing(false);
    getRate(fromAccount.currency, toAccount.currency, transferDate)
      .then((r) => {
        setRate(r);
        setRateMissing(r == null);
      })
      .finally(() => setRateLoading(false));
  }, [fromAccount, toAccount, transferDate]);

  const amountNum = Number(amount) || 0;
  const destinationAmount = rate != null ? Math.round(amountNum * rate * 100) / 100 : null;

  const canContinue = !!fromAccount && !!toAccount && fromId !== toId && amountNum > 0 && (sameCurrency || (rate != null && !rateMissing));

  const submit = async () => {
    if (!fromAccount || !toAccount) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("transfer_funds", {
        p_from_account_id: fromAccount.id,
        p_to_account_id: toAccount.id,
        p_amount: amountNum,
        p_transfer_date: transferDate,
        p_reference: reference || null,
        p_description: description || null,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      toast({
        variant: "success",
        title: "Transfer completed",
        description: `${row?.transfer_reference ?? ""} — ${formatCurrency(amountNum, fromAccount.currency)} → ${formatCurrency(row?.destination_amount ?? destinationAmount ?? 0, toAccount.currency)}`,
      });
      onOpenChange(false);
      onCompleted?.();
    } catch (err: any) {
      toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Transfer Funds</DialogTitle></DialogHeader>

        {step === "form" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From Account *</Label>
                <Select value={fromId} onValueChange={setFromId}>
                  <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.is_active).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_name} — {a.bank_name} ({a.currency}) · {formatCurrency(a.current_balance, a.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Account *</Label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger><SelectValue placeholder="Select destination account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.is_active && a.id !== fromId).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_name} — {a.bank_name} ({a.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Transfer Date</Label>
                <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
              </div>
            </div>

            <div className="rounded-xl border border-border p-3 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Source</p>
              <div className="flex items-center gap-3">
                <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1" />
                <span className="text-sm font-bold text-muted-foreground w-14 text-right">{fromAccount?.currency ?? "—"}</span>
              </div>

              {fromAccount && toAccount && !sameCurrency && (
                <>
                  <div className="flex items-center justify-center text-muted-foreground"><ArrowDown className="w-4 h-4" /></div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Destination</p>
                  {rateLoading ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Looking up exchange rate…</p>
                  ) : rateMissing ? (
                    <p className="text-xs text-destructive font-medium">
                      No exchange rate is configured for {fromAccount.currency} → {toAccount.currency} as of {transferDate}. Add one in FX Rates first.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Exchange Rate: <span className="font-bold text-foreground">1 {toAccount.currency} = {(1 / (rate ?? 1)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {fromAccount.currency}</span>
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-9 rounded-md border border-input bg-muted/40 px-3 flex items-center text-sm font-bold">
                          {destinationAmount != null ? destinationAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                        </div>
                        <span className="text-sm font-bold text-muted-foreground w-14 text-right">{toAccount.currency}</span>
                      </div>
                    </>
                  )}
                </>
              )}
              {sameCurrency && (
                <p className="text-xs text-muted-foreground">Same currency — no exchange rate applied.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="optional" /></div>
              <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" /></div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={() => (sameCurrency ? submit() : setStep("confirm"))}
                disabled={!canContinue || submitting}
                className="gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                {sameCurrency ? "Transfer Funds" : "Continue"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Confirm Transfer</p>
            <div className="text-sm space-y-1">
              <p>From: <span className="font-bold text-foreground">{fromAccount?.account_name}</span></p>
              <p>To: <span className="font-bold text-foreground">{toAccount?.account_name}</span></p>
            </div>
            <div className="rounded-xl bg-muted/30 border border-border p-4 text-center space-y-2">
              <p className="text-lg font-black text-foreground">{formatCurrency(amountNum, fromAccount?.currency ?? "TZS")}</p>
              <p className="text-xs text-muted-foreground">
                Exchange Rate: 1 {toAccount?.currency} = {rate != null ? (1 / rate).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"} {fromAccount?.currency}
              </p>
              <p className="text-[10px] text-muted-foreground">Rate source: manually configured in FX Rates</p>
              <div className="flex items-center justify-center text-muted-foreground"><ArrowDown className="w-4 h-4" /></div>
              <p className="text-lg font-black text-primary">
                Recipient account will receive approximately {formatCurrency(destinationAmount ?? 0, toAccount?.currency ?? "USD")}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setStep("form")} disabled={submitting}>Back</Button>
              <Button onClick={submit} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />} Confirm Transfer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
