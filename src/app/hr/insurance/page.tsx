'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Download, FileUp, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { InsuranceSummary, TruckInsurance } from '@/types/roles';

export default function InsuranceDashboard() {
    const [summary, setSummary] = useState<InsuranceSummary | null>(null);
    const [insurance, setInsurance] = useState<TruckInsurance[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'expiring' | 'compliance'>('overview');

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const summaryRes = await fetch('/api/insurance/summary');
            const summaryData = await summaryRes.json();
            setSummary(summaryData.data);

            if (activeTab === 'expiring') {
                const expiringRes = await fetch('/api/insurance/expiring?days=30');
                const expiringData = await expiringRes.json();
                setInsurance(expiringData.data);
            } else if (activeTab === 'overview') {
                const allRes = await fetch('/api/insurance');
                const allData = await allRes.json();
                setInsurance(allData.data);
            }
        } catch (error) {
            console.error('Error fetching insurance data:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Truck Insurance Management</h1>
                    <p className="text-gray-600 mt-2">Manage fleet insurance policies and TIRA compliance</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/hr/insurance/bulk-import">
                        <Button variant="outline" className="gap-2">
                            <FileUp className="w-4 h-4" />
                            Bulk Import
                        </Button>
                    </Link>
                    <Link href="/hr/insurance/add">
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            New Policy
                        </Button>
                    </Link>
                </div>
            </div>

            {/* KPI Cards */}
            {summary && (
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">Active Policies</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{summary.total_active_policies}</div>
                            <p className="text-xs text-gray-500 mt-1">of {summary.total_vehicles} vehicles</p>
                        </CardContent>
                    </Card>

                    <Card className="border-orange-200 bg-orange-50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-orange-900 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Expiring Soon
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-orange-600">{summary.expiring_within_30_days}</div>
                            <p className="text-xs text-orange-700 mt-1">Within 30 days</p>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200 bg-red-50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-red-900">Expired</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-red-600">{summary.expired_policies}</div>
                            <p className="text-xs text-red-700 mt-1">Requires renewal</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">Annual Premium</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">TZS {(summary.total_annual_premium / 1_000_000).toFixed(1)}M</div>
                            <p className="text-xs text-gray-500 mt-1">Total fleet cost</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Compliance Summary */}
            {summary && (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">TIRA Compliance (Tanzania)</CardTitle>
                            <CardDescription>Minimum Third Party coverage requirement</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-green-700 font-medium">✓ Compliant</span>
                                    <Badge className="bg-green-100 text-green-800">{summary.mandatory_tira_compliance.compliant}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-red-700 font-medium">✗ Non-Compliant</span>
                                    <Badge className="bg-red-100 text-red-800">{summary.mandatory_tira_compliance.non_compliant}</Badge>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                                    <div
                                        className="bg-green-600 h-2 rounded-full"
                                        style={{
                                            width: `${(summary.mandatory_tira_compliance.compliant /
                                                    (summary.mandatory_tira_compliance.compliant +
                                                        summary.mandatory_tira_compliance.non_compliant)) *
                                                100
                                                }%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Cross-Border Coverage</CardTitle>
                            <CardDescription>COMESA Yellow Card status</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-green-700 font-medium">✓ With Yellow Card</span>
                                    <Badge className="bg-green-100 text-green-800">{summary.cross_border_coverage.with_yellow_card}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-red-700 font-medium">⚠ Without Yellow Card</span>
                                    <Badge className="bg-yellow-100 text-yellow-800">{summary.cross_border_coverage.without_yellow_card}</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Insurance List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Insurance Policies</CardTitle>
                        <CardDescription>Fleet insurance coverage details</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Download className="w-4 h-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className="text-left py-3 font-semibold">Vehicle</th>
                                        <th className="text-left py-3 font-semibold">Insurer</th>
                                        <th className="text-left py-3 font-semibold">Policy Type</th>
                                        <th className="text-left py-3 font-semibold">Expiry Date</th>
                                        <th className="text-left py-3 font-semibold">Status</th>
                                        <th className="text-left py-3 font-semibold">Premium</th>
                                        <th className="text-left py-3 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {insurance.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-gray-500">
                                                No insurance records found
                                            </td>
                                        </tr>
                                    ) : (
                                        insurance.map((policy) => (
                                            <tr key={policy.id} className="border-b hover:bg-gray-50">
                                                <td className="py-3 font-medium">{policy.tira_reference_number}</td>
                                                <td className="py-3">{policy.insurer_name}</td>
                                                <td className="py-3">
                                                    <Badge variant="outline">{policy.policy_type.replace('_', ' ')}</Badge>
                                                </td>
                                                <td className="py-3">{new Date(policy.expiry_date).toLocaleDateString()}</td>
                                                <td className="py-3">
                                                    <Badge
                                                        className={
                                                            policy.status === 'active'
                                                                ? 'bg-green-100 text-green-800'
                                                                : policy.status === 'expiring_soon'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-red-100 text-red-800'
                                                        }
                                                    >
                                                        {policy.status.replace('_', ' ')}
                                                    </Badge>
                                                </td>
                                                <td className="py-3">TZS {policy.annual_premium.toLocaleString()}</td>
                                                <td className="py-3">
                                                    <Link href={`/hr/insurance/${policy.id}`}>
                                                        <Button variant="ghost" size="sm">
                                                            View
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
