'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { TruckInsurance, InsuranceClaim } from '@/types/roles';

export default function InsuranceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [insurance, setInsurance] = useState<TruckInsurance | null>(null);
    const [claims, setClaims] = useState<InsuranceClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<TruckInsurance>>({});

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const fetchDetails = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/insurance/${id}`);
            const data = await res.json();
            setInsurance(data.data);
            setEditData(data.data);

            const claimsRes = await fetch(`/api/insurance/${id}/claims`);
            if (claimsRes.ok) {
                const claimsData = await claimsRes.json();
                setClaims(claimsData.data || []);
            }
        } catch (error) {
            console.error('Error fetching insurance details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const res = await fetch(`/api/insurance/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editData),
            });

            if (res.ok) {
                const data = await res.json();
                setInsurance(data.data);
                setIsEditing(false);
            }
        } catch (error) {
            console.error('Error updating insurance:', error);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this insurance policy?')) return;

        try {
            await fetch(`/api/insurance/${id}`, { method: 'DELETE' });
            router.push('/hr/insurance');
        } catch (error) {
            console.error('Error deleting insurance:', error);
        }
    };

    if (loading) return <div className="p-6">Loading...</div>;
    if (!insurance) return <div className="p-6">Insurance policy not found</div>;

    const expiryDate = new Date(insurance.expiry_date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/hr/insurance">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">{insurance.tira_reference_number}</h1>
                        <p className="text-gray-600">{insurance.insurer_name}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => setIsEditing(!isEditing)}>
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleDelete} className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Status Alert */}
            {daysUntilExpiry < 30 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-orange-900">Expiring Soon</p>
                        <p className="text-sm text-orange-800">
                            {daysUntilExpiry > 0
                                ? `This policy expires in ${daysUntilExpiry} days (${expiryDate.toLocaleDateString()})`
                                : `This policy expired on ${expiryDate.toLocaleDateString()}`}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-3">
                {/* Main Details */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Policy Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {!isEditing ? (
                            <div className="grid gap-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-sm text-gray-600">Policy Type</p>
                                        <Badge className="mt-1">{insurance.policy_type.replace('_', ' ')}</Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Status</p>
                                        <Badge
                                            className={`mt-1 ${insurance.status === 'active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : insurance.status === 'expiring_soon'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-red-100 text-red-800'
                                                }`}
                                        >
                                            {insurance.status.replace('_', ' ')}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-sm text-gray-600">Start Date</p>
                                        <p className="font-semibold">{new Date(insurance.start_date).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Expiry Date</p>
                                        <p className="font-semibold">{expiryDate.toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-600">Annual Premium</p>
                                    <p className="font-semibold text-lg">TZS {insurance.annual_premium.toLocaleString()}</p>
                                </div>

                                {insurance.route_coverage_area && (
                                    <div>
                                        <p className="text-sm text-gray-600">Coverage Area</p>
                                        <p className="font-semibold">{insurance.route_coverage_area}</p>
                                    </div>
                                )}

                                {insurance.notes && (
                                    <div>
                                        <p className="text-sm text-gray-600">Notes</p>
                                        <p className="text-gray-900">{insurance.notes}</p>
                                    </div>
                                )}

                                {insurance.is_cross_border && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="text-sm font-semibold text-blue-900 mb-2">Cross-Border Coverage</p>
                                        <div className="flex items-center gap-2 text-sm">
                                            {insurance.has_comesa_yellow_card ? (
                                                <>
                                                    <span className="text-green-600">✓</span>
                                                    <span>COMESA Yellow Card included</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-orange-600">⚠</span>
                                                    <span>Missing COMESA Yellow Card</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Edit form simplified */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Annual Premium</label>
                                    <input
                                        type="number"
                                        value={editData.annual_premium || ''}
                                        onChange={(e) =>
                                            setEditData({ ...editData, annual_premium: parseFloat(e.target.value) })
                                        }
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Coverage Area</label>
                                    <input
                                        type="text"
                                        value={editData.route_coverage_area || ''}
                                        onChange={(e) =>
                                            setEditData({ ...editData, route_coverage_area: e.target.value })
                                        }
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Notes</label>
                                    <textarea
                                        value={editData.notes || ''}
                                        onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button onClick={handleSave}>Save Changes</Button>
                                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Summary Card */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <p className="text-gray-600">Vehicle</p>
                                <p className="font-semibold">{insurance.vehicle_id}</p>
                            </div>

                            <div>
                                <p className="text-gray-600">Insurer</p>
                                <p className="font-semibold">{insurance.insurer_name}</p>
                            </div>

                            {insurance.assigned_driver_id && (
                                <div>
                                    <p className="text-gray-600">Assigned Driver</p>
                                    <p className="font-semibold">{insurance.assigned_driver_id}</p>
                                </div>
                            )}

                            <div className="bg-gray-100 rounded-lg p-3">
                                <p className="text-gray-600 text-xs mb-1">Days Until Expiry</p>
                                <p className={`text-2xl font-bold ${daysUntilExpiry > 30
                                        ? 'text-green-600'
                                        : daysUntilExpiry > 0
                                            ? 'text-orange-600'
                                            : 'text-red-600'
                                    }`}>
                                    {daysUntilExpiry}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Claims Section */}
            {claims.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Associated Claims</CardTitle>
                        <CardDescription>{claims.length} claims on record</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {claims.map((claim) => (
                                <div key={claim.id} className="border rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-semibold">{claim.claim_type}</p>
                                        <Badge
                                            className={
                                                claim.status === 'approved'
                                                    ? 'bg-green-100 text-green-800'
                                                    : claim.status === 'pending'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-red-100 text-red-800'
                                            }
                                        >
                                            {claim.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-gray-600">{claim.description}</p>
                                    <p className="text-sm font-semibold mt-2">TZS {claim.claim_amount.toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
