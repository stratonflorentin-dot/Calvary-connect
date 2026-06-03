"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Download, FileText, FileSpreadsheet, ShieldAlert } from 'lucide-react';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { toast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';

const agencies = [
    { key: 'paye', label: 'TRA / PAYE' },
    { key: 'nssf', label: 'NSSF' },
    { key: 'nhif', label: 'NHIF' },
    { key: 'sdl', label: 'SDL' },
    { key: 'wcf', label: 'WCF' },
];

const humanLabels: Record<string, string> = {
    paye: 'PAYE',
    nssf: 'NSSF',
    nhif: 'NHIF',
    sdl: 'SDL',
    wcf: 'WCF',
};

const formatAmount = (value: number) => `TZS ${value.toLocaleString('en-TZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const escapeCsvValue = (value: string | number | undefined) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

const buildCsv = (rows: any[]) => {
    const header = ['Employee Name', 'ID / NIDA', 'Gross Pay', 'Deduction', 'Employer Contribution'];
    const lines = [header.join(',')];
    rows.forEach((row) => {
        lines.push([
            escapeCsvValue(row.employee_name),
            escapeCsvValue(row.employee_id_no),
            escapeCsvValue(formatAmount(row.gross_pay)),
            escapeCsvValue(formatAmount(row.deduction)),
            escapeCsvValue(formatAmount(row.employer_contribution)),
        ].join(','));
    });
    return lines.join('\n');
};

const buildExcelHtml = (rows: any[], period: string, agencyLabel: string) => {
    const rowsHtml = rows.map((row) => `
    <tr>
      <td>${row.employee_name}</td>
      <td>${row.employee_id_no}</td>
      <td>${formatAmount(row.gross_pay)}</td>
      <td>${formatAmount(row.deduction)}</td>
      <td>${formatAmount(row.employer_contribution)}</td>
    </tr>
  `).join('');

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Statutory Report - ${agencyLabel}</title>
  </head>
  <body>
    <h1>Statutory Report - ${agencyLabel}</h1>
    <p>Payroll period: ${period}</p>
    <table border="1" cellpadding="4" cellspacing="0">
      <thead>
        <tr>
          <th>Employee Name</th>
          <th>ID / NIDA</th>
          <th>Gross Pay</th>
          <th>Deduction</th>
          <th>Employer Contribution</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
</html>`;
};

const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

