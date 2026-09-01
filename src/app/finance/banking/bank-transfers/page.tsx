"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { ArrowLeft, ArrowRightLeft, Loader2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BankTransfersHistoryPage() {
  const { role, hasPermission } = useRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const canReverse = hasPermission(["CEO", "ADMIN"]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bank_transfers")
      .select("*, from_account:from_bank_account_id(account_name, bank_name), to_account:to_bank_account_id(account_name, bank_name), creator:created_by(name, email)")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submitReverse = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("reverse_bank_transfer", { p_transfer_id: selected.id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      toast({ variant: "success", title: "Transfer reversed", description: row?.transfer_reference });
      setReverseOpen(false);
      setSelected(null);
      load();
    } catch (err: any) {
      toast({ title: "Couldn't reverse transfer", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Link href="/finance/banking/bank-accounts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
                <ArrowLeft className="size-4" /> Back to Bank Accounts
              </Link>
              <h1 className="text-2xl md:text-3xl font-headline tracking-tighter flex items-center gap-2">
                <ArrowRightLeft className="size-7 text-primary" /> Transfer History
              </h1>
              <p className="text-muted-foreground">Every fund transfer between your bank accounts, with its exact rate and journal entry</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center">
                <ArrowRightLeft className="size-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="font-bold text-foreground">No transfers yet</p>
                <p className="text-sm text-muted-foreground">Transfer funds from the Bank Accounts page to see history here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Transfer ID</th>
                      <th className="px-4 py-3">From</th>
                      <th className="px-4 py-3">To</th>
                      <th className="px-4 py-3 text-right">Source Amount</th>
                      <th className="px-4 py-3 text-right">Destination Amount</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t.id} className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelected(t)}>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(t.transfer_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-mono text-xs font-black text-foreground">{t.transfer_reference}</td>
                        <td className="px-4 py-3 text-foreground">{t.from_account?.account_name ?? "—"}<span className="text-muted-foreground"> · {t.from_account?.bank_name}</span></td>
                        <td className="px-4 py-3 text-foreground">{t.to_account?.account_name ?? "—"}<span className="text-muted-foreground"> · {t.to_account?.bank_name}</span></td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(t.source_amount) || 0, t.from_currency)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(t.destination_amount) || 0, t.to_currency)}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{t.from_currency === t.to_currency ? "—" : Number(t.exchange_rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn(t.status === "reversed" ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-success/10 text-success border-success/20")}>
                            {t.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Transfer detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Transfer Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Transfer ID</p><p className="font-mono font-bold text-foreground">{selected.transfer_reference}</p></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Date</p><p className="text-foreground">{new Date(selected.transfer_date).toLocaleDateString()}</p></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">From</p><p className="text-foreground">{selected.from_account?.account_name}</p></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">To</p><p className="text-foreground">{selected.to_account?.account_name}</p></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Source Amount</p><p className="font-bold text-foreground">{formatCurrency(Number(selected.source_amount) || 0, selected.from_currency)}</p></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Destination Amount</p><p className="font-bold text-foreground">{formatCurrency(Number(selected.destination_amount) || 0, selected.to_currency)}</p></div>
                {selected.from_currency !== selected.to_currency && (
                  <>
                    <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Exchange Rate</p><p className="text-foreground">{Number(selected.exchange_rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Rate Source</p><p className="text-foreground">{selected.exchange_rate_source ?? "Manually configured"}</p></div>
                  </>
                )}
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Status</p><p className="text-foreground capitalize">{selected.status}</p></div>
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Created By</p><p className="text-foreground">{selected.creator?.name ?? "—"}</p></div>
              </div>
              {selected.description && (
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Description</p><p className="text-foreground">{selected.description}</p></div>
              )}
              {selected.reference && (
                <div><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Reference</p><p className="text-foreground">{selected.reference}</p></div>
              )}
              <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs space-y-1">
                <p><span className="text-muted-foreground">Journal Entry (source):</span> <span className="font-mono">{selected.from_journal_entry_id?.slice(0, 8) ?? "—"}</span></p>
                {selected.to_journal_entry_id && (
                  <p><span className="text-muted-foreground">Journal Entry (destination):</span> <span className="font-mono">{selected.to_journal_entry_id.slice(0, 8)}</span></p>
                )}
              </div>
              {selected.status === "reversed" && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-xs text-foreground">
                  Reversed {selected.reversed_at && `on ${new Date(selected.reversed_at).toLocaleString()}`}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                {canReverse && selected.status === "completed" && (
                  <Button variant="destructive" onClick={() => setReverseOpen(true)} className="gap-2">
                    <Undo2 className="w-4 h-4" /> Reverse Transfer
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reverse confirmation */}
      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Reverse Transfer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This creates a new transfer moving the funds back and marks {selected?.transfer_reference} as reversed. The original transaction stays on record — nothing is deleted or edited.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReverseOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={submitReverse} disabled={busy} variant="destructive" className="gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Reverse Transfer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
