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
import { TrendingDown, ArrowLeft, RefreshCw, Download, PieChart, BarChart3, Calendar, Filter, FileText, Table as TableIcon, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import { PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { CurrencyBadge, formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";

type Expense = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  vendor: string;
  status: string;
};

const COLORS = ["#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899"];

export default function ExpenseAnalysisPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const loadExpenses = async () => {
    setLoading(true);
    try {
      let query = supabase.from("expenses").select("*").order("date", { ascending: false });
      
      if (dateRange.start) {
        query = query.gte("date", dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte("date", dateRange.end);
      }

      const { data } = await query;
      setExpenses(data || []);
    } catch (err) {
      console.error("Error loading expenses:", err);
      toast({ title: "Error", description: "Failed to load expenses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [dateRange]);

  const filteredExpenses = selectedCategory === "all"
    ? expenses
    : expenses.filter((e) => e.category === selectedCategory);

  // Group expenses by currency
  const expensesByCurrency = useMemo(() => {
    const currencyMap = new Map<string, {
      totalExpenses: number;
      pendingExpenses: number;
      approvedExpenses: number;
      expenses: Expense[];
    }>();

    AVAILABLE_CURRENCIES.forEach(curr => {
      currencyMap.set(curr.code, {
        totalExpenses: 0,
        pendingExpenses: 0,
        approvedExpenses: 0,
        expenses: [],
      });
    });

    filteredExpenses.forEach((expense) => {
      const currency = expense.currency || "TZS";
      const existing = currencyMap.get(currency) || {
        totalExpenses: 0,
        pendingExpenses: 0,
        approvedExpenses: 0,
        expenses: [],
      };
      existing.expenses.push(expense);
      existing.totalExpenses += expense.amount;
      if (expense.status === "pending") existing.pendingExpenses += expense.amount;
      if (expense.status === "approved") existing.approvedExpenses += expense.amount;
      currencyMap.set(currency, existing);
    });

    return currencyMap;
  }, [filteredExpenses]);

  // Keyed by name+currency (not just name) so a category/vendor/month with
  // expenses in more than one currency gets separate, correctly-labeled
  // entries instead of being summed together under whichever currency
  // happened to be processed last.
  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, { name: string; amount: number; currency: string }>();
    filteredExpenses.forEach((expense) => {
      const category = expense.category || "Uncategorized";
      const currency = expense.currency || "TZS";
      const key = `${category}::${currency}`;
      const existing = categoryMap.get(key) || { name: category, amount: 0, currency };
      categoryMap.set(key, { name: category, amount: existing.amount + expense.amount, currency });
    });
    return Array.from(categoryMap.values());
  }, [filteredExpenses]);

  const vendorData = useMemo(() => {
    const vendorMap = new Map<string, { name: string; amount: number; currency: string }>();
    filteredExpenses.forEach((expense) => {
      const vendor = expense.vendor || "Unknown";
      const currency = expense.currency || "TZS";
      const key = `${vendor}::${currency}`;
      const existing = vendorMap.get(key) || { name: vendor, amount: 0, currency };
      vendorMap.set(key, { name: vendor, amount: existing.amount + expense.amount, currency });
    });
    return Array.from(vendorMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [filteredExpenses]);

  const monthlyData = useMemo(() => {
    const monthlyMap = new Map<string, { month: string; amount: number; currency: string }>();
    filteredExpenses.forEach((expense) => {
      const month = new Date(expense.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const currency = expense.currency || "TZS";
      const key = `${month}::${currency}`;
      const existing = monthlyMap.get(key) || { month, amount: 0, currency };
      monthlyMap.set(key, { month, amount: existing.amount + expense.amount, currency });
    });
    return Array.from(monthlyMap.values());
  }, [filteredExpenses]);

  const categories = useMemo(() => {
    const cats = new Set(filteredExpenses.map((e) => e.category).filter(Boolean));
    return Array.from(cats);
  }, [filteredExpenses]);

  // The actual rendered stat cards use expenseData (grouped per currency,
  // above) — a flat cross-currency total here would be dead code the
  // moment it existed, same issue found and removed from the sibling
  // revenue-analysis page.
  // "% of total" only means something within a single currency — a USD
  // expense's share of a blended TZS+USD figure is meaningless.
  const totalExpensesByCurrency = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const cur = e.currency || "TZS";
      byCurrency[cur] = (byCurrency[cur] ?? 0) + e.amount;
    });
    return byCurrency;
  }, [filteredExpenses]);
  const pctOfCurrencyTotal = (amount: number, currency: string) => {
    const total = totalExpensesByCurrency[currency || "TZS"] || 0;
    return total > 0 ? (amount / total) * 100 : 0;
  };
  const topCategory = categoryData.length > 0 ? categoryData.reduce((max, item) => item.amount > max.amount ? item : max) : null;
  const topVendor = vendorData.length > 0 ? vendorData[0] : null;

  const exportData = () => {
    const data = filteredExpenses.map((e) => ({
      Date: e.date,
      Description: e.description,
      Category: e.category,
      Vendor: e.vendor,
      Amount: e.amount,
      Currency: e.currency,
      Status: e.status,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expense-analysis-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    toast({ variant: "success", title: "Success", description: "Expense data exported" });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Expense Analysis Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    if (dateRange.start || dateRange.end) {
      doc.text(`Period: ${dateRange.start || "All"} to ${dateRange.end || "All"}`, 14, 38);
    }
    
    const totalsLine = Object.entries(totalExpensesByCurrency).map(([cur, amt]) => formatAmount(amt, cur)).join(" · ") || formatAmount(0, "TZS");
    doc.text(`Total Expenses: ${totalsLine}`, 14, 46);

    // Category breakdown table
    const categoryTableData = categoryData.map((item) => [
      item.name,
      formatCurrency(item.amount, item.currency),
      `${pctOfCurrencyTotal(item.amount, item.currency).toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: 55,
      head: [["Category", "Amount", "% of Total"]],
      body: categoryTableData,
      theme: "grid",
      headStyles: { fillColor: [239, 68, 68] },
    });

    // Detailed expenses table
    const expenseTableData = filteredExpenses.map((e) => [
      formatDate(e.date),
      e.description,
      e.category,
      e.vendor || "-",
      e.status,
      formatAmount(e.amount, e.currency),
    ]);

    // jspdf-autotable v5's functional autoTable() returns void — the result
    // lives on doc.lastAutoTable instead. Reading .finalY off the return
    // value throws "Cannot read properties of undefined", which silently
    // aborted this export before doc.save() ever ran.
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Date", "Description", "Category", "Vendor", "Status", "Amount"]],
      body: expenseTableData,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`expense-analysis-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ variant: "success", title: "Success", description: "PDF exported successfully" });
  };

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Category breakdown sheet
    const categorySheet = XLSX.utils.json_to_sheet(
      categoryData.map((item) => ({
        Category: item.name,
        Amount: item.amount,
        Currency: item.currency,
        Percentage: pctOfCurrencyTotal(item.amount, item.currency).toFixed(1) + "%",
      }))
    );
    XLSX.utils.book_append_sheet(workbook, categorySheet, "Category Breakdown");

    // Detailed expenses sheet
    const expenseSheet = XLSX.utils.json_to_sheet(
      filteredExpenses.map((e) => ({
        Date: e.date,
        Description: e.description,
        Category: e.category,
        Vendor: e.vendor || "-",
        Status: e.status,
        Amount: e.amount,
        Currency: e.currency,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, expenseSheet, "Expenses");

    XLSX.writeFile(workbook, `expense-analysis-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ variant: "success", title: "Success", description: "Excel exported successfully" });
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
          <Button onClick={loadExpenses} disabled={loading}>
            <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
          </Button>
          <Button onClick={exportPDF} variant="outline">
            <FileText className="size-4 mr-2" /> Export PDF
          </Button>
          <Button onClick={exportExcel} variant="outline">
            <TableIcon className="size-4 mr-2" /> Export Excel
          </Button>
          <Button onClick={exportData} variant="outline">
            <Download className="size-4 mr-2" /> Export JSON
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Expense Analysis</h1>
        <p className="text-muted-foreground">Comprehensive breakdown of expenses by category, vendor, and time period</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex-1 min-w-[160px]">
          <Label>Category Filter</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>From Date</Label>
          <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
        </div>
        <div>
          <Label>To Date</Label>
          <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
        </div>
      </div>

      {/* Summary Cards by Currency */}
      <section className="space-y-6 mb-6">
        {AVAILABLE_CURRENCIES.map((currency) => {
          const expenseData = expensesByCurrency.get(currency.code);
          if (!expenseData || expenseData.totalExpenses === 0) return null;

          return (
            <Card key={currency.code}>
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <span className="text-2xl">{currency.flag}</span>
                    <span>{currency.name}</span>
                    <CurrencyBadge currency={currency.code} />
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="size-4 text-destructive" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Total Expenses</p>
                    </div>
                    <p className="text-2xl font-bold text-destructive">{formatCurrency(expenseData.totalExpenses, currency.code)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="size-4 text-warning" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Pending</p>
                    </div>
                    <p className="text-2xl font-bold text-warning">{formatCurrency(expenseData.pendingExpenses, currency.code)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="size-4 text-success" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Approved</p>
                    </div>
                    <p className="text-2xl font-bold text-success">{formatCurrency(expenseData.approvedExpenses, currency.code)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="size-4 text-primary" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Avg Expense</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {expenseData.expenses.length > 0 ? formatCurrency(expenseData.totalExpenses / expenseData.expenses.length, currency.code) : formatCurrency(0, currency.code)}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="size-4 text-info" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Total Records</p>
                    </div>
                    <p className="text-2xl font-bold text-info">{expenseData.expenses.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <RechartsPieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={60} dataKey="amount" label={(entry) => entry.name}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, name: any, props: any) => [formatCurrency(value, props?.payload?.currency || "TZS"), name]} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Expenses</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value: any, name: any, props: any) => [formatCurrency(value, props?.payload?.currency || "TZS"), name]} />
                <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 10 Vendors</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={vendorData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={60} />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value: any, name: any, props: any) => [formatCurrency(value, props?.payload?.currency || "TZS"), name]} />
                <Bar dataKey="amount" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* Category Breakdown Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>% of Total</TableHead>
                  <TableHead>Transactions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No expense data available
                    </TableCell>
                  </TableRow>
                ) : (
                  categoryData.sort((a, b) => b.amount - a.amount).map((item) => {
                    const count = filteredExpenses.filter((e) => e.category === item.name && (e.currency || "TZS") === item.currency).length;
                    const percentage = pctOfCurrencyTotal(item.amount, item.currency);
                    return (
                      <TableRow key={`${item.name}::${item.currency}`}>
                        <TableCell className="font-medium">{item.name} <span className="text-[10px] text-muted-foreground">{item.currency}</span></TableCell>
                        <TableCell className="text-destructive font-medium">{formatCurrency(item.amount, item.currency)}</TableCell>
                        <TableCell>{percentage.toFixed(1)}%</TableCell>
                        <TableCell>{count}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No expenses found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{formatDate(expense.date)}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.category || "Uncategorized"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{expense.vendor || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={expense.status === "paid" ? "default" : "secondary"}>
                          {expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-destructive">{formatAmount(expense.amount, expense.currency)}</TableCell>
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
