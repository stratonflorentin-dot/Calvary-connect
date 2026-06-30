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
import { Calendar, Download, RefreshCw, Scale, Wallet, Building2, TrendingUp } from "lucide-react";
import { formatDate, formatAmount } from "@/lib/utils";
import { CurrencyBadge, formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";

export default function BalanceSheetPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [income, setIncome] = useState<any[]>([]);

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

  // Group balance sheet data by currency
  const balanceSheetByCurrency = useMemo(() => {
    const currencyMap = new Map<string, {
      cashAndEquivalents: number;
      accountsReceivable: number;
      totalAssets: number;
      accountsPayable: number;
      accruedExpenses: number;
      totalLiabilities: number;
      retainedEarnings: number;
      totalEquity: number;
      totalLiabilitiesAndEquity: number;
      bankAccounts: any[];
      invoices: any[];
      expenses: any[];
      income: any[];
    }>();

    AVAILABLE_CURRENCIES.forEach(curr => {
      const currencyBankAccounts = bankAccounts.filter((b) => b.currency === curr.code);
      const currencyInvoices = invoices.filter((i) => i.currency === curr.code && i.status !== "paid");
      const currencyExpenses = expenses.filter((e) => e.currency === curr.code && e.status !== "paid");
      const currencyIncome = income.filter((i) => i.currency === curr.code);

      const cashAndEquivalents = currencyBankAccounts.reduce((sum, b) => sum + (b.balance || 0), 0);
      const accountsReceivable = currencyInvoices
        .filter((i) => i.type === "AR")
        .reduce((sum, i) => sum + (i.amount || 0) - (i.paid_amount || 0), 0);
      const totalAssets = cashAndEquivalents + accountsReceivable;

      const accountsPayable = currencyInvoices
        .filter((i) => i.type === "AP")
        .reduce((sum, i) => sum + (i.amount || 0) - (i.paid_amount || 0), 0);
      const accruedExpenses = currencyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalLiabilities = accountsPayable + accruedExpenses;

      const retainedEarnings = currencyIncome.reduce((sum, i) => sum + (i.amount || 0), 0) - 
                              currencyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalEquity = retainedEarnings;

      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

      currencyMap.set(curr.code, {
        cashAndEquivalents,
        accountsReceivable,
        totalAssets,
        accountsPayable,
        accruedExpenses,
        totalLiabilities,
        retainedEarnings,
        totalEquity,
        totalLiabilitiesAndEquity,
        bankAccounts: currencyBankAccounts,
        invoices: currencyInvoices,
        expenses: currencyExpenses,
        income: currencyIncome,
      });
    });

    return currencyMap;
  }, [bankAccounts, invoices, expenses, income]);

  const exportReport = () => {
    const reportData = {
      reportType: "Balance Sheet",
      asOfDate: new Date().toISOString(),
      balanceSheetByCurrency: Object.fromEntries(balanceSheetByCurrency),
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
            </div>
            <Button variant="outline" size="sm" onClick={loadBalanceSheetData}>
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Balance Sheets by Currency */}
      <div className="space-y-6">
        {AVAILABLE_CURRENCIES.map((currency) => {
          const data = balanceSheetByCurrency.get(currency.code);
          if (!data || data.totalAssets === 0 && data.totalLiabilities === 0 && data.totalEquity === 0) return null;

          return (
            <Card key={currency.code} className="border border-border">
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-3">
                    <Scale className="size-5" />
                    <span className="text-2xl">{currency.flag}</span>
                    <span>{currency.name}</span>
                    <CurrencyBadge currency={currency.code} />
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Wallet className="size-4" />
                        Total Assets
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(data.totalAssets, currency.code)}
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
                        {formatCurrency(data.totalLiabilities, currency.code)}
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
                        {formatCurrency(data.totalEquity, currency.code)}
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
                              {formatCurrency(data.cashAndEquivalents, currency.code)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Accounts Receivable</TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(data.accountsReceivable, currency.code)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>Total Assets</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(data.totalAssets, currency.code)}
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
                              {formatCurrency(data.accountsPayable, currency.code)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Accrued Expenses</TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(data.accruedExpenses, currency.code)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/30">
                            <TableCell className="font-bold">Total Liabilities</TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(data.totalLiabilities, currency.code)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Retained Earnings</TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(data.retainedEarnings, currency.code)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>Total Liabilities & Equity</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(data.totalLiabilitiesAndEquity, currency.code)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border border-border mt-6">
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
                          {formatCurrency(data.totalAssets, currency.code)}
                        </p>
                      </div>
                      <div className="text-4xl text-muted-foreground">=</div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Total Liabilities & Equity</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                          {formatCurrency(data.totalLiabilitiesAndEquity, currency.code)}
                        </p>
                      </div>
                    </div>
                    {Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity) < 0.01 ? (
                      <div className="mt-4 text-center">
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                          ✓ Balanced
                        </Badge>
                      </div>
                    ) : (
                      <div className="mt-4 text-center">
                        <Badge variant="destructive">
                          ⚠ Imbalance: {formatCurrency(Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity), currency.code)}
                        </Badge>
                      </div>
                    )}
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
