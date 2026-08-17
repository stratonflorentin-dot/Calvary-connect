"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AuditTrailService } from "@/services/audit-trail-service";
import { parseStatementCsv, downloadCsvTemplate, type ParsedStatementRow } from "@/lib/finance/bank-statement-csv";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, Download, FileSpreadsheet, Landmark, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface AccountOption {
  id: string;
  account_name: string;
  bank_name: string;
}

export default function NewBankStatementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useSupabase();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"import" | "manual">("import");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState("");
  const [periodFrom, setPeriodFrom] = useState(format(new Date(), "yyyy-MM-01"));
  const [periodTo, setPeriodTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [allowOverlap, setAllowOverlap] = useState(false);

  const [parsedRows, setParsedRows] = useState<ParsedStatementRow[]>([]);
  const [headerErrors, setHeaderErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("bank_accounts").select("id, account_name, bank_name").order("account_name").then(({ data }) => {
      setAccounts((data as AccountOption[]) ?? []);
      if (data && data.length > 0 && !accountId) setAccountId(data[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validRowCount = useMemo(() => parsedRows.filter((r) => r.errors.length === 0).length, [parsedRows]);
  const invalidRowCount = parsedRows.length - validRowCount;

  const onFilePicked = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const { rows, headerErrors: hErrs } = parseStatementCsv(text);
    setParsedRows(rows);
    setHeaderErrors(hErrs);
    if (hErrs.length > 0) {
      toast({ title: "Couldn't read file", description: hErrs.join(" "), variant: "destructive" });
    }
  };

  const checkOverlap = async (): Promise<boolean> => {
    if (allowOverlap) return true;
    const { data } = await supabase
      .from("bank_statement_batches")
      .select("id, reference, period_from, period_to")
      .eq("bank_account_id", accountId)
      .lte("period_from", periodTo)
      .gte("period_to", periodFrom);
    if (data && data.length > 0) {
      toast({
        title: "Overlapping statement period",
        description: `${data[0].reference} already covers part of this range (${data[0].period_from} → ${data[0].period_to}). Check "allow overlap" to proceed anyway.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const createBatch = async (lines: ParsedStatementRow[]) => {
    if (!accountId) {
      toast({ title: "Pick a bank account", variant: "destructive" });
      return;
    }
    if (!periodFrom || !periodTo) {
      toast({ title: "Set the statement period", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (!(await checkOverlap())) {
        setSaving(false);
        return;
      }

      const { data: reference, error: numErr } = await supabase.rpc("next_doc_number", { p_type: "bank_statement" });
      if (numErr) throw numErr;

      const { data: batch, error: batchErr } = await supabase
        .from("bank_statement_batches")
        .insert({
          reference,
          bank_account_id: accountId,
          period_from: periodFrom,
          period_to: periodTo,
          opening_balance: openingBalance ? Number(openingBalance) : null,
          closing_balance: closingBalance ? Number(closingBalance) : null,
          notes: notes.trim() || null,
          status: "draft",
          open_line_count: lines.length,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (batchErr) throw batchErr;

      if (lines.length > 0) {
        const { error: lineErr } = await supabase.from("bank_statement_lines").insert(
          lines.map((r) => ({
            bank_statement_batch_id: batch.id,
            bank_account_id: accountId,
            transaction_date: r.date,
            description: r.description,
            reference_number: r.reference,
            debit_amount: r.debit,
            credit_amount: r.credit,
            balance: r.balance,
            match_status: "unmatched",
          })),
        );
        if (lineErr) throw lineErr;
      }

      await AuditTrailService.log({
        user_id: user?.id,
        module: "finance",
        action: "create",
        entity_type: "bank_statement_batch",
        entity_id: batch.id,
        description: `Created ${reference} with ${lines.length} line(s)`,
      });

      toast({ variant: "success", title: "Statement created", description: `${reference} — ${lines.length} line(s) imported.` });
      router.push(`/finance/banking/bank-statements/${batch.id}`);
    } catch (err: any) {
      toast({ title: "Couldn't create statement", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 max-w-4xl">
      <div>
        <Link href="/finance/banking/bank-statements" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mb-1">
          <ArrowLeft className="w-3 h-3" /> Back to Bank Statements
        </Link>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <Landmark className="w-6 h-6 text-primary" /> New bank statement
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {(["import", "manual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "px-4 h-9 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors",
              mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40",
            )}
          >
            {m === "import" ? "Import from bank file (recommended)" : "Manual entry"}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Bank account *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.bank_name} · {a.account_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div />
          <div className="space-y-1">
            <Label className="text-xs">Period from *</Label>
            <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Period to *</Label>
            <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Opening balance</Label>
            <Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Closing balance</Label>
            <Input type="number" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={allowOverlap} onChange={(e) => setAllowOverlap(e.target.checked)} className="rounded" />
          Allow this period to overlap an existing statement for this account
        </label>

        {mode === "import" ? (
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFilePicked(e.target.files[0])} />
              <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4" /> {fileName ?? "Choose CSV file"}
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={downloadCsvTemplate}>
                <Download className="w-3.5 h-3.5" /> Download template
              </Button>
            </div>

            {headerErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 text-sm">
                {headerErrors.join(" ")}
              </div>
            )}

            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold text-success">{validRowCount} valid</span>
                  {invalidRowCount > 0 && <span className="font-bold text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {invalidRowCount} with errors (won't be imported)</span>}
                </div>
                <div className="max-h-72 overflow-y-auto border border-border rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left">#</th>
                        <th className="px-2 py-1.5 text-left">Date</th>
                        <th className="px-2 py-1.5 text-left">Description</th>
                        <th className="px-2 py-1.5 text-right">Debit</th>
                        <th className="px-2 py-1.5 text-right">Credit</th>
                        <th className="px-2 py-1.5 text-left">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedRows.map((r) => (
                        <tr key={r.rowIndex} className={r.errors.length > 0 ? "bg-destructive/5" : ""}>
                          <td className="px-2 py-1 text-muted-foreground">{r.rowIndex}</td>
                          <td className="px-2 py-1">{r.date}</td>
                          <td className="px-2 py-1 truncate max-w-[200px]">{r.description}</td>
                          <td className="px-2 py-1 text-right font-mono">{r.debit || ""}</td>
                          <td className="px-2 py-1 text-right font-mono">{r.credit || ""}</td>
                          <td className="px-2 py-1 text-destructive">{r.errors.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Button
              onClick={() => createBatch(parsedRows.filter((r) => r.errors.length === 0))}
              disabled={saving || validRowCount === 0}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Create statement with {validRowCount} line(s)
            </Button>
          </div>
        ) : (
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">Creates an empty statement — add transaction lines one at a time from the reconciliation screen afterward.</p>
            <Button onClick={() => createBatch([])} disabled={saving} className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Create empty statement
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