export default function StatutoryReportsPage() {
    const { user } = useSupabase();
    const { role } = useRole();
    const [payrollRuns, setPayrollRuns] = useState<string[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [summaries, setSummaries] = useState<Record<string, { total: number; status: string }>>({});
    const [details, setDetails] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [exportBusy, setExportBusy] = useState(false);

    useEffect(() => {
        if (!user || !role) return;
        loadData('');
    }, [user, role]);

    const loadData = async (period: string) => {
        setLoading(true);
        try {
            const url = new URL('/api/admin/hr/payroll/statutory', window.location.origin);
            if (period) url.searchParams.set('period', period);
            const response = await fetch(url.toString());
            if (!response.ok) throw new Error('Failed to load statutory payroll data');
            const json = await response.json();
            setPayrollRuns(json.payrollRuns || []);
            setSelectedPeriod(json.selectedPeriod || json.payrollRuns?.[0] || '');
            setSummaries(json.summaries || {});
            setDetails(json.details || []);
        } catch (error: any) {
            console.error(error);
            toast({ title: 'Load Failed', description: error.message || 'Unable to fetch statutory payroll data.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handlePeriodChange = async (value: string) => {
        setSelectedPeriod(value);
        await loadData(value);
    };

    const buildRows = (agencyKey: string) => {
        return details.map((row) => ({
            ...row,
            deduction: row.deduction,
            employer_contribution: row.employer_contribution,
        }));
    };

    const downloadCsv = (agencyKey: string) => {
        if (!selectedPeriod) return;
        const rows = buildRows(agencyKey);
        const csv = buildCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `statutory_${agencyKey}_${selectedPeriod}.csv`);
    };

    const downloadExcel = (agencyKey: string) => {
        if (!selectedPeriod) return;
        const rows = buildRows(agencyKey);
        const html = buildExcelHtml(rows, selectedPeriod, humanLabels[agencyKey] || agencyKey.toUpperCase());
        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        downloadBlob(blob, `statutory_${agencyKey}_${selectedPeriod}.xls`);
    };

    const downloadPdf = async (agencyKey: string) => {
        if (!selectedPeriod) return;
        setExportBusy(true);
        try {
            const url = new URL('/api/admin/hr/payroll/statutory/export/pdf', window.location.origin);
            url.searchParams.set('period', selectedPeriod);
            url.searchParams.set('agency', agencyKey);
            window.open(url.toString(), '_blank');
        } catch (error: any) {
            toast({ title: 'Export Failed', description: error.message || 'Could not export PDF.', variant: 'destructive' });
        } finally {
            setExportBusy(false);
        }
    };

    const generateReturns = async () => {
        if (!selectedPeriod) return;
        setIsGenerating(true);
        try {
            const zip = new JSZip();
            agencies.forEach((agency) => {
                const rows = buildRows(agency.key);
                const csv = buildCsv(rows);
                zip.file(`${agency.key}_${selectedPeriod}.csv`, csv);
            });
            const content = await zip.generateAsync({ type: 'blob' });
            downloadBlob(content, `statutory_returns_${selectedPeriod}.zip`);
            toast({ title: 'Returns Generated', description: 'All statutory returns are compiled into a ZIP file.' });
        } catch (error: any) {
            console.error(error);
            toast({ title: 'Generation Failed', description: error.message || 'Could not generate returns.', variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };

    const chartData = useMemo(() => {
        return agencies.map((agency) => ({
            name: humanLabels[agency.key] || agency.label,
            amount: summaries[agency.key]?.total || 0,
        }));
    }, [summaries]);

    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans">
            <Sidebar role={role || 'DRIVER'} />
            <main className="flex-1 md:ml-60 p-6 md:p-8 overflow-auto">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="space-y-3">
                        <h1 className="text-2xl font-bold text-gray-900">HR Statutory Reports</h1>
                        <p className="text-sm text-gray-500">Generate payroll returns for TRA/PAYE, NSSF, NHIF, SDL and WCF for your approved payroll periods.</p>
                    </div>

                    <Card className="border border-slate-200 shadow-sm">
                        <CardContent className="space-y-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-gray-600">Payroll run</p>
                                    <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                                        <SelectTrigger className="w-full md:w-72">
                                            <SelectValue placeholder={loading ? 'Loading payroll runs...' : 'Select approved payroll run'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {payrollRuns.length > 0 ? payrollRuns.map((period) => (
                                                <SelectItem value={period} key={period}>{period}</SelectItem>
                                            )) : (
                                                <SelectItem value="" disabled>No approved payroll runs</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <Button onClick={generateReturns} disabled={!selectedPeriod || isGenerating || !details.length} className="bg-sky-700 text-white hover:bg-sky-800">
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        {isGenerating ? 'Compiling...' : 'Generate Returns'}
                                    </Button>
                                    <Button onClick={() => downloadCsv('paye')} disabled={!selectedPeriod || exportBusy || !details.length} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                                        <FileText className="w-4 h-4 mr-2" />Export CSV
                                    </Button>
                                    <Button onClick={() => downloadExcel('paye')} disabled={!selectedPeriod || exportBusy || !details.length} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                                        <FileSpreadsheet className="w-4 h-4 mr-2" />Export Excel
                                    </Button>
                                    <Button onClick={() => downloadPdf('paye')} disabled={!selectedPeriod || exportBusy || !details.length} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                                        <Download className="w-4 h-4 mr-2" />Export PDF
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {agencies.map((agency) => (
                                    <Card key={agency.key} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                                        <CardHeader className="space-y-2 px-4 py-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-600">{agency.label}</p>
                                                    <p className="text-2xl font-semibold text-gray-900 mt-2">{formatAmount(summaries[agency.key]?.total || 0)}</p>
                                                </div>
                                                <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs font-semibold uppercase">
                                                    {summaries[agency.key]?.status || 'Pending'}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-gray-500">Total amount due for {agency.label}</p>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {payrollRuns.length === 0 ? (
                        <Card className="border border-yellow-200 bg-yellow-50 text-yellow-900 shadow-sm">
                            <CardContent className="flex flex-col gap-3">
                                <div className="flex items-start gap-3">
                                    <ShieldAlert className="w-6 h-6 text-yellow-600" />
                                    <div>
                                        <CardTitle className="text-lg text-yellow-900">No approved payroll runs found</CardTitle>
                                        <CardDescription className="text-sm text-yellow-800">Please approve payroll entries in the Payroll page first, then return here to generate statutory returns.</CardDescription>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Button asChild>
                                        <a href="/allowances" className="bg-sky-700 text-white hover:bg-sky-800">Open Payroll Management</a>
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <a href="/admin/hr/payroll/statutory" className="text-slate-700 hover:bg-slate-100">Refresh</a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-6">
                            <Card className="border border-slate-200 bg-white shadow-sm">
                                <CardHeader className="px-4 py-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-lg">Employee Breakdown</CardTitle>
                                            <CardDescription>Gross pay, statutory deductions, and employer contributions by employee.</CardDescription>
                                        </div>
                                        <Badge className="text-xs uppercase">{details.length} records</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-0 py-0 overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Employee</TableHead>
                                                <TableHead>ID / NIDA</TableHead>
                                                <TableHead>Gross Pay</TableHead>
                                                <TableHead>Deduction</TableHead>
                                                <TableHead>Employer Contribution</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.length > 0 ? details.map((row) => (
                                                <TableRow key={`${row.employee_id}-${row.employee_name}`}>
                                                    <TableCell>{row.employee_name}</TableCell>
                                                    <TableCell>{row.employee_id_no || 'N/A'}</TableCell>
                                                    <TableCell>{formatAmount(row.gross_pay)}</TableCell>
                                                    <TableCell>{formatAmount(row.deduction)}</TableCell>
                                                    <TableCell>{formatAmount(row.employer_contribution)}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-sm text-gray-500">No payroll data available for the selected period.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            <Card className="border border-slate-200 bg-white shadow-sm">
                                <CardHeader className="px-4 py-4">
                                    <CardTitle className="text-lg">Payroll Summary</CardTitle>
                                    <CardDescription>Visual totals across statutory agencies.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                                <YAxis tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : value} />
                                                <Tooltip formatter={(value: number) => formatAmount(value)} />
                                                <Bar dataKey="amount" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-5 space-y-3">
                                        {agencies.map((agency) => (
                                            <div key={agency.key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700">{agency.label}</p>
                                                    <p className="text-xs text-gray-500">{summaries[agency.key]?.status || 'Pending status'}</p>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-900">{formatAmount(summaries[agency.key]?.total || 0)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </main>
            <BottomTabs role={role || 'DRIVER'} />
        </div>
    );
}
