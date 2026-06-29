"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { ArrowDown, ArrowUp, Calendar, Download, RefreshCw, TrendingUp, Wallet, DollarSign } from "lucide-react";
import { formatDate, formatAmount } from "@/lib/utils";

const supabase = createClient();

const CURRENCIES = {
  TZS: { code: "TZS", symbol: "TSh", flag: "🇹🇿" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸" },
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺" },
};

export default function CashFlowPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [income, setIncome] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCurrency, setSelectedCurrency] = useState("TZS");

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

  const filteredPayments = payments.filter((p) => p.currency === selectedCurrency);
  const filteredExpenses = expenses.filter((e) => e.currency === selectedCurrency);
  const filteredIncome = income.filter((i) => i.currency === selectedCurrency);
  const filteredBankAccounts = bankAccounts.filter((b) => b.currency === selectedCurrency);

  // Cash Flow Calculations
  const cashFromOperations = filteredIncome.reduce((sum, i) => sum + (i.amount || 0), 0) - 
                             filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const cashFromInvesting = 0; // Would include asset purchases/sales
  
  const cashFromFinancing = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0); // Loan payments, dividends
  
  const netCashFlow = cashFromOperations + cashFromInvesting + cashFromFinancing;
  
  const beginningCash = filteredBankAccounts.reduce((sum, b) => sum + (b.balance || 0), 0) - netCashFlow;
  const endingCash = beginningCash + netCashFlow;

  const exportReport = () => {
    const reportData = {
      reportType: "Cash Flow Statement",
      period: { startDate, endDate },
      currency: selectedCurrency,
      cashFlow: {
        cashFromOperations,
        cashFromInvesting,
        cashFromFinancing,
        netCashFlow,
        beginningCash,
        endingCash,
      },
      transactions: {
        payments: filteredPayments,
        expenses: filteredExpenses,
        income: filteredIncome,
      },
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
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CURRENCIES).map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={loadCashFlowData}>
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cash from Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className={`text-2xl font-bold ${cashFromOperations >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                {formatAmount(cashFromOperations, selectedCurrency)}
              </p>
              {cashFromOperations >= 0 ? <ArrowUp className="size-5 text-emerald-600" /> : <ArrowDown className="size-5 text-red-600" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cash from Financing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className={`text-2xl font-bold ${cashFromFinancing >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                {formatAmount(cashFromFinancing, selectedCurrency)}
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
              <p className={`text-2xl font-bold ${netCashFlow >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                {formatAmount(netCashFlow, selectedCurrency)}
              </p>
              <TrendingUp className={`size-5 ${netCashFlow >= 0 ? "text-emerald-600" : "text-red-600"}`} />
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
                {formatAmount(endingCash, selectedCurrency)}
              </p>
              <Wallet className="size-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border">
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
                <TableCell className={`text-right font-semibold ${cashFromOperations >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                  {formatAmount(cashFromOperations, selectedCurrency)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Cash from Investing Activities</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatAmount(cashFromInvesting, selectedCurrency)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Cash from Financing Activities</TableCell>
                <TableCell className={`text-right font-semibold ${cashFromFinancing >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                  {formatAmount(cashFromFinancing, selectedCurrency)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/30">
                <TableCell className="font-bold">Net Change in Cash</TableCell>
                <TableCell className={`text-right font-bold ${netCashFlow >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                  {formatAmount(netCashFlow, selectedCurrency)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Cash at Beginning of Period</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatAmount(beginningCash, selectedCurrency)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Cash at End of Period</TableCell>
                <TableCell className="text-right">
                  {formatAmount(endingCash, selectedCurrency)}
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
                ) : filteredIncome.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No cash inflows recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIncome.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{formatDate(item.date)}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatAmount(item.amount, item.currency)}
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
                ) : filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No cash outflows recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{formatDate(item.date)}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right font-semibold text-red-700 dark:text-red-400">
                        {formatAmount(item.amount, item.currency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
