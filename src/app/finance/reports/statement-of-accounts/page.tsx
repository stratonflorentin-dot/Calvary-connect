"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/components/ui/currency-badge";
import { fetchLogoDataUrl } from "@/lib/finance/document-pdf";
import { downloadStatementPdf, type StatementLine } from "@/lib/finance/statement-pdf";
import { ArrowLeft, Download, FileText, Loader2, ScrollText, Table as TableIcon } from "lucide-react";
import * as XLSX from "xlsx";

const fmt = (v: number, cur: string) => formatCurrency(v, cur);

interface LedgerEntry {
  date: string;
  description: string;
  reference: string;
  currency: string;
  debit: number;
  credit: number;
}

export default function StatementOfAccountsPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [fromDate, setFromDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [company, setCompany] = useState<any>({});

  useEffect(() => {
    supabase.from("customers").select("id, company_name, contact_person, vrn, tax_id, email, phone").is("deleted_at", null).order("company_name").then(({ data }) => setCustomers(data ?? []));
    supabase.from("company_settings")
      .select("company_name, tagline, vat_registration, tax_id, phone, email, address, bank_name, bank_account_name, bank_account_number_tzs, bank_account_number_usd, bank_branch_code, bank_swift_code, logo_url")
      .limit(1).maybeSingle().then(async ({ data }) => {
        if (!data) return;
        setCompany(data);
        const logoDataUrl = await fetchLogoDataUrl((data as any).logo_url);
        if (logoDataUrl) setCompany((c: any) => ({ ...c, logoDataUrl }));
      });
  }, []);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);

  const load = async () => {
    if (!customerId) { setEntries([]); return; }
    setLoading(true);
    try {
      // Every invoice up to "to" (not just the visible range) — entries
      // before "from" fold into the opening balance instead of vanishing.
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, total_amount, currency, issue_date, status")
        .eq("customer_id", customerId)
        .not("status", "in", "(draft,cancelled)")
        .lte("issue_date", toDate);
      const invoiceIds = (invoices ?? []).map((i) => i.id);

      const [paymentsRes, creditNotesRes] = await Promise.all([
        invoiceIds.length
          ? supabase.from("bank_transactions").select("transaction_date, credit, currency, reference, reference_id").eq("reference_type", "invoice").in("reference_id", invoiceIds).lte("transaction_date", toDate)
          : Promise.resolve({ data: [] }),
        invoiceIds.length
          ? supabase.from("credit_notes").select("credit_note_number, total_amount, currency, issue_date, status, original_invoice_id").in("original_invoice_id", invoiceIds).neq("status", "draft").lte("issue_date", toDate)
          : Promise.resolve({ data: [] }),
      ]);

      const invoiceById = new Map((invoices ?? []).map((i) => [i.id, i]));
      const list: LedgerEntry[] = [];

      (invoices ?? []).forEach((inv) => {
        list.push({
          date: inv.issue_date,
          description: `Invoice ${inv.invoice_number}`,
          reference: inv.invoice_number,
          currency: inv.currency || "TZS",
          debit: Number(inv.total_amount) || 0,
          credit: 0,
        });
      });

      (paymentsRes.data ?? []).forEach((p: any) => {
        const inv = invoiceById.get(p.reference_id);
        list.push({
          date: p.transaction_date,
          description: `Payment received${inv ? ` — ${inv.invoice_number}` : ""}`,
          reference: p.reference || inv?.invoice_number || "—",
          currency: p.currency || inv?.currency || "TZS",
          debit: 0,
          credit: Number(p.credit) || 0,
        });
      });

      (creditNotesRes.data ?? []).forEach((cn: any) => {
        list.push({
          date: cn.issue_date,
          description: `Credit Note ${cn.credit_note_number}`,
          reference: cn.credit_note_number,
          currency: cn.currency || "TZS",
          debit: 0,
          credit: Number(cn.total_amount) || 0,
        });
      });

      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEntries(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [customerId, fromDate, toDate]);

  // Never blend currencies into one balance — a customer with both a TZS
  // and a USD invoice gets one statement section per currency.
  const byCurrency = useMemo(() => {
    const groups = new Map<string, LedgerEntry[]>();
    entries.forEach((e) => {
      if (!groups.has(e.currency)) groups.set(e.currency, []);
      groups.get(e.currency)!.push(e);
    });
    return Array.from(groups.entries()).map(([currency, rows]) => {
      const before = rows.filter((r) => r.date < fromDate);
      const within = rows.filter((r) => r.date >= fromDate && r.date <= toDate);
      const openingBalance = before.reduce((sum, r) => sum + r.debit - r.credit, 0);
      let running = openingBalance;
      const lines: StatementLine[] = within.map((r) => {
        running += r.debit - r.credit;
        return { date: r.date, description: r.description, reference: r.reference, debit: r.debit, credit: r.credit, balance: running };
      });
      return { currency, openingBalance, lines, closingBalance: running };
    });
  }, [entries, fromDate, toDate]);

  const downloadPdf = (currency: string, openingBalance: number, lines: StatementLine[], closingBalance: number) => {
    if (!selectedCustomer) return;
    downloadStatementPdf({
      company,
      customer: {
        name: selectedCustomer.company_name,
        vrn: selectedCustomer.vrn,
        tin: selectedCustomer.tax_id,
        email: selectedCustomer.email,
        phone: selectedCustomer.phone,
      },
      currency,
      fromDate,
      toDate,
      openingBalance,
      lines,
      closingBalance,
    }, `Statement-${selectedCustomer.company_name}-${currency}-${toDate}.pdf`);
  };

  const downloadExcel = (currency: string, openingBalance: number, lines: StatementLine[], closingBalance: number) => {
    if (!selectedCustomer) return;
    const workbook = XLSX.utils.book_new();
    const rows = [
      { Date: "", Description: "Opening Balance", Reference: "", Debit: "", Credit: "", Balance: openingBalance },
      ...lines.map((l) => ({
        Date: l.date,
        Description: l.description,
        Reference: l.reference,
        Debit: l.debit || "",
        Credit: l.credit || "",
        Balance: l.balance,
      })),
      { Date: "", Description: "Closing Balance", Reference: "", Debit: "", Credit: "", Balance: closingBalance },
    ];
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, currency);
    XLSX.writeFile(workbook, `Statement-${selectedCustomer.company_name}-${currency}-${toDate}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/finance" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to Finance
          </Link>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-primary" /> Statement of Accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Every invoice, payment and credit note for one customer, with a running balance.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[240px]">
          <Label className="text-xs">Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="Choose a customer" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading…</div>
      ) : !customerId ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" /> Choose a customer to see their statement.
        </div>
      ) : byCurrency.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No invoices, payments or credit notes on file for this customer.</div>
      ) : (
        byCurrency.map(({ currency, openingBalance, lines, closingBalance }) => (
          <div key={currency} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{currency}</p>
                <p className="text-lg font-black text-foreground">Closing Balance: {fmt(closingBalance, currency)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadExcel(currency, openingBalance, lines, closingBalance)} className="gap-2">
                  <TableIcon className="w-3.5 h-3.5" /> Download Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadPdf(currency, openingBalance, lines, closingBalance)} className="gap-2">
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Ref</th>
                    <th className="px-4 py-2 text-right">Debit</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border bg-muted/20">
                    <td className="px-4 py-2 text-muted-foreground" colSpan={5}>Opening Balance</td>
                    <td className="px-4 py-2 text-right font-bold text-foreground">{fmt(openingBalance, currency)}</td>
                  </tr>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-border hover:bg-muted/20">
                      <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(l.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-foreground">{l.description}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{l.reference}</td>
                      <td className="px-4 py-2 text-right text-foreground">{l.debit ? fmt(l.debit, currency) : "—"}</td>
                      <td className="px-4 py-2 text-right text-success">{l.credit ? fmt(l.credit, currency) : "—"}</td>
                      <td className="px-4 py-2 text-right font-bold text-foreground">{fmt(l.balance, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
