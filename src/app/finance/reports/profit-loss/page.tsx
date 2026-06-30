"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Calendar, Download, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { formatDate, formatAmount } from "@/lib/utils";
import { CurrencyBadge, formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";

export default function ProfitLossPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      const [incomeData, expensesData] = await Promise.all([
        supabase
          .from("income")
          .select("*")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }),
        supabase
          .from("expenses")
          .select("*")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }),
      ]);
      if (incomeData.error) throw incomeData.error;
      if (expensesData.error) throw expensesData.error;
      setIncome(incomeData.data || []);
      setExpenses(expensesData.data || []);
    } catch (err) {
      console.error("Error loading financial data:", err);
      toast({ title: "Error", description: "Failed to load financial data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [startDate, endDate]);

  // Group P&L data by currency
  const profitLossByCurrency = useMemo(() => {
    const currencyMap = new Map<string, {
      totalRevenue: number;
      totalExpenses: number;
      grossProfit: number;
      profitMargin: number;
      categoryExpenses: Record<string, number>;
      income: any[];
      expenses: any[];
    }>();

    AVAILABLE_CURRENCIES.forEach(curr => {
      const currencyIncome = income.filter((i) => i.currency === curr.code);
      const currencyExpenses = expenses.filter((e) => e.currency === curr.code);

      const totalRevenue = currencyIncome.reduce((sum, i) => sum + (i.amount || 0), 0);
      const totalExpenses = currencyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const grossProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      const categoryExpenses = currencyExpenses.reduce((acc, exp) => {
        const category = exp.category || "Uncategorized";
        acc[category] = (acc[category] || 0) + (exp.amount || 0);
        return acc;
      }, {} as Record<string, number>);

      currencyMap.set(curr.code, {
        totalRevenue,
        totalExpenses,
        grossProfit,
        profitMargin,
        categoryExpenses,
        income: currencyIncome,
        expenses: currencyExpenses,
      });
    });

    return currencyMap;
  }, [income, expenses]);

  const exportReport = () => {
    const reportData = {
      reportType: "Profit & Loss",
      period: { startDate, endDate },
      profitLossByCurrency: Object.fromEntries(profitLossByCurrency),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss-${startDate}-to-${endDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Report exported successfully" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profit & Loss Statement</h1>
          <p className="text-muted-foreground">Track revenue, expenses, and profitability</p>
        </div>
        <Button className="gap-2" onClick={exportReport}>
          <Download className="size-4" />
          Export Report
        </Button>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
                <span className="text-muted-foreground">to</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadFinancialData}>
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* P&L Statements by Currency */}
      <div className="space-y-6">
        {AVAILABLE_CURRENCIES.map((currency) => {
          const data = profitLossByCurrency.get(currency.code);
          if (!data || data.totalRevenue === 0 && data.totalExpenses === 0) return null;

          return (
            <Card key={currency.code} className="border border-border">
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-3">
                    <TrendingUp className="size-5" />
                    <span className="text-2xl">{currency.flag}</span>
                    <span>{currency.name}</span>
                    <CurrencyBadge currency={currency.code} />
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(data.totalRevenue, currency.code)}
                        </p>
                        <ArrowUp className="size-5 text-emerald-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                          {formatCurrency(data.totalExpenses, currency.code)}
                        </p>
                        <ArrowDown className="size-5 text-red-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <p className={`text-2xl font-bold ${data.grossProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                          {formatCurrency(data.grossProfit, currency.code)}
                        </p>
                        {data.grossProfit >= 0 ? (
                          <TrendingUp className="size-5 text-emerald-600" />
                        ) : (
                          <TrendingDown className="size-5 text-red-600" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <p className={`text-2xl font-bold ${data.profitMargin >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                          {data.profitMargin.toFixed(1)}%
                        </p>
                        <Badge variant={data.profitMargin >= 0 ? "default" : "destructive"}>
                          {data.profitMargin >= 0 ? "Profitable" : "Loss"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Revenue Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                Loading...
                              </TableCell>
                            </TableRow>
                          ) : data.income.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                No income records
                              </TableCell>
                            </TableRow>
                          ) : (
                            data.income.map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell>{formatDate(item.date)}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400">
                                  {formatCurrency(item.amount, currency.code)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Expense Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                Loading...
                              </TableCell>
                            </TableRow>
                          ) : data.expenses.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                No expense records
                              </TableCell>
                            </TableRow>
                          ) : (
                            data.expenses.map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell>{formatDate(item.date)}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{item.category || "Uncategorized"}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium text-red-700 dark:text-red-400">
                                  {formatCurrency(item.amount, currency.code)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border border-border mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Expense by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">% of Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.keys(data.categoryExpenses).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                              No expense data
                            </TableCell>
                          </TableRow>
                        ) : (
                          Object.entries(data.categoryExpenses)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .map(([category, amount]) => (
                              <TableRow key={category}>
                                <TableCell>
                                  <Badge variant="outline">{category}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatCurrency(amount as number, currency.code)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {data.totalExpenses > 0 ? ((amount as number / data.totalExpenses) * 100).toFixed(1) : 0}%
                                </TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
