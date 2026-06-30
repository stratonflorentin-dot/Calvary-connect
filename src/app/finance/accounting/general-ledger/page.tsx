"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Calendar, Download, RefreshCw, Search, Filter } from "lucide-react";
import { formatDate, formatAmount } from "@/lib/utils";

const CURRENCIES = {
  TZS: { code: "TZS", symbol: "TSh", flag: "🇹🇿" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸" },
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺" },
};

export default function GeneralLedgerPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("ALL");
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCurrency, setSelectedCurrency] = useState("TZS");

  const loadLedgerData = async () => {
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
      console.error("Error loading ledger data:", err);
      toast({ title: "Error", description: "Failed to load ledger data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedgerData();
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
            entry_description: entry.description,
            reference_type: entry.reference_type,
            reference_id: entry.reference_id,
          });
        });
      }
    });
    return lines;
  };

  const allLines = flattenJournalLines();

  const filteredLines = allLines.filter((line) => {
    const matchesSearch = !search || 
      line.description?.toLowerCase().includes(search.toLowerCase()) ||
      line.account_code?.toLowerCase().includes(search.toLowerCase()) ||
      line.entry_description?.toLowerCase().includes(search.toLowerCase());
    const matchesAccount = filterAccount === "ALL" || line.account_code === filterAccount;
    return matchesSearch && matchesAccount;
  });

  // Calculate account balances
  const accountBalances = filteredLines.reduce((acc, line) => {
    if (!acc[line.account_code]) {
      acc[line.account_code] = { debit: 0, credit: 0 };
    }
    acc[line.account_code].debit += line.debit || 0;
    acc[line.account_code].credit += line.credit || 0;
    return acc;
  }, {} as Record<string, { debit: number; credit: number }>);

  const totalDebits = Object.values(accountBalances).reduce((sum, bal) => sum + bal.debit, 0);
  const totalCredits = Object.values(accountBalances).reduce((sum, bal) => sum + bal.credit, 0);

  const exportReport = () => {
    const reportData = {
      reportType: "General Ledger",
      period: { startDate, endDate },
      currency: selectedCurrency,
      accountBalances,
      totalDebits,
      totalCredits,
      entries: filteredLines,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `general-ledger-${startDate}-to-${endDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "General ledger exported successfully" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">General Ledger</h1>
          <p className="text-muted-foreground">Complete record of all financial transactions</p>
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9 w-64" placeholder="Search entries..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
                <span className="text-muted-foreground">to</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
              </div>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Accounts</SelectItem>
                  {chartOfAccounts.map((acc) => (
                    <SelectItem key={acc.code} value={acc.code}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={loadLedgerData}>
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
              <BookOpen className="size-4" />
              Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filteredLines.length}</p>
          </CardContent>
        </Card>
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
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg">Account Balances Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Total Debits</TableHead>
                <TableHead className="text-right">Total Credits</TableHead>
                <TableHead className="text-right">Net Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : Object.keys(accountBalances).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No ledger entries found
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(accountBalances)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([code, balances]) => {
                    const netBalance = balances.debit - balances.credit;
                    return (
                      <TableRow key={code}>
                        <TableCell className="font-mono font-semibold">{code}</TableCell>
                        <TableCell>{getAccountName(code)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getAccountType(code)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatAmount(balances.debit, selectedCurrency)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-700 dark:text-red-400">
                          {formatAmount(balances.credit, selectedCurrency)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${netBalance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                          {formatAmount(netBalance, selectedCurrency)}
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg">Journal Entry Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No journal entries match your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredLines.map((line, index) => (
                  <TableRow key={`${line.id}-${index}`}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(line.entry_date)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-mono font-semibold">{line.account_code}</span>
                        <span className="text-muted-foreground ml-2">{getAccountName(line.account_code)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{line.description || line.entry_description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {line.reference_type} #{line.reference_id}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                      {line.debit > 0 ? formatAmount(line.debit, selectedCurrency) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-700 dark:text-red-400">
                      {line.credit > 0 ? formatAmount(line.credit, selectedCurrency) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
