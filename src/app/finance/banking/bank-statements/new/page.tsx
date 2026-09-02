"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, StatusBadge } from "@/components/shell";
import { useToast } from "@/hooks/use-toast";
import { AuditTrailService } from "@/services/audit-trail-service";
import { formatCurrency } from "@/components/ui/currency-badge";
import {
  parseStatementCsv, downloadCsvTemplate, type ParsedStatementRow,
} from "@/lib/finance/bank-statement-csv";
import { parseStatementXlsx } from "@/lib/finance/bank-statement-xlsx";
import { extractStatementPdf, extractStatementPdfOcr, type OcrProgress } from "@/lib/finance/bank-statement-pdf";
import { flagDuplicateRows } from "@/lib/finance/bank-statement-duplicates";
import { format } from "date-fns";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet,
  FileText, Image as ImageIcon, Landmark, Loader2, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountOption {
  id: string;
  account_name: string;
  bank_name: string;
  currency: string;
}

type ImportFormat = "csv" | "excel" | "pdf";

const FORMATS: { key: ImportFormat; label: string; icon: typeof FileText; accept: string }[] = [
  { key: "csv", label: "CSV", icon: FileSpreadsheet, accept: ".csv,text/csv" },
  { key: "excel", label: "Excel", icon: FileSpreadsheet, accept: ".xlsx,.xls" },
  { key: "pdf", label: "PDF", icon: FileText, accept: ".pdf,application/pdf" },
];

