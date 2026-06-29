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
import { Calendar, Download, RefreshCw, Scale, Wallet, Building2, TrendingUp } from "lucide-react";
import { formatDate, formatAmount } from "@/lib/utils";

const supabase = createClient();

const CURRENCIES = {
  TZS: { code: "TZS", symbol: "TSh", flag: "🇹🇿" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸" },
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺" },
};

export default function BalanceSheetPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [income, setIncome] = useState<any[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState("TZS");

  const loadBalanceSheetData = async () => {
    setLoading(true);
    try {
      const [bankData, invoicesData, expensesData, incomeData] = await Promise.all([
        supabase.from("bank_accounts").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("income").select("*"),
      ]);
      if (bankData.error) throw bankData.error;
      if (invoicesData.error) throw invoicesData.error;
      if (expensesData.error) throw expensesData.error;
      if (incomeData.error) throw incomeData.error;
      setBankAccounts(bankData.data || []);
      setInvoices(invoicesData.data || []);
      setExpenses(expensesData.data || []);
      setIncome(incomeData.data || []);
    } catch (err) {
      console.error("Error loading balance sheet data:", err);
      toast({ title: "Error", description: "Failed to load balance sheet data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalanceSheetData();
  }, []);

  const filteredBankAccounts = bankAccounts.filter((b) => b.currency === selectedCurrency);
  const filteredInvoices = invoices.filter((i) => i.currency === selectedCurrency && i.status !== "paid");
  const filteredExpenses = expenses.filter((e) => e.currency === selectedCurrency && e.status !== "paid");
  const filteredIncome = income.filter((i) => i.currency === selectedCurrency);

  // Assets
  const cashAndEquivalents = filteredBankAccounts.reduce((sum, b) => sum + (b.balance || 0), 0);
  const accountsReceivable = filteredInvoices
    .filter((i) => i.type === "AR")
    .reduce((sum, i) => sum + (i.amount || 0) - (i.paid_amount || 0), 0);
  const totalAssets = cashAndEquivalents + accountsReceivable;

  // Liabilities
  const accountsPayable = filteredInvoices
    .filter((i) => i.type === "AP")
    .reduce((sum, i) => sum + (i.amount || 0) - (i.paid_amount || 0), 0);
  const accruedExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalLiabilities = accountsPayable + accruedExpenses;

  // Equity
  const retainedEarnings = filteredIncome.reduce((sum, i) => sum + (i.amount || 0), 0) - 
                          filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalEquity = retainedEarnings;

  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const exportReport = () => {
    const reportData = {
      reportType: "Balance Sheet",
      asOfDate: new Date().toISOString(),
      currency: selectedCurrency,
      assets: {
        cashAndEquivalents,
        accountsReceivable,
        totalAssets,
      },
      liabilities: {
        accountsPayable,
        accruedExpenses,
        totalLiabilities,
      },
      equity: {
        retainedEarnings,
        totalEquity,
      },
      totalLiabilitiesAndEquity,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Balance sheet exported successfully" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Balance Sheet</h1>
          <p className="text-muted-foreground">Financial position at a point in time</p>
        </div>
        <Button className="gap-2" onClick={exportReport}>
          <Download className="size-4" />
          Export Report
        </Button>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-2 flex-wrap items-center">
              <Calendar className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">As of: {formatDate(new Date().toISOString())}</span>
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
            <Button variant="outline" size="sm" onClick={loadBalanceSheetData}>
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="size-4" />
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatAmount(totalAssets, selectedCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="size-4" />
              Total Liabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">
              {formatAmount(totalLiabilities, selectedCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="size-4" />
              Total Equity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {formatAmount(totalEquity, selectedCurrency)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="size-5" />
              Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Cash & Equivalents</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAmount(cashAndEquivalents, selectedCurrency)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Accounts Receivable</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAmount(accountsReceivable, selectedCurrency)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total Assets</TableCell>
                  <TableCell className="text-right">
                    {formatAmount(totalAssets, selectedCurrency)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="size-5" />
              Liabilities & Equity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Accounts Payable</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAmount(accountsPayable, selectedCurrency)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Accrued Expenses</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAmount(accruedExpenses, selectedCurrency)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-bold">Total Liabilities</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatAmount(totalLiabilities, selectedCurrency)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Retained Earnings</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAmount(retainedEarnings, selectedCurrency)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total Liabilities & Equity</TableCell>
                  <TableCell className="text-right">
                    {formatAmount(totalLiabilitiesAndEquity, selectedCurrency)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="size-5" />
            Balance Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Assets</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatAmount(totalAssets, selectedCurrency)}
              </p>
            </div>
            <div className="text-4xl text-muted-foreground">=</div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Liabilities & Equity</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {formatAmount(totalLiabilitiesAndEquity, selectedCurrency)}
              </p>
            </div>
          </div>
          {Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01 ? (
            <div className="mt-4 text-center">
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                ✓ Balanced
              </Badge>
            </div>
          ) : (
            <div className="mt-4 text-center">
              <Badge variant="destructive">
                ⚠ Imbalance: {formatAmount(Math.abs(totalAssets - totalLiabilitiesAndEquity), selectedCurrency)}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
