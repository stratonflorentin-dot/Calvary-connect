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
import { ArrowDown, ArrowUp, Calendar, Download, RefreshCw, TrendingUp, Wallet, DollarSign } from "lucide-react";
import { formatDate, formatAmount } from "@/lib/utils";
import { CurrencyBadge, formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";

export default function CashFlowPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [income, setIncome] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const loadCashFlowData = async () => {
    setLoading(true);
    try {
      const [paymentsData, expensesData, incomeData, bankData] = await Promise.all([
        supabase
          .from("payments")
          .select("*")
          .gte("payment_date", startDate)
          .lte("payment_date", endDate)
          .order("payment_date", { ascending: true }),
        supabase
          .from("expenses")
          .select("*")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }),
        supabase
          .from("income")
          .select("*")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }),
        supabase.from("bank_accounts").select("*"),
      ]);
      if (paymentsData.error) throw paymentsData.error;
      if (expensesData.error) throw expensesData.error;
      if (incomeData.error) throw incomeData.error;
      if (bankData.error) throw bankData.error;
      setPayments(paymentsData.data || []);
      setExpenses(expensesData.data || []);
      setIncome(incomeData.data || []);
      setBankAccounts(bankData.data || []);
    } catch (err) {
      console.error("Error loading cash flow data:", err);
      toast({ title: "Error", description: "Failed to load cash flow data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashFlowData();
  }, [startDate, endDate]);

  // Group cash flow data by currency
  const cashFlowByCurrency = useMemo(() => {
    const currencyMap = new Map<string, {
      cashFromOperations: number;
      cashFromInvesting: number;
      cashFromFinancing: number;
      netCashFlow: number;
      beginningCash: number;
      endingCash: number;
      payments: any[];
      expenses: any[];
      income: any[];
      bankAccounts: any[];
    }>();

    AVAILABLE_CURRENCIES.forEach(curr => {
      const currencyPayments = payments.filter((p) => p.currency === curr.code);
      const currencyExpenses = expenses.filter((e) => e.currency === curr.code);
      const currencyIncome = income.filter((i) => i.currency === curr.code);
      const currencyBankAccounts = bankAccounts.filter((b) => b.currency === curr.code);

      const cashFromOperations = currencyIncome.reduce((sum, i) => sum + (i.amount || 0), 0) - 
                                 currencyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      
      const cashFromInvesting = 0; // Would include asset purchases/sales
      
      const cashFromFinancing = currencyPayments.reduce((sum, p) => sum + (p.amount || 0), 0); // Loan payments, dividends
      
      const netCashFlow = cashFromOperations + cashFromInvesting + cashFromFinancing;
      
      const beginningCash = currencyBankAccounts.reduce((sum, b) => sum + (b.balance || 0), 0) - netCashFlow;
      const endingCash = beginningCash + netCashFlow;

      currencyMap.set(curr.code, {
        cashFromOperations,
        cashFromInvesting,
        cashFromFinancing,
        netCashFlow,
        beginningCash,
        endingCash,
        payments: currencyPayments,
        expenses: currencyExpenses,
        income: currencyIncome,
        bankAccounts: currencyBankAccounts,
      });
    });

    return currencyMap;
  }, [payments, expenses, income, bankAccounts]);

  const exportReport = () => {
    const reportData = {
      reportType: "Cash Flow Statement",
      period: { startDate, endDate },
      cashFlowByCurrency: Object.fromEntries(cashFlowByCurrency),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-flow-${startDate}-to-${endDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Cash flow report exported successfully" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cash Flow Statement</h1>
          <p className="text-muted-foreground">Track cash inflows and outflows</p>
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
            <Button variant="outline" size="sm" onClick={loadCashFlowData}>
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Cash Flow Statements by Currency */}
      <div className="space-y-6">
        {AVAILABLE_CURRENCIES.map((currency) => {
          const data = cashFlowByCurrency.get(currency.code);
          if (!data || data.netCashFlow === 0 && data.endingCash === 0) return null;

          return (
            <Card key={currency.code} className="border border-border">
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-3">
                    <Wallet className="size-5" />
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
                      <CardTitle className="text-sm font-medium">Cash from Operations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <p className={`text-2xl font-bold ${data.cashFromOperations >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                          {formatCurrency(data.cashFromOperations, currency.code)}
                        </p>
                        {data.cashFromOperations >= 0 ? <ArrowUp className="size-5 text-emerald-600" /> : <ArrowDown className="size-5 text-red-600" />}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Cash from Financing</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <p className={`text-2xl font-bold ${data.cashFromFinancing >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                          {formatCurrency(data.cashFromFinancing, currency.code)}
                        </p>
                        <DollarSign className="size-5 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <p className={`text-2xl font-bold ${data.netCashFlow >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                          {formatCurrency(data.netCashFlow, currency.code)}
                        </p>
                        <TrendingUp className={`size-5 ${data.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600"}`} />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Ending Cash</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                          {formatCurrency(data.endingCash, currency.code)}
                        </p>
                        <Wallet className="size-5 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border border-border mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Cash Flow Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Cash from Operating Activities</TableCell>
                          <TableCell className={`text-right font-semibold ${data.cashFromOperations >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                            {formatCurrency(data.cashFromOperations, currency.code)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Cash from Investing Activities</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(data.cashFromInvesting, currency.code)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Cash from Financing Activities</TableCell>
                          <TableCell className={`text-right font-semibold ${data.cashFromFinancing >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                            {formatCurrency(data.cashFromFinancing, currency.code)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/30">
                          <TableCell className="font-bold">Net Change in Cash</TableCell>
                          <TableCell className={`text-right font-bold ${data.netCashFlow >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                            {formatCurrency(data.netCashFlow, currency.code)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Cash at Beginning of Period</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(data.beginningCash, currency.code)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Cash at End of Period</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.endingCash, currency.code)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Cash Inflows</CardTitle>
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
                                No cash inflows recorded
                              </TableCell>
                            </TableRow>
                          ) : (
                            data.income.map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell>{formatDate(item.date)}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
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
                      <CardTitle className="text-lg">Cash Outflows</CardTitle>
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
                          ) : data.expenses.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                No cash outflows recorded
                              </TableCell>
                            </TableRow>
                          ) : (
                            data.expenses.map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell>{formatDate(item.date)}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-right font-semibold text-red-700 dark:text-red-400">
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
