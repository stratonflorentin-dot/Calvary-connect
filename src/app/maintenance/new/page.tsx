'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFleetVehicles } from '@/hooks/data/use-fleet-vehicles';
import { useTrips } from '@/hooks/data/use-trips';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewMaintenancePage() {
    const router = useRouter();
    const { vehicles, loading: vehiclesLoading } = useFleetVehicles();
    const { trips, loading: tripsLoading } = useTrips();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        vehicle_id: '',
        trip_id: '',
        title: '',
        type: 'scheduled',
        priority: 'medium',
        description: '',
        scheduled_date: '',
        technician: '',
        workshop: '',
        estimated_cost: '',
        notes: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error: insertError } = await supabase
                .from('maintenance_records')
                .insert([{
                    vehicle_id: formData.vehicle_id || null,
                    trip_id: formData.trip_id || null,
                    title: formData.title,
                    type: formData.type,
                    priority: formData.priority,
                    description: formData.description || null,
                    scheduled_date: formData.scheduled_date || null,
                    technician: formData.technician || null,
                    workshop: formData.workshop || null,
                    estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
                    currency: 'TZS',
                    notes: formData.notes || null,
                    requested_by: user.id,
                    status: 'requested',
                }]);

            if (insertError) throw insertError;

            // Show toast
            (window as any).toast?.success('Maintenance record created', 'Success', 5000);
            router.push('/maintenance');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create record');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/maintenance">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold">New Maintenance Record</h1>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="vehicle_id">Vehicle</Label>
                                <Select value={formData.vehicle_id} onValueChange={(val) => setFormData({ ...formData, vehicle_id: val })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select vehicle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehicles.map((v) => (
                                            <SelectItem key={v.id} value={v.id}>
                                                {v.plate_number} - {v.make} {v.model}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="trip_id">Shipment/Trip (Optional)</Label>
                                <Select value={formData.trip_id} onValueChange={(val) => setFormData({ ...formData, trip_id: val })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select trip" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {trips.slice(0, 20).map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.origin} → {t.destination}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="title">Title *</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g., Engine Oil Change, Brake Inspection"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="preventive">Preventive</SelectItem>
                                        <SelectItem value="repair">Repair</SelectItem>
                                        <SelectItem value="breakdown">Breakdown</SelectItem>
                                        <SelectItem value="inspection">Inspection</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="priority">Priority</Label>
                                <Select value={formData.priority} onValueChange={(val) => setFormData({ ...formData, priority: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="critical">Critical</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="scheduled_date">Scheduled Date</Label>
                                <Input
                                    id="scheduled_date"
                                    type="date"
                                    value={formData.scheduled_date}
                                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Detailed description of maintenance needed"
                                className="min-h-24"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="technician">Technician</Label>
                                <Input
                                    id="technician"
                                    value={formData.technician}
                                    onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                                    placeholder="Name or ID"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="workshop">Workshop</Label>
                                <Input
                                    id="workshop"
                                    value={formData.workshop}
                                    onChange={(e) => setFormData({ ...formData, workshop: e.target.value })}
                                    placeholder="Workshop name or location"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="estimated_cost">Estimated Cost (TZS)</Label>
                                <Input
                                    id="estimated_cost"
                                    type="number"
                                    step="0.01"
                                    value={formData.estimated_cost}
                                    onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Additional Notes</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Any additional information"
                                className="min-h-20"
                            />
                        </div>

                        <div className="flex gap-4 pt-6">
                            <Button type="submit" disabled={loading || !formData.title}>
                                {loading ? 'Creating...' : 'Create Record'}
                            </Button>
                            <Link href="/maintenance">
                                <Button variant="outline">Cancel</Button>
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
