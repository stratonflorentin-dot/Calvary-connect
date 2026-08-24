"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Scale, ArrowLeft, RefreshCw, Download, Calendar, FileText, Calculator, AlertTriangle, Table as TableIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { loadRateMap, convertSync } from "@/lib/finance/fx";
import { REPORTING_CURRENCY } from "@/lib/finance/multi-currency";

type Tax = {
  id: string;
  tax_type: string;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  description: string;
  period: string;
};

type Invoice = {
  id: string;
  amount: number;
  currency: string;
  due_date: string;
  tax_amount?: number;
  wht_amount?: number;
  type: string;
};

type Expense = {
  id: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  tax_deductible?: boolean;
};

export default function TaxReportsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current");
  const [selectedTaxType, setSelectedTaxType] = useState<string>("all");
  const [rateMap, setRateMap] = useState<Record<string, number>>({});
  const [rateMapMissing, setRateMapMissing] = useState<string[]>([]);

  const loadTaxData = async () => {
    setLoading(true);
    try {
      const [taxesData, invoicesData, expensesData] = await Promise.all([
        supabase.from("taxes").select("*").order("due_date", { ascending: false }),
        supabase.from("invoices").select("*"),
        supabase.from("expenses").select("*"),
      ]);

      setTaxes(taxesData.data || []);
      setInvoices(invoicesData.data || []);
      setExpenses(expensesData.data || []);
    } catch (err) {
      console.error("Error loading tax data:", err);
      toast({ title: "Error", description: "Failed to load tax data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaxData();
  }, []);

  useEffect(() => {
    const currencies = Array.from(new Set([
      ...taxes.map((t) => t.currency),
      ...invoices.map((i) => i.currency),
      ...expenses.map((e) => e.currency),
    ].filter(Boolean)));
    if (currencies.length === 0) return;
    loadRateMap(currencies, REPORTING_CURRENCY).then((map) => {
      setRateMap(map);
      setRateMapMissing(currencies.filter((c) => c !== REPORTING_CURRENCY && map[`${c}->${REPORTING_CURRENCY}`] == null));
    });
  }, [taxes, invoices, expenses]);

  const filteredTaxes = selectedTaxType === "all"
    ? taxes
    : taxes.filter((t) => t.tax_type === selectedTaxType);

  const taxTypes = useMemo(() => {
    const types = new Set(taxes.map((t) => t.tax_type).filter(Boolean));
    return Array.from(types);
  }, [taxes]);

  const taxCalculations = useMemo(() => {
    // These are single statutory figures (VAT/corporate tax filings are
    // reported to TRA in TZS), so unlike a per-customer or per-route report
    // they genuinely need one consolidated number — but that number has to
    // come from converting each amount into TZS first, not from summing raw
    // amounts across currencies as if $1 and TZS 1 were the same unit.
    // toTzs returns null (amount excluded, not silently dropped-as-zero)
    // when no rate is on file for that currency.
    const toTzs = (amount: number, currency: string) => convertSync(amount, currency, REPORTING_CURRENCY, rateMap);
    const sumTzs = <T,>(rows: T[], amount: (r: T) => number, currency: (r: T) => string) =>
      rows.reduce((sum, r) => sum + (toTzs(amount(r), currency(r)) ?? 0), 0);

    const salesTax = sumTzs(
      invoices.filter((i) => i.type === "AR" || i.type === "sales"),
      (i) => i.tax_amount || i.amount * 0.18,
      (i) => i.currency,
    );

    const vatCollected = sumTzs(
      invoices.filter((i) => i.type === "AR"),
      (i) => i.amount * 0.18,
      (i) => i.currency,
    );

    const vatPaid = sumTzs(
      expenses.filter((e) => e.tax_deductible !== false),
      (e) => e.amount * 0.18,
      (e) => e.currency,
    );

    const netVat = vatCollected - vatPaid;

    const corporateTax = (sumTzs(invoices, (i) => i.amount, (i) => i.currency) -
                         sumTzs(expenses, (e) => e.amount, (e) => e.currency)) * 0.3;

    // Real per-invoice WHT (deducted by clients paying us, per invoices.wht_amount),
    // not a flat 5% guess — invoices created before this column was populated
    // will correctly show 0 here rather than a fabricated estimate.
    const witholdingTax = sumTzs(invoices, (i) => Number(i.wht_amount) || 0, (i) => i.currency);

    const totalTaxDue = sumTzs(taxes.filter((t) => t.status !== "paid"), (t) => t.amount, (t) => t.currency);

    return {
      salesTax,
      vatCollected,
      vatPaid,
      netVat,
      corporateTax: Math.max(0, corporateTax),
      witholdingTax,
      totalTaxDue,
    };
  }, [invoices, expenses, taxes, rateMap]);

  const exportTaxReport = () => {
    const report = {
      period: selectedPeriod,
      calculations: taxCalculations,
      taxes: filteredTaxes.map((t) => ({
        Type: t.tax_type,
        Amount: t.amount,
        Currency: t.currency,
        DueDate: t.due_date,
        Status: t.status,
        Period: t.period,
        Description: t.description,
      })),
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-report-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    toast({ variant: "success", title: "Success", description: "Tax report exported" });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Tax Reports", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Period: ${selectedPeriod}`, 14, 38);
    
    doc.text(`Total Tax Due (TZS, consolidated): ${formatAmount(taxCalculations.totalTaxDue, "TZS")}`, 14, 50);
    doc.text(`VAT Collected (TZS, consolidated): ${formatAmount(taxCalculations.vatCollected, "TZS")}`, 14, 58);
    doc.text(`VAT Paid Deductible (TZS, consolidated): ${formatAmount(taxCalculations.vatPaid, "TZS")}`, 14, 66);
    doc.text(`Net VAT Liability (TZS, consolidated): ${formatAmount(taxCalculations.netVat, "TZS")}`, 14, 74);
    doc.text(`Corporate Tax Est (TZS, consolidated): ${formatAmount(taxCalculations.corporateTax, "TZS")}`, 14, 82);
    doc.text(`Withholding Tax (TZS, consolidated): ${formatAmount(taxCalculations.witholdingTax, "TZS")}`, 14, 90);

    // Tax records table
    const taxTableData = filteredTaxes.map((t) => [
      t.tax_type,
      t.period,
      formatDate(t.due_date),
      t.description,
      t.status,
      formatAmount(t.amount, t.currency),
    ]);

    autoTable(doc, {
      startY: 100,
      head: [["Tax Type", "Period", "Due Date", "Description", "Status", "Amount"]],
      body: taxTableData,
      theme: "grid",
      headStyles: { fillColor: [139, 92, 246] },
    });

    doc.save(`tax-report-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ variant: "success", title: "Success", description: "PDF exported successfully" });
  };

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Tax calculations sheet
    const calcSheet = XLSX.utils.json_to_sheet([
      { Metric: "Total Tax Due (TZS, consolidated)", Value: taxCalculations.totalTaxDue },
      { Metric: "VAT Collected (TZS, consolidated)", Value: taxCalculations.vatCollected },
      { Metric: "VAT Paid Deductible (TZS, consolidated)", Value: taxCalculations.vatPaid },
      { Metric: "Net VAT Liability (TZS, consolidated)", Value: taxCalculations.netVat },
      { Metric: "Corporate Tax Est (TZS, consolidated)", Value: taxCalculations.corporateTax },
      { Metric: "Withholding Tax (TZS, consolidated)", Value: taxCalculations.witholdingTax },
    ]);
    XLSX.utils.book_append_sheet(workbook, calcSheet, "Calculations");

    // Tax records sheet
    const taxSheet = XLSX.utils.json_to_sheet(
      filteredTaxes.map((t) => ({
        TaxType: t.tax_type,
        Period: t.period,
        DueDate: t.due_date,
        Description: t.description,
        Status: t.status,
        Amount: t.amount,
        Currency: t.currency,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, taxSheet, "Tax Records");

    XLSX.writeFile(workbook, `tax-report-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ variant: "success", title: "Success", description: "Excel exported successfully" });
  };

  const getTaxStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-success/10 text-success border-success/20">Paid</Badge>;
      case "pending":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      case "overdue":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button onClick={loadTaxData} disabled={loading}>
            <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
          </Button>
          <Button onClick={exportPDF} variant="outline">
            <FileText className="size-4 mr-2" /> Export PDF
          </Button>
          <Button onClick={exportExcel} variant="outline">
            <TableIcon className="size-4 mr-2" /> Export Excel
          </Button>
          <Button onClick={exportTaxReport} variant="outline">
            <Download className="size-4 mr-2" /> Export JSON
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Tax Reports</h1>
        <p className="text-muted-foreground">Track tax liabilities, VAT, and corporate tax obligations. Calculations below are consolidated into TZS since statutory filings are reported in TZS.</p>
        {rateMapMissing.length > 0 && (
          <p className="text-xs text-warning mt-1">
            Missing an exchange rate for {rateMapMissing.join(", ")} — those amounts are excluded from the totals below until{" "}
            <Link href="/finance/accounting/fx-rates" className="text-primary hover:underline">a rate is recorded</Link>.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex-1 min-w-[160px]">
          <Label>Tax Type Filter</Label>
          <Select value={selectedTaxType} onValueChange={setSelectedTaxType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tax Types</SelectItem>
              {taxTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Period</Label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="quarter">Current Quarter</SelectItem>
              <SelectItem value="year">Current Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tax Calculation Summary */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="size-4 text-destructive" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Tax Due</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatAmount(taxCalculations.totalTaxDue, "TZS")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">VAT Collected</p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatAmount(taxCalculations.vatCollected, "TZS")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="size-4 text-success" />
              <p className="text-xs font-medium text-muted-foreground uppercase">VAT Paid (Deductible)</p>
            </div>
            <p className="text-2xl font-bold text-success">{formatAmount(taxCalculations.vatPaid, "TZS")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Net VAT Liability</p>
            </div>
            <p className={cn("text-2xl font-bold", taxCalculations.netVat >= 0 ? "text-destructive" : "text-success")}>
              {formatAmount(taxCalculations.netVat, "TZS")}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Additional Tax Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="size-4 text-info" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Corporate Tax (Est.)</p>
            </div>
            <p className="text-2xl font-bold text-info">{formatAmount(taxCalculations.corporateTax, "TZS")}</p>
            <p className="text-xs text-muted-foreground">30% of taxable profit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Withholding Tax</p>
            </div>
            <p className="text-2xl font-bold text-warning">{formatAmount(taxCalculations.witholdingTax, "TZS")}</p>
            <p className="text-xs text-muted-foreground">5% on payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="size-4 text-destructive" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Overdue Taxes</p>
            </div>
            <p className="text-2xl font-bold text-destructive">
              {taxes.filter((t) => t.status === "overdue").length}
            </p>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>
      </section>

      {/* Tax Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-5" /> Tax Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tax Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTaxes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No tax records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTaxes.map((tax) => (
                    <TableRow key={tax.id}>
                      <TableCell className="font-medium">{tax.tax_type}</TableCell>
                      <TableCell>{tax.period}</TableCell>
                      <TableCell>{formatDate(tax.due_date)}</TableCell>
                      <TableCell>{tax.description}</TableCell>
                      <TableCell>{getTaxStatusBadge(tax.status)}</TableCell>
                      <TableCell className="font-medium text-destructive">{formatAmount(tax.amount, tax.currency)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