export default function NewBankStatementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useSupabase();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"import" | "manual">("import");
  const [importFormat, setImportFormat] = useState<ImportFormat>("csv");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState("");
  const [periodFrom, setPeriodFrom] = useState(format(new Date(), "yyyy-MM-01"));
  const [periodTo, setPeriodTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);

  const [parsedRows, setParsedRows] = useState<ParsedStatementRow[]>([]);
  const [headerErrors, setHeaderErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isScanned, setIsScanned] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [usedOcr, setUsedOcr] = useState(false);

  useEffect(() => {
    supabase.from("bank_accounts").select("id, account_name, bank_name, currency").order("account_name").then(({ data }) => {
      setAccounts((data as AccountOption[]) ?? []);
      if (data && data.length > 0 && !accountId) setAccountId(data[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetImport = () => {
    setParsedRows([]);
    setHeaderErrors([]);
    setFileName(null);
    setIsScanned(false);
    setPageCount(null);
    setPendingPdfFile(null);
    setUsedOcr(false);
  };

  const runDuplicateCheck = async (rows: ParsedStatementRow[]) => {
    if (!accountId || rows.length === 0) return rows;
    setCheckingDuplicates(true);
    try {
      await flagDuplicateRows(accountId, rows);
    } finally {
      setCheckingDuplicates(false);
    }
    return [...rows];
  };

  const onFilePicked = async (file: File) => {
    resetImport();
    setFileName(file.name);
    setParsing(true);
    try {
      if (importFormat === "csv") {
        const text = await file.text();
        const { rows, headerErrors: hErrs } = parseStatementCsv(text);
        setHeaderErrors(hErrs);
        setParsedRows(hErrs.length === 0 ? await runDuplicateCheck(rows) : rows);
      } else if (importFormat === "excel") {
        const { rows, headerErrors: hErrs } = await parseStatementXlsx(file);
        setHeaderErrors(hErrs);
        setParsedRows(hErrs.length === 0 ? await runDuplicateCheck(rows) : rows);
      } else {
        setPendingPdfFile(file);
        const result = await extractStatementPdf(file);
        await applyPdfResult(result);
      }
    } catch (err: any) {
      toast({ title: "Couldn't read file", description: err.message ?? "Unknown error", variant: "destructive" });
      setHeaderErrors([err.message ?? "Unknown error while reading this file."]);
    } finally {
      setParsing(false);
    }
  };

  const applyPdfResult = async (result: Awaited<ReturnType<typeof extractStatementPdf>>) => {
    setIsScanned(result.isScanned);
    setPageCount(result.pageCount);
    setHeaderErrors(result.headerErrors);
    if (result.openingBalance !== null && !openingBalance) setOpeningBalance(String(result.openingBalance));
    if (result.closingBalance !== null && !closingBalance) setClosingBalance(String(result.closingBalance));
    setParsedRows(result.headerErrors.length === 0 && !result.isScanned ? await runDuplicateCheck(result.rows) : result.rows);
  };

  const runOcr = async () => {
    if (!pendingPdfFile) return;
    setOcrRunning(true);
    setOcrProgress(null);
    try {
      const result = await extractStatementPdfOcr(pendingPdfFile, setOcrProgress);
      setUsedOcr(true);
      await applyPdfResult(result);
      if (result.isScanned) {
        toast({ title: "OCR found no readable text", description: "This scan may be too low-resolution or skewed for OCR to read.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "OCR failed", description: err.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setOcrRunning(false);
      setOcrProgress(null);
    }
  };

  // Re-run duplicate detection if the account changes after a file was
  // already parsed (existing bank_statement_lines are per-account).
  useEffect(() => {
    if (parsedRows.length > 0 && accountId) {
      flagDuplicateRows(accountId, parsedRows).then(() => setParsedRows((rows) => [...rows]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const summary = useMemo(() => {
    const invalid = parsedRows.filter((r) => r.errors.length > 0);
    const duplicate = parsedRows.filter((r) => r.errors.length === 0 && r.isDuplicate);
    const review = parsedRows.filter((r) => r.errors.length === 0 && !r.isDuplicate && r.confidence === "review");
    const clean = parsedRows.filter((r) => r.errors.length === 0 && !r.isDuplicate && r.confidence !== "review");
    return { invalid, duplicate, review, clean, total: parsedRows.length };
  }, [parsedRows]);

  const rowsToImport = useMemo(
    () => [...summary.clean, ...summary.review, ...(includeDuplicates ? summary.duplicate : [])],
    [summary, includeDuplicates],
  );

  const selectedAccount = accounts.find((a) => a.id === accountId);

  const balanceCheck = useMemo(() => {
    const opening = openingBalance ? Number(openingBalance) : null;
    const closing = closingBalance ? Number(closingBalance) : null;
    if (opening === null || closing === null || rowsToImport.length === 0) return null;
    const net = rowsToImport.reduce((s, r) => s + r.credit - r.debit, 0);
    const calculated = opening + net;
    const difference = Math.round((closing - calculated) * 100) / 100;
    return { opening, closing, calculated, difference, passed: Math.abs(difference) < 1 };
  }, [openingBalance, closingBalance, rowsToImport]);

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

  const createBatch = async (lines: ParsedStatementRow[], sourceLabel: string) => {
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
        description: `Created ${reference} with ${lines.length} line(s) from ${sourceLabel}${fileName ? ` (${fileName})` : ""}`,
      });

      toast({ variant: "success", title: "Statement created", description: `${reference} — ${lines.length} line(s) imported.` });
      router.push(`/finance/banking/bank-statements/${batch.id}`);
    } catch (err: any) {
      toast({ title: "Couldn't create statement", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const activeFormat = FORMATS.find((f) => f.key === importFormat)!;

  return (
    <div className="space-y-6 pb-8 max-w-5xl">
      <div>
        <Link href="/finance/banking/bank-statements" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mb-1">
          <ArrowLeft className="w-3 h-3" /> Back to Bank Statements
        </Link>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <Landmark className="w-6 h-6 text-primary" /> Import bank statement
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
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.bank_name} · {a.account_name} ({a.currency})</SelectItem>)}
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
          <div className="space-y-4 pt-3 border-t border-border">
            <div className="space-y-1">
              <Label className="text-xs">Import format</Label>
              <div className="flex items-center gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setImportFormat(f.key); resetImport(); }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold border transition-colors",
                      importFormat === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/40",
                    )}
                  >
                    <f.icon className="w-3.5 h-3.5" /> {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileRef}
                type="file"
                accept={activeFormat.accept}
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFilePicked(e.target.files[0])}
              />
              <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()} disabled={parsing}>
                {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {fileName ?? `Choose ${activeFormat.label} file`}
              </Button>
              {importFormat === "csv" && (
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={downloadCsvTemplate}>
                  <Download className="w-3.5 h-3.5" /> Download template
                </Button>
              )}
              {checkingDuplicates && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking for duplicates…</span>}
            </div>

            {isScanned && !ocrRunning && (
              <div className="bg-warning/10 border border-warning/20 text-foreground rounded-xl p-4 text-sm space-y-2">
                <p className="font-bold flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> This PDF appears to be scanned.</p>
                <p className="text-muted-foreground">No selectable text was found across {pageCount} page(s). You can try reading it with on-device OCR (slow, and less reliable than a text-based file — every extracted row will be flagged for review), or export the statement as CSV/Excel from your bank&apos;s portal instead.</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={runOcr} disabled={!pendingPdfFile}>
                  <ImageIcon className="w-3.5 h-3.5" /> Extract with OCR
                </Button>
              </div>
            )}

            {ocrRunning && (
              <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm space-y-2">
                <p className="font-bold flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" /> Reading with OCR…</p>
                {ocrProgress && (
                  <>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(ocrProgress.progress * 100)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Page {ocrProgress.page} of {ocrProgress.pageCount} — {Math.round(ocrProgress.progress * 100)}%</p>
                  </>
                )}
              </div>
            )}

            {usedOcr && !isScanned && parsedRows.length > 0 && (
              <div className="bg-warning/10 border border-warning/20 text-foreground rounded-xl p-3 text-xs">
                These rows came from OCR, not a text layer — every row is marked &quot;Needs review&quot;. Check amounts and dates against the original document before importing.
              </div>
            )}

            {headerErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 text-sm">
                {headerErrors.join(" ")}
              </div>
            )}

            {parsedRows.length > 0 && !isScanned && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <SummaryStat label="Detected" value={summary.total} />
                  <SummaryStat label="New" value={summary.clean.length} tone="text-success" />
                  <SummaryStat label="Duplicates" value={summary.duplicate.length} tone={summary.duplicate.length > 0 ? "text-warning" : undefined} />
                  <SummaryStat label="Needs Review" value={summary.review.length} tone={summary.review.length > 0 ? "text-warning" : undefined} />
                  <SummaryStat label="Invalid" value={summary.invalid.length} tone={summary.invalid.length > 0 ? "text-destructive" : undefined} />
                </div>

                {pageCount && <p className="text-xs text-muted-foreground">{pageCount} page(s) processed.</p>}

                {balanceCheck && (
                  <div className={cn("rounded-xl border p-3 text-sm", balanceCheck.passed ? "bg-success/5 border-success/20" : "bg-warning/5 border-warning/20")}>
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      {balanceCheck.passed ? <CheckCircle2 className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-warning" />}
                      Balance Check {balanceCheck.passed ? "Passed" : "— Difference Found"}
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div><p className="text-muted-foreground">Expected (closing)</p><p className="font-bold text-foreground">{formatCurrency(balanceCheck.closing, selectedAccount?.currency ?? "TZS")}</p></div>
                      <div><p className="text-muted-foreground">Calculated</p><p className="font-bold text-foreground">{formatCurrency(balanceCheck.calculated, selectedAccount?.currency ?? "TZS")}</p></div>
                      <div><p className="text-muted-foreground">Difference</p><p className={cn("font-bold", balanceCheck.passed ? "text-success" : "text-warning")}>{formatCurrency(Math.abs(balanceCheck.difference), selectedAccount?.currency ?? "TZS")}</p></div>
                    </div>
                  </div>
                )}

                {summary.duplicate.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} className="rounded" />
                    Also import the {summary.duplicate.length} duplicate row(s) anyway
                  </label>
                )}

                <DataTable
                  data={parsedRows}
                  getRowId={(r) => String(r.rowIndex)}
                  initialSort={{ key: "row", dir: "asc" }}
                  pageSize={50}
                  columns={[
                    { key: "row", header: "#", accessor: (r) => r.rowIndex, sortValue: (r) => r.rowIndex },
                    { key: "date", header: "Date", accessor: (r) => r.date, sortValue: (r) => r.date },
                    { key: "description", header: "Description", accessor: (r) => <span className="truncate max-w-[220px] block">{r.description || "—"}</span> },
                    { key: "reference", header: "Reference", hideBelow: "lg", accessor: (r) => <span className="font-mono text-xs">{r.reference || "—"}</span> },
                    { key: "in", header: "Money In", align: "right", hideBelow: "sm", accessor: (r) => r.credit > 0 ? formatCurrency(r.credit, selectedAccount?.currency ?? "TZS") : "—" },
                    { key: "out", header: "Money Out", align: "right", hideBelow: "sm", accessor: (r) => r.debit > 0 ? formatCurrency(r.debit, selectedAccount?.currency ?? "TZS") : "—" },
                    { key: "balance", header: "Balance", align: "right", hideBelow: "lg", accessor: (r) => r.balance !== null ? formatCurrency(r.balance, selectedAccount?.currency ?? "TZS") : "—" },
                    {
                      key: "status", header: "Import Status",
                      accessor: (r) => {
                        // Reuses existing StatusBadge tone words purely for
                        // their color (rejected=danger, pending=warning,
                        // ignored=neutral, approved=success) — the visible
                        // text is fully overridden via `label`, so this
                        // needs no change to the shared status→tone map.
                        if (r.errors.length > 0) return <StatusBadge status="rejected" label={`Invalid — ${r.errors.join(" ")}`} />;
                        if (r.isDuplicate) return <StatusBadge status="ignored" label="Duplicate" />;
                        if (r.confidence === "review") return <StatusBadge status="pending" label={r.issue ?? "Needs review"} />;
                        return <StatusBadge status="approved" label="New" />;
                      },
                    },
                  ]}
                />
              </div>
            )}

            <Button
              onClick={() => createBatch(rowsToImport, activeFormat.label)}
              disabled={saving || rowsToImport.length === 0}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Import {rowsToImport.length} transaction{rowsToImport.length === 1 ? "" : "s"}
            </Button>
          </div>
        ) : (
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">Creates an empty statement — add transaction lines one at a time from the reconciliation screen afterward.</p>
            <Button onClick={() => createBatch([], "manual entry")} disabled={saving} className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Create empty statement
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="bg-background border border-border rounded-xl p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-black", tone ?? "text-foreground")}>{value}</p>
    </div>
  );
}
