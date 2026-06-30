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
import { TrendingDown, ArrowLeft, RefreshCw, Download, PieChart, BarChart3, Calendar, Filter } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import { PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

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

  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    filteredExpenses.forEach((expense) => {
      const category = expense.category || "Uncategorized";
      categoryMap.set(category, (categoryMap.get(category) || 0) + expense.amount);
    });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  const vendorData = useMemo(() => {
    const vendorMap = new Map<string, number>();
    filteredExpenses.forEach((expense) => {
      const vendor = expense.vendor || "Unknown";
      vendorMap.set(vendor, (vendorMap.get(vendor) || 0) + expense.amount);
    });
    return Array.from(vendorMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredExpenses]);

  const monthlyData = useMemo(() => {
    const monthlyMap = new Map<string, number>();
    filteredExpenses.forEach((expense) => {
      const month = new Date(expense.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + expense.amount);
    });
    return Array.from(monthlyMap.entries()).map(([month, amount]) => ({ month, amount }));
  }, [filteredExpenses]);

  const categories = useMemo(() => {
    const cats = new Set(filteredExpenses.map((e) => e.category).filter(Boolean));
    return Array.from(cats);
  }, [filteredExpenses]);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const avgExpense = filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0;
  const topCategory = categoryData.length > 0 ? categoryData.reduce((max, item) => item.value > max.value ? item : max) : null;
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
    toast({ title: "Success", description: "Expense data exported" });
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
          <Button onClick={loadExpenses} disabled={loading}>
            <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
          </Button>
          <Button onClick={exportData}>
            <Download className="size-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Expense Analysis</h1>
        <p className="text-muted-foreground">Comprehensive breakdown of expenses by category, vendor, and time period</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
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

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="size-4 text-destructive" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Expenses</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatAmount(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Avg Expense</p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatAmount(avgExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Top Category</p>
            </div>
            <p className="text-xl font-bold text-warning">{topCategory?.name || "-"}</p>
            <p className="text-xs text-muted-foreground">{topCategory ? formatAmount(topCategory.value) : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="size-4 text-info" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Top Vendor</p>
            </div>
            <p className="text-xl font-bold text-info">{topVendor?.name || "-"}</p>
            <p className="text-xs text-muted-foreground">{topVendor ? formatAmount(topVendor.value) : ""}</p>
          </CardContent>
        </Card>
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
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={(entry) => entry.name}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
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
                <Tooltip />
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
                <Tooltip />
                <Bar dataKey="value" fill="#06b6d4" />
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
          <div className="rounded-md border">
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
                  categoryData.sort((a, b) => b.value - a.value).map((item) => {
                    const count = filteredExpenses.filter((e) => e.category === item.name).length;
                    const percentage = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0;
                    return (
                      <TableRow key={item.name}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-destructive font-medium">{formatAmount(item.value)}</TableCell>
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
          <div className="rounded-md border">
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
                      <TableCell className="font-medium text-destructive">{formatAmount(expense.amount)}</TableCell>
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
