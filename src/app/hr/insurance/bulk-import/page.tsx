'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Download, Upload } from 'lucide-react';
import Papa from 'papaparse';

interface BulkImportResult {
    success: number;
    failed: number;
    errors: string[];
}

export default function BulkImportPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<BulkImportResult | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);

    const downloadTemplate = () => {
        const template = `vehicle_id,insurer_name,policy_type,tira_reference_number,start_date,expiry_date,annual_premium,assigned_driver_id,route_coverage_area,is_cross_border,has_comesa_yellow_card,notes
00000000-0000-0000-0000-000000000001,Jubilee Insurance,third_party,TZ/2024/123456,2024-01-01,2025-01-01,500000,,East Africa,false,false,Initial policy
00000000-0000-0000-0000-000000000002,Alliance Insurance,third_party_cargo,TZ/2024/123457,2024-01-15,2025-01-15,750000,,Regional,false,false,
00000000-0000-0000-0000-000000000003,NIC Tanzania,cross_border,TZ/2024/123458,2024-02-01,2025-02-01,1000000,,Cross-border,true,true,COMESA coverage included`;

        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'insurance_import_template.csv';
        a.click();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setPreviewData(results.data.slice(0, 5));
            },
        });
    };

    const handleUpload = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            alert('Please select a file');
            return;
        }

        setLoading(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const response = await fetch('/api/insurance/bulk-import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            records: results.data,
                            format: 'csv',
                        }),
                    });

                    const data = await response.json();
                    setResult(data);

                    if (data.success > 0) {
                        setTimeout(() => router.push('/hr/insurance'), 2000);
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    alert('Failed to upload file');
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/hr/insurance">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">Bulk Import Insurance Policies</h1>
                    <p className="text-gray-600">Upload CSV to add multiple insurance records at once</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Instructions */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Import Instructions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-sm mb-2">Steps:</h3>
                            <ol className="space-y-2 text-sm text-gray-700">
                                <li>1. Download the template CSV file</li>
                                <li>2. Fill in your insurance data following the column format</li>
                                <li>3. Use the correct policy types and dates (YYYY-MM-DD)</li>
                                <li>4. Upload the completed file</li>
                                <li>5. Review the import results</li>
                            </ol>
                        </div>

                        <div>
                            <h3 className="font-semibold text-sm mb-2">Required Columns:</h3>
                            <ul className="space-y-1 text-sm text-gray-700">
                                <li>• <code className="bg-gray-100 px-2 py-1 rounded">vehicle_id</code> - UUID of vehicle</li>
                                <li>• <code className="bg-gray-100 px-2 py-1 rounded">insurer_name</code> - Insurance company</li>
                                <li>• <code className="bg-gray-100 px-2 py-1 rounded">policy_type</code> - third_party | third_party_cargo | comprehensive | cross_border</li>
                                <li>• <code className="bg-gray-100 px-2 py-1 rounded">tira_reference_number</code> - TIRA policy number</li>
                                <li>• <code className="bg-gray-100 px-2 py-1 rounded">start_date</code> - YYYY-MM-DD</li>
                                <li>• <code className="bg-gray-100 px-2 py-1 rounded">expiry_date</code> - YYYY-MM-DD</li>
                                <li>• <code className="bg-gray-100 px-2 py-1 rounded">annual_premium</code> - Amount in TZS</li>
                            </ul>
                        </div>

                        <Button onClick={downloadTemplate} variant="outline" className="w-full gap-2">
                            <Download className="w-4 h-4" />
                            Download Template
                        </Button>
                    </CardContent>
                </Card>

                {/* Upload Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upload File</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50">
                            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.json"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full"
                            >
                                Select CSV File
                            </Button>
                            <p className="text-xs text-gray-500 mt-2">CSV or JSON file</p>
                        </div>

                        <Button
                            onClick={handleUpload}
                            disabled={loading || !fileInputRef.current?.files?.length}
                            className="w-full"
                        >
                            {loading ? 'Uploading...' : 'Upload File'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Preview */}
            {previewData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Preview (First 5 rows)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className="text-left py-2 font-semibold">Vehicle ID</th>
                                        <th className="text-left py-2 font-semibold">Insurer</th>
                                        <th className="text-left py-2 font-semibold">Policy Type</th>
                                        <th className="text-left py-2 font-semibold">Expiry Date</th>
                                        <th className="text-left py-2 font-semibold">Premium</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="border-b">
                                            <td className="py-2 text-xs">{row.vehicle_id?.substring(0, 8)}...</td>
                                            <td className="py-2">{row.insurer_name}</td>
                                            <td className="py-2">
                                                <Badge variant="outline">{row.policy_type}</Badge>
                                            </td>
                                            <td className="py-2">{row.expiry_date}</td>
                                            <td className="py-2">TZS {parseInt(row.annual_premium || 0).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Results */}
            {result && (
                <Card className={result.failed === 0 ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
                    <CardHeader>
                        <CardTitle className={result.failed === 0 ? 'text-green-900' : 'text-orange-900'}>
                            Import Complete
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-600">{result.success}</div>
                                <p className="text-sm text-gray-700">Successfully imported</p>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-red-600">{result.failed}</div>
                                <p className="text-sm text-gray-700">Failed records</p>
                            </div>
                        </div>

                        {result.errors.length > 0 && (
                            <div className="bg-white rounded p-3 max-h-48 overflow-y-auto">
                                <p className="text-sm font-semibold mb-2">Errors:</p>
                                <ul className="space-y-1 text-xs text-red-700">
                                    {result.errors.slice(0, 10).map((error, idx) => (
                                        <li key={idx}>• {error}</li>
                                    ))}
                                    {result.errors.length > 10 && (
                                        <li>... and {result.errors.length - 10} more errors</li>
                                    )}
                                </ul>
                            </div>
                        )}

                        {result.success > 0 && (
                            <p className="text-sm text-green-700">
                                ✓ Redirecting to insurance dashboard in 2 seconds...
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
