"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell, PageHeader, SectionCard, EmptyState, PageSkeleton } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { Download, FileSpreadsheet, FileText, RefreshCw, ShieldAlert, Wallet } from "lucide-react";

const agencies = [
  { key: "paye", label: "TRA / PAYE" },
  { key: "nssf", label: "NSSF" },
  { key: "nhif", label: "NHIF" },
  { key: "sdl", label: "SDL" },
  { key: "wcf", label: "WCF" },
];

const humanLabels: Record<string, string> = {
  paye: "PAYE",
  nssf: "NSSF",
  nhif: "NHIF",
  sdl: "SDL",
  wcf: "WCF",
};

const formatAmount = (value: number) =>
  `TZS ${value.toLocaleString("en-TZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const escapeCsvValue = (value: string | number | undefined) => {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildCsv = (rows: any[]) => {
  const header = ["Employee Name", "ID / NIDA", "Gross Pay", "Deduction", "Employer Contribution"];
  const lines = [header.join(",")];
  rows.forEach((row) => {
    lines.push(
      [
        escapeCsvValue(row.employee_name),
        escapeCsvValue(row.employee_id_no),
        escapeCsvValue(formatAmount(row.gross_pay)),
        escapeCsvValue(formatAmount(row.deduction)),
        escapeCsvValue(formatAmount(row.employer_contribution)),
      ].join(","),
    );
  });
  return lines.join("\n");
};

const buildExcelHtml = (rows: any[], period: string, agencyLabel: string) => {
  const rowsHtml = rows
    .map(
      (row) => `
    <tr>
      <td>${row.employee_name}</td>
      <td>${row.employee_id_no}</td>
      <td>${formatAmount(row.gross_pay)}</td>
      <td>${formatAmount(row.deduction)}</td>
      <td>${formatAmount(row.employer_contribution)}</td>
    </tr>
  `,
    )
    .join("");

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
  const anchor = document.createElement("a");
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
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [summaries, setSummaries] = useState<Record<string, { total: number; status: string }>>({});
  const [details, setDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    if (!user || !role) return;
    loadData("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const loadData = async (period: string) => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/hr/payroll/statutory", window.location.origin);
      if (period) url.searchParams.set("period", period);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Failed to load statutory payroll data");
      const json = await response.json();
      const nextPeriod = json.selectedPeriod || json.payrollRuns?.[0] || "";
      setPayrollRuns(json.payrollRuns || []);
      setSelectedPeriod(nextPeriod);
      setSummaries(json.summaries || {});
      setDetails(json.details || []);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Load Failed", description: error.message || "Unable to fetch statutory payroll data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = async (value: string) => {
    setSelectedPeriod(value);
    await loadData(value);
  };

  const downloadCsv = (agencyKey: string) => {
    if (!selectedPeriod) return;
    const csv = buildCsv(details);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `statutory_${agencyKey}_${selectedPeriod}.csv`);
  };

  const downloadExcel = (agencyKey: string) => {
    if (!selectedPeriod) return;
    const html = buildExcelHtml(details, selectedPeriod, humanLabels[agencyKey] || agencyKey.toUpperCase());
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    downloadBlob(blob, `statutory_${agencyKey}_${selectedPeriod}.xls`);
  };

  const downloadPdf = async (agencyKey: string) => {
    if (!selectedPeriod) return;
    setExportBusy(true);
    try {
      const url = new URL("/api/admin/hr/payroll/statutory/export/pdf", window.location.origin);
      url.searchParams.set("period", selectedPeriod);
      url.searchParams.set("agency", agencyKey);
      window.open(url.toString(), "_blank");
    } catch (error: any) {
      toast({ title: "Export Failed", description: error.message || "Could not export PDF.", variant: "destructive" });
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
        const csv = buildCsv(details);
        zip.file(`${agency.key}_${selectedPeriod}.csv`, csv);
      });
      const content = await zip.generateAsync({ type: "blob" });
      downloadBlob(content, `statutory_returns_${selectedPeriod}.zip`);
      toast({ title: "Returns Generated", description: "All statutory returns are compiled into a ZIP file." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Generation Failed", description: error.message || "Could not generate returns.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const chartData = useMemo(
    () =>
      agencies.map((agency) => ({
        name: humanLabels[agency.key] || agency.label,
        amount: summaries[agency.key]?.total || 0,
      })),
    [summaries],
  );

  const statusChip = (status?: string) =>
    status === "Filed" ? "cv-chip-success" : status === "Submitted" ? "cv-chip-info" : "cv-chip-warning";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Human Resources"
        title="Workers payroll & statutory"
        subtitle="PAYE, NSSF, NHIF, SDL and WCF returns per approved payroll run"
        icon={Wallet}
        crumbs={[{ label: "HR", href: "/hr" }, { label: "Payroll & statutory" }]}
        actions={
          <>
            <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder={loading ? "Loading runs…" : "Select payroll run"} />
              </SelectTrigger>
              <SelectContent>
                {payrollRuns.length > 0 ? (
                  payrollRuns.map((period) => (
                    <SelectItem value={period} key={period}>
                      {period}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-payroll" disabled>
                    No approved payroll runs
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={generateReturns}
              disabled={!selectedPeriod || isGenerating || !details.length}
              className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isGenerating && "animate-spin")} />
              {isGenerating ? "Compiling…" : "Generate returns"}
            </Button>
          </>
        }
      />

      {loading ? (
        <PageSkeleton kpiCount={5} />
      ) : payrollRuns.length === 0 ? (
        <SectionCard title="No payroll runs yet">
          <EmptyState
            icon={ShieldAlert}
            title="No approved payroll runs found"
            description="Approve payroll entries in Payroll Management first, then return here to generate statutory returns."
            action={
              <Link href="/allowances">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Open Payroll Management</Button>
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {agencies.map((agency) => (
              <div key={agency.key} className="cv-kpi">
                <div className="flex items-center justify-between gap-2">
                  <span className="cv-kpi-label">{agency.label}</span>
                  <span className={cn("cv-chip", statusChip(summaries[agency.key]?.status))}>
                    {summaries[agency.key]?.status || "Pending"}
                  </span>
                </div>
                <p className="cv-kpi-value mt-2 text-lg">{formatAmount(summaries[agency.key]?.total || 0)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-6 items-start">
            <SectionCard
              title={`Employee breakdown (${details.length})`}
              subtitle="Gross pay, statutory deductions and employer contributions"
              padded={false}
              actions={
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => downloadCsv("paye")} disabled={!details.length || exportBusy}>
                    <FileText className="w-3.5 h-3.5" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => downloadExcel("paye")} disabled={!details.length || exportBusy}>
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => downloadPdf("paye")} disabled={!details.length || exportBusy}>
                    <Download className="w-3.5 h-3.5" /> PDF
                  </Button>
                </div>
              }
            >
              <div className="overflow-x-auto">
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
                    {details.length > 0 ? (
                      details.map((row) => (
                        <TableRow key={`${row.employee_id}-${row.employee_name}`}>
                          <TableCell className="font-medium">{row.employee_name}</TableCell>
                          <TableCell className="text-muted-foreground">{row.employee_id_no || "N/A"}</TableCell>
                          <TableCell className="font-mono text-xs">{formatAmount(row.gross_pay)}</TableCell>
                          <TableCell className="font-mono text-xs">{formatAmount(row.deduction)}</TableCell>
                          <TableCell className="font-mono text-xs">{formatAmount(row.employer_contribution)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                          No payroll data available for the selected period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>

            <SectionCard title="Payroll summary" subtitle="Totals across statutory agencies">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => (value >= 1000 ? `${Math.round(value / 1000)}k` : value)} />
                    <Tooltip formatter={(value: number) => formatAmount(value)} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {agencies.map((agency) => (
                  <div key={agency.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-bold text-foreground">{agency.label}</p>
                      <p className="text-xs text-muted-foreground">{summaries[agency.key]?.status || "Pending"}</p>
                    </div>
                    <p className="text-sm font-black text-foreground font-mono">{formatAmount(summaries[agency.key]?.total || 0)}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </PageShell>
  );
}
