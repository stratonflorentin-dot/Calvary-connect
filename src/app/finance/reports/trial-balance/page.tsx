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
import { Calendar, Download, RefreshCw, Scale, CheckCircle, AlertTriangle } from "lucide-react";
import { formatDate, formatAmount } from "@/lib/utils";

const supabase = createClient();

const CURRENCIES = {
  TZS: { code: "TZS", symbol: "TSh", flag: "🇹🇿" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸" },
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺" },
};

export default function TrialBalancePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCurrency, setSelectedCurrency] = useState("TZS");

  const loadTrialBalanceData = async () => {
    setLoading(true);
    try {
      const [entriesData, accountsData] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("*, journal_entry_lines(*)")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }),
        supabase.from("chart_of_accounts").select("*"),
      ]);
      if (entriesData.error) throw entriesData.error;
      if (accountsData.error) throw accountsData.error;
      setJournalEntries(entriesData.data || []);
      setChartOfAccounts(accountsData.data || []);
    } catch (err) {
      console.error("Error loading trial balance data:", err);
      toast({ title: "Error", description: "Failed to load trial balance data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrialBalanceData();
  }, [startDate, endDate]);

  const getAccountName = (accountCode: string) => {
    const account = chartOfAccounts.find((acc) => acc.code === accountCode);
    return account ? account.name : accountCode;
  };

  const getAccountType = (accountCode: string) => {
    const account = chartOfAccounts.find((acc) => acc.code === accountCode);
    return account ? account.type : "Unknown";
  };

  const flattenJournalLines = () => {
    const lines: any[] = [];
    journalEntries.forEach((entry) => {
      if (entry.journal_entry_lines && Array.isArray(entry.journal_entry_lines)) {
        entry.journal_entry_lines.forEach((line: any) => {
          lines.push({
            ...line,
            entry_date: entry.date,
          });
        });
      }
    });
    return lines;
  };

  const allLines = flattenJournalLines();

  // Calculate account balances for trial balance
  const accountBalances = allLines.reduce((acc, line) => {
    if (!acc[line.account_code]) {
      acc[line.account_code] = { debit: 0, credit: 0 };
    }
    acc[line.account_code].debit += line.debit || 0;
    acc[line.account_code].credit += line.credit || 0;
    return acc;
  }, {} as Record<string, { debit: number; credit: number }>);

  // Calculate trial balance totals
  const totalDebits = Object.values(accountBalances).reduce((sum, bal) => sum + bal.debit, 0);
  const totalCredits = Object.values(accountBalances).reduce((sum, bal) => sum + bal.credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const exportReport = () => {
    const reportData = {
      reportType: "Trial Balance",
      period: { startDate, endDate },
      currency: selectedCurrency,
      accountBalances,
      totalDebits,
      totalCredits,
      isBalanced,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${startDate}-to-${endDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Trial balance exported successfully" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trial Balance</h1>
          <p className="text-muted-foreground">Verify that debits equal credits across all accounts</p>
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
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
              <span className="text-muted-foreground">to</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
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
            <Button variant="outline" size="sm" onClick={loadTrialBalanceData}>
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Debits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatAmount(totalDebits, selectedCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">
              {formatAmount(totalCredits, selectedCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Balance Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <>
                  <CheckCircle className="size-6 text-emerald-600" />
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">Balanced</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-6 text-red-600" />
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">Imbalanced</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="size-5" />
            Trial Balance Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Debit Balance</TableHead>
                <TableHead className="text-right">Credit Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : Object.keys(accountBalances).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No journal entries found for this period
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {Object.entries(accountBalances)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([code, balances]) => {
                      const debitBalance = balances.debit - balances.credit;
                      const creditBalance = balances.credit - balances.debit;
                      return (
                        <TableRow key={code}>
                          <TableCell className="font-mono font-semibold">{code}</TableCell>
                          <TableCell>{getAccountName(code)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{getAccountType(code)}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                            {debitBalance > 0 ? formatAmount(debitBalance, selectedCurrency) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-700 dark:text-red-400">
                            {creditBalance > 0 ? formatAmount(creditBalance, selectedCurrency) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3} className="text-right">
                      Totals
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(totalDebits, selectedCurrency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(totalCredits, selectedCurrency)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className={`border ${isBalanced ? "border-emerald-500/50" : "border-red-500/50"}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {isBalanced ? (
              <CheckCircle className="size-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-5 text-red-600" />
            )}
            Balance Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Debits</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatAmount(totalDebits, selectedCurrency)}
              </p>
            </div>
            <div className="text-4xl text-muted-foreground">=</div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Credits</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                {formatAmount(totalCredits, selectedCurrency)}
              </p>
            </div>
          </div>
          <div className="mt-6 text-center">
            {isBalanced ? (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-base px-4 py-2">
                ✓ Trial Balance is Balanced - Debits equal Credits
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-base px-4 py-2">
                ⚠ Trial Balance is Imbalanced - Difference: {formatAmount(Math.abs(totalDebits - totalCredits), selectedCurrency)}
              </Badge>
            )}
          </div>
          {!isBalanced && (
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Action Required:</strong> Review your journal entries to identify and correct the imbalance. Common causes include:
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-400 mt-2 list-disc list-inside">
                <li>Missing or duplicate journal entries</li>
                <li>Incorrect debit/credit amounts</li>
                <li>Entries not posted to the correct accounts</li>
                <li>Timing differences in entry dates</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
