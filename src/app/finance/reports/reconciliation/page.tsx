"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRole } from '@/hooks/use-role';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { RefreshCcw, Download, FileText, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { ChartOfAccountsService } from '@/services/chart-of-accounts-service';
import { formatCurrency } from '@/components/ui/currency-badge';
import * as ExcelJS from 'exceljs';

export default function ReconciliationReport() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await ChartOfAccountsService.generateReconciliationReport(
        startDate || undefined,
        endDate || undefined
      );
      setReport(data);
    } catch (error) {
      console.error('Error loading reconciliation report:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reconciliation report',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFixEntries = async () => {
    try {
      setFixing(true);
      const result = await ChartOfAccountsService.fixMisclassifiedEntries();

      if (result.errors.length > 0) {
        toast({
          title: 'Partial Success',
          description: `Fixed ${result.fixed} entries, but ${result.errors.length} errors occurred`,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Success',
          description: `Fixed ${result.fixed} misclassified entries`,
          variant: 'default'
        });
      }

      // Reload the report
      await loadReport();
    } catch (error) {
      console.error('Error fixing entries:', error);
      toast({
        title: 'Error',
        description: 'Failed to fix entries',
        variant: 'destructive'
      });
    } finally {
      setFixing(false);
    }
  };

  const handleExport = () => {
    if (!report) return;
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];
    
    summarySheet.addRows([
      { metric: 'Total Expenses', value: report.totalExpenses },
      { metric: 'Total Invoices', value: report.totalInvoices },
      { metric: 'Mapped Entries', value: report.mappedExpenses + report.mappedInvoices },
      { metric: 'Unmapped Entries', value: report.unmappedItems.length },
    ]);
    
    // Style header row
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0369A1' },
    };
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    // Accounts Summary sheet
    const accountsSheet = workbook.addWorksheet('Accounts Summary');
    accountsSheet.columns = [
      { header: 'Code', key: 'code', width: 15 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Transactions', key: 'transactions', width: 15 },
      { header: 'Amount', key: 'amount', width: 18 },
      { header: 'Currency', key: 'currency', width: 12 },
    ];
    
    report.accountsSummary.forEach((acc: any) => {
      accountsSheet.addRow({
        code: acc.code,
        name: acc.name,
        category: acc.category,
        transactions: acc.transactionCount,
        amount: acc.totalAmount,
        currency: acc.currency,
      });
    });
    
    // Style header row
    accountsSheet.getRow(1).font = { bold: true };
    accountsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0369A1' },
    };
    accountsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    // Unmapped Entries sheet (if any)
    if (report.unmappedItems.length > 0) {
      const unmappedSheet = workbook.addWorksheet('Unmapped Entries');
      unmappedSheet.columns = [
        { header: 'Type', key: 'type', width: 15 },
        { header: 'ID', key: 'id', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Amount', key: 'amount', width: 18 },
        { header: 'Currency', key: 'currency', width: 12 },
      ];
      
      report.unmappedItems.forEach((item: any) => {
        unmappedSheet.addRow({
          type: item.type,
          id: item.id,
          date: item.date || item.issue_date,
          amount: item.amount ?? "",
          currency: item.currency || "TZS",
        });
      });
      
      // Style header row
      unmappedSheet.getRow(1).font = { bold: true };
      unmappedSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0369A1' },
      };
      unmappedSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }
    
    // Write file
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coa-reconciliation-${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    });
    
    toast({ title: 'Success', description: 'Reconciliation report exported' });
  };

  if (!role) return null;

  return (
    <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">COA Reconciliation Report</h1>
                <p className="text-muted-foreground">Verify expense and invoice alignment with Chart of Accounts</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={loadReport} disabled={loading}>
                  <RefreshCcw className="size-4 mr-2" />
                  Refresh
                </Button>
                {report && report.unmappedItems.length > 0 && (
                  <Button onClick={handleFixEntries} disabled={fixing} variant="default">
                    {fixing ? (
                      <>
                        <RefreshCcw className="size-4 mr-2 animate-spin" />
                        Fixing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="size-4 mr-2" />
                        Auto-Fix Entries
                      </>
                    )}
                  </Button>
                )}
                <Button variant="outline" onClick={handleExport} disabled={!report}>
                  <Download className="size-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Date Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="border border-input rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="border border-input rounded-md px-3 py-2"
                    />
                  </div>
                  <Button onClick={loadReport} variant="outline">Apply Filters</Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            {!loading && report && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{report.totalExpenses}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{report.totalInvoices}</div>
                  </CardContent>
                </Card>
                <Card className={report.unmappedItems.length > 0 ? 'border-red-300' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      Mapped Entries
                      {report.unmappedItems.length > 0 && (
                        <AlertTriangle className="size-4 text-red-500" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {report.mappedExpenses + report.mappedInvoices}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Unmapped Entries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={
                      "text-2xl font-bold " +
                      (report.unmappedItems.length > 0 ? "text-red-600" : "text-green-600")
                    }>
                      {report.unmappedItems.length}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* COA Summary */}
            {!loading && report && (
              <Card>
                <CardHeader>
                  <CardTitle>Chart of Accounts Summary</CardTitle>
                  <CardDescription>Transaction breakdown by COA account</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Transactions</TableHead>
                        <TableHead>Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.accountsSummary.map((acc: any) => (
                        <TableRow key={acc.code}>
                          <TableCell className="font-mono">{acc.code}</TableCell>
                          <TableCell>{acc.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{acc.category}</Badge>
                          </TableCell>
                          <TableCell>{acc.transactionCount}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(acc.totalAmount, acc.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Unmapped Items */}
            {!loading && report && report.unmappedItems.length > 0 && (
              <Card className="border-red-300">
                <CardHeader className="bg-red-50">
                  <CardTitle className="text-red-800 flex items-center gap-2">
                    <AlertTriangle className="size-5" />
                    Unmapped Entries
                  </CardTitle>
                  <CardDescription className="text-red-600">
                    These entries are not aligned with Chart of Accounts and need attention
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.unmappedItems.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Badge variant="outline" className={
                              item.type === 'expense' ? 'bg-orange-50' : 'bg-blue-50'
                            }>
                              {item.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{item.id}</TableCell>
                          <TableCell>{item.date || item.issue_date}</TableCell>
                          <TableCell>
                            {item.amount ? formatCurrency(item.amount, item.currency || 'TZS') : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-red-600 border-red-300">
                              Unmapped
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Success State */}
            {!loading && report && report.unmappedItems.length === 0 && (
              <Card className="border-green-300">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center py-8">
                    <CheckCircle className="size-16 text-green-500 mb-4" />
                    <h3 className="text-xl font-bold text-green-800 mb-2">Perfect Reconciliation!</h3>
                    <p className="text-green-600">
                      100% of entries are correctly mapped to the Chart of Accounts
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
    </div>
  );
}
