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

  const filteredTaxes = selectedTaxType === "all"
    ? taxes
    : taxes.filter((t) => t.tax_type === selectedTaxType);

  const taxTypes = useMemo(() => {
    const types = new Set(taxes.map((t) => t.tax_type).filter(Boolean));
    return Array.from(types);
  }, [taxes]);

  const taxCalculations = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    const salesTax = invoices
      .filter((i) => i.type === "AR" || i.type === "sales")
      .reduce((sum, i) => sum + (i.tax_amount || i.amount * 0.18), 0);
    
    const vatCollected = invoices
      .filter((i) => i.type === "AR")
      .reduce((sum, i) => sum + (i.amount * 0.18), 0);
    
    const vatPaid = expenses
      .filter((e) => e.tax_deductible !== false)
      .reduce((sum, e) => sum + (e.amount * 0.18), 0);
    
    const netVat = vatCollected - vatPaid;
    
    const corporateTax = (invoices.reduce((sum, i) => sum + i.amount, 0) - 
                         expenses.reduce((sum, e) => sum + e.amount, 0)) * 0.3;
    
    const witholdingTax = invoices
      .filter((i) => i.type === "AP")
      .reduce((sum, i) => sum + (i.amount * 0.05), 0);

    const totalTaxDue = taxes
      .filter((t) => t.status !== "paid")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      salesTax,
      vatCollected,
      vatPaid,
      netVat,
      corporateTax: Math.max(0, corporateTax),
      witholdingTax,
      totalTaxDue,
    };
  }, [invoices, expenses, taxes]);

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
    toast({ title: "Success", description: "Tax report exported" });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Tax Reports", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Period: ${selectedPeriod}`, 14, 38);
    
    doc.text(`Total Tax Due: ${formatAmount(taxCalculations.totalTaxDue)}`, 14, 50);
    doc.text(`VAT Collected: ${formatAmount(taxCalculations.vatCollected)}`, 14, 58);
    doc.text(`VAT Paid (Deductible): ${formatAmount(taxCalculations.vatPaid)}`, 14, 66);
    doc.text(`Net VAT Liability: ${formatAmount(taxCalculations.netVat)}`, 14, 74);
    doc.text(`Corporate Tax (Est.): ${formatAmount(taxCalculations.corporateTax)}`, 14, 82);
    doc.text(`Withholding Tax: ${formatAmount(taxCalculations.witholdingTax)}`, 14, 90);

    // Tax records table
    const taxTableData = filteredTaxes.map((t) => [
      t.tax_type,
      t.period,
      formatDate(t.due_date),
      t.description,
      t.status,
      formatAmount(t.amount),
    ]);

    autoTable(doc, {
      startY: 100,
      head: [["Tax Type", "Period", "Due Date", "Description", "Status", "Amount"]],
      body: taxTableData,
      theme: "grid",
      headStyles: { fillColor: [139, 92, 246] },
    });

    doc.save(`tax-report-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Tax calculations sheet
    const calcSheet = XLSX.utils.json_to_sheet([
      { Metric: "Total Tax Due", Value: taxCalculations.totalTaxDue },
      { Metric: "VAT Collected", Value: taxCalculations.vatCollected },
      { Metric: "VAT Paid (Deductible)", Value: taxCalculations.vatPaid },
      { Metric: "Net VAT Liability", Value: taxCalculations.netVat },
      { Metric: "Corporate Tax (Est.)", Value: taxCalculations.corporateTax },
      { Metric: "Withholding Tax", Value: taxCalculations.witholdingTax },
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
    toast({ title: "Success", description: "Excel exported successfully" });
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
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
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
        <p className="text-muted-foreground">Track tax liabilities, VAT, and corporate tax obligations</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
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
            <p className="text-2xl font-bold text-destructive">{formatAmount(taxCalculations.totalTaxDue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">VAT Collected</p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatAmount(taxCalculations.vatCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="size-4 text-success" />
              <p className="text-xs font-medium text-muted-foreground uppercase">VAT Paid (Deductible)</p>
            </div>
            <p className="text-2xl font-bold text-success">{formatAmount(taxCalculations.vatPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Net VAT Liability</p>
            </div>
            <p className={cn("text-2xl font-bold", taxCalculations.netVat >= 0 ? "text-destructive" : "text-success")}>
              {formatAmount(taxCalculations.netVat)}
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
            <p className="text-2xl font-bold text-info">{formatAmount(taxCalculations.corporateTax)}</p>
            <p className="text-xs text-muted-foreground">30% of taxable profit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Withholding Tax</p>
            </div>
            <p className="text-2xl font-bold text-warning">{formatAmount(taxCalculations.witholdingTax)}</p>
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
          <div className="rounded-md border">
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
                      <TableCell className="font-medium text-destructive">{formatAmount(tax.amount)}</TableCell>
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
