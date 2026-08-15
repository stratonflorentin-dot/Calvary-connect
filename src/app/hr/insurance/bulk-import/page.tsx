'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { getListStagger, listItem, staggerContainer } from '@/lib/animations';
import { AnimatedCounter } from '@/components/ui/animated-counter';

interface BulkImportResult {
  success: number;
  failed: number;
  errors: string[];
}

type ImportRow = Record<string, string>;

function parseCsv(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const [headerLine, ...rows] = lines;
  if (!headerLine) return [];

  const headers = headerLine.split(',').map((header) => header.trim());
  return rows.map((row) => {
    const values = row.split(',').map((value) => value.trim());
    return headers.reduce<ImportRow>((record, header, index) => {
      record[header] = values[index] || '';
      return record;
    }, {});
  });
}

const template = `vehicle_id,insurer_name,policy_number,policy_type,tira_reference_number,start_date,expiry_date,annual_premium,currency,assigned_driver_id,route_coverage_area,covered_countries,is_cross_border,has_comesa_yellow_card,comesa_yellow_card_number,comesa_expiry_date,notes
00000000-0000-0000-0000-000000000001,Jubilee Insurance,POL-001,third_party,TZ/2026/123456,2026-01-01,2027-01-01,500000,TZS,,Tanzania,Tanzania,false,false,,,Initial policy
00000000-0000-0000-0000-000000000002,Alliance Insurance,POL-002,third_party_cargo,TZ/2026/123457,2026-01-15,2027-01-15,750000,TZS,,Regional,"Tanzania Kenya",false,false,,,
00000000-0000-0000-0000-000000000003,NIC Tanzania,POL-003,cross_border,TZ/2026/123458,2026-02-01,2027-02-01,1000000,TZS,,Cross-border,"Tanzania Kenya Uganda",true,true,COMESA-001,2027-02-01,COMESA coverage included`;

const REQUIRED_COLUMNS = [
  'vehicle_id',
  'insurer_name',
  'policy_type',
  'tira_reference_number',
  'start_date',
  'expiry_date',
  'annual_premium',
  'currency',
  'covered_countries',
  'is_cross_border',
  'has_comesa_yellow_card',
];

export default function BulkImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);

  const downloadTemplate = () => {
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'insurance_import_template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const text = await file.text();
    const rows = file.name.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCsv(text);
    setPreviewData(Array.isArray(rows) ? rows.slice(0, 5) : []);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({ variant: 'destructive', title: 'No file selected', description: 'Choose a CSV or JSON file first.' });
      return;
    }

    setLoading(true);

    try {
      const text = await file.text();
      const isJson = file.name.toLowerCase().endsWith('.json');
      const records = isJson ? JSON.parse(text) : parseCsv(text);

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/insurance/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          records,
          format: isJson ? 'json' : 'csv',
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success > 0) {
        toast({
          variant: 'success',
          title: 'Import complete',
          description: `${data.success} polic${data.success === 1 ? 'y' : 'ies'} imported${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
        });
        setTimeout(() => router.push('/hr/insurance'), 2000);
      } else {
        toast({ variant: 'destructive', title: 'Import failed', description: 'No policies were imported — check the errors below.' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Could not read or send that file.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Link href="/hr/insurance">
                <Button variant="outline" size="icon" aria-label="Back to insurance">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <Badge className="border-info/20 bg-info/10 text-info">Bulk Operations</Badge>
                <h1 className="mt-3 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">Import Insurance Policies</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Load multiple fleet policies from CSV or JSON and push them into the insurance command center.
                </p>
              </div>
            </div>
            <Button onClick={downloadTemplate} variant="outline" className="gap-2 h-11">
              <Download className="h-4 w-4" />
              Template
            </Button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card className="border-border shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                Required Columns
              </CardTitle>
              <CardDescription>Use the template format so vehicles, premiums, coverage, and compliance flags map correctly.</CardDescription>
            </CardHeader>
            <CardContent>
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid gap-3 text-sm text-foreground md:grid-cols-2"
              >
                {REQUIRED_COLUMNS.map((column) => (
                  <motion.div key={column} variants={listItem} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <code className="text-xs text-foreground">{column}</code>
                  </motion.div>
                ))}
              </motion.div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Upload File</CardTitle>
              <CardDescription>CSV or JSON policy import.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <input ref={fileInputRef} type="file" accept=".csv,.json" onChange={handleFileSelect} className="hidden" />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                  Select File
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">{selectedFileName || 'No file selected'}</p>
              </div>

              <Button onClick={handleUpload} disabled={loading || !selectedFileName} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {loading ? 'Uploading...' : 'Upload File'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {previewData.length > 0 && (
          <Card className="border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Preview</CardTitle>
              <CardDescription>First five rows from the selected file.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Vehicle</th>
                        <th className="px-4 py-3 text-left">Insurer</th>
                        <th className="px-4 py-3 text-left">Policy</th>
                        <th className="px-4 py-3 text-left">Expiry</th>
                        <th className="px-4 py-3 text-left">Premium</th>
                      </tr>
                    </thead>
                    <motion.tbody
                      variants={{ hidden: {}, visible: { transition: { staggerChildren: getListStagger(previewData.length) } } }}
                      initial="hidden"
                      animate="visible"
                      className="divide-y divide-border"
                    >
                      {previewData.map((row, index) => (
                        <motion.tr key={`${row.tira_reference_number}-${index}`} variants={listItem} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground">{row.vehicle_id?.substring(0, 8)}...</td>
                          <td className="px-4 py-3 text-foreground">{row.insurer_name}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{row.policy_type}</Badge>
                          </td>
                          <td className="px-4 py-3 text-foreground">{row.expiry_date}</td>
                          <td className="px-4 py-3 text-foreground">TZS {Number(row.annual_premium || 0).toLocaleString()}</td>
                        </motion.tr>
                      ))}
                    </motion.tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className={result.failed === 0 ? 'border-success/20 bg-success/5' : 'border-warning/20 bg-warning/5'}>
            <CardHeader>
              <CardTitle className={result.failed === 0 ? 'text-success' : 'text-warning'}>Import Complete</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ResultNumber label="Imported" value={result.success} tone="success" />
                <ResultNumber label="Failed" value={result.failed} tone="destructive" />
              </div>

              {result.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md bg-card border border-border p-3">
                  <p className="mb-2 text-sm font-semibold text-foreground">Errors</p>
                  <ul className="space-y-1 text-xs text-destructive">
                    {result.errors.slice(0, 10).map((error, index) => (
                      <li key={`${error}-${index}`}>- {error}</li>
                    ))}
                    {result.errors.length > 10 && <li>... and {result.errors.length - 10} more errors</li>}
                  </ul>
                </div>
              )}

              {result.success > 0 && (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Imported successfully. Redirecting to insurance dashboard.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ResultNumber({ label, value, tone }: { label: string; value: number; tone: 'success' | 'destructive' }) {
  return (
    <div className="rounded-lg bg-card border border-border p-4 text-center">
      <div className={cn('text-3xl font-semibold', tone === 'success' ? 'text-success' : 'text-destructive')}>
        <AnimatedCounter value={value} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
