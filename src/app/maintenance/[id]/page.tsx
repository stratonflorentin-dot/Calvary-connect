'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Edit, Trash2, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useCurrency } from '@/hooks/use-currency';

interface MaintenanceRecord {
    id: string;
    record_number: string;
    vehicle_id: string | null;
    trip_id: string | null;
    title: string;
    description: string | null;
    type: string;
    priority: string;
    status: string;
    scheduled_date: string | null;
    completed_date: string | null;
    technician: string | null;
    workshop: string | null;
    estimated_cost: number | null;
    actual_cost: number | null;
    currency: string;
    notes: string | null;
    created_at: string;
    vehicles?: {
        id: string;
        plate_number: string;
        make: string;
        model: string;
    };
}

export default function MaintenanceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClientComponentClient();
    const { format } = useCurrency();
    const [record, setRecord] = useState<MaintenanceRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [completionData, setCompletionData] = useState({
        actual_cost: '',
        completed_date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    useEffect(() => {
        const fetchRecord = async () => {
            try {
                const { data, error: fetchError } = await supabase
                    .from('maintenance_records')
                    .select(`
            *,
            vehicles:vehicle_id(id, plate_number, make, model)
          `)
                    .eq('id', params.id)
                    .single();

                if (fetchError) throw fetchError;
                setRecord(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load record');
            } finally {
                setLoading(false);
            }
        };

        if (params.id) fetchRecord();
    }, [params.id, supabase]);

    const handleStatusChange = async (newStatus: string) => {
        if (!record) return;

        try {
            const updateData: any = { status: newStatus };

            if (newStatus === 'completed' && showCompleteModal) {
                updateData.actual_cost = completionData.actual_cost ? parseFloat(completionData.actual_cost) : null;
                updateData.completed_date = completionData.completed_date;
                updateData.notes = completionData.notes || null;
                setShowCompleteModal(false);
            }

            const { error: updateError } = await supabase
                .from('maintenance_records')
                .update(updateData)
                .eq('id', record.id);

            if (updateError) throw updateError;

            setRecord({ ...record, ...updateData });
            (window as any).toast?.success('Status updated', 'Success', 5000);
        } catch (err) {
            (window as any).toast?.error(err instanceof Error ? err.message : 'Failed to update', 'Error', 5000);
        }
    };

    if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
    if (error || !record) return <div className="text-center py-8 text-red-600">{error || 'Record not found'}</div>;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'requested': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30';
            case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30';
            case 'in_progress': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30';
            case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30';
            case 'postponed': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30';
            case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30';
            case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30';
            case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const statusActions = {
        requested: { button: 'Schedule', newStatus: 'scheduled', color: 'blue' },
        scheduled: { button: 'Start Work', newStatus: 'in_progress', color: 'amber' },
        in_progress: { button: 'Mark Complete', newStatus: 'completed', color: 'green' },
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/maintenance">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold">{record.title}</h1>
                        <Badge className={getStatusColor(record.status)}>{record.status.replace('_', ' ')}</Badge>
                        <Badge className={getPriorityColor(record.priority)}>{record.priority}</Badge>
                    </div>
                    <p className="text-muted-foreground font-mono text-sm">{record.record_number}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Details */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wrench className="w-5 h-5" />
                            Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {record.description && (
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
                                <p className="text-sm mt-2">{record.description}</p>
                            </div>
                        )}

                        {record.vehicles && (
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Vehicle</Label>
                                <Link href={`/vehicles/${record.vehicle_id}`} className="text-sm text-primary hover:underline block mt-2">
                                    <div className="font-mono font-bold">{record.vehicles.plate_number}</div>
                                    <div className="text-muted-foreground">{record.vehicles.make} {record.vehicles.model}</div>
                                </Link>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Type</Label>
                                <p className="text-sm mt-2 capitalize">{record.type}</p>
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Priority</Label>
                                <p className="text-sm mt-2 capitalize">{record.priority}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Scheduled Date</Label>
                                <p className="text-sm mt-2">
                                    {record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : 'Not set'}
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Technician</Label>
                                <p className="text-sm mt-2">{record.technician || 'Not assigned'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Workshop</Label>
                                <p className="text-sm mt-2">{record.workshop || 'Not specified'}</p>
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Estimated Cost</Label>
                                <p className="text-sm mt-2 font-mono">
                                    {record.estimated_cost ? format(record.estimated_cost) : 'Not set'}
                                </p>
                            </div>
                        </div>

                        {record.actual_cost && (
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Actual Cost</Label>
                                <p className="text-sm mt-2 font-mono">{format(record.actual_cost)}</p>
                            </div>
                        )}

                        {record.notes && (
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Notes</Label>
                                <p className="text-sm mt-2">{record.notes}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Status & Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Status & Actions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground">Current Status</Label>
                            <div className="text-sm mt-2">
                                <Badge className={`${getStatusColor(record.status)} w-full text-center py-2`}>
                                    {record.status.replace('_', ' ')}
                                </Badge>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {record.status === 'requested' && (
                                <>
                                    <Button
                                        onClick={() => handleStatusChange('scheduled')}
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                    >
                                        Schedule
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleStatusChange('cancelled')}
                                        className="w-full"
                                    >
                                        Reject
                                    </Button>
                                </>
                            )}

                            {record.status === 'scheduled' && (
                                <Button
                                    onClick={() => handleStatusChange('in_progress')}
                                    className="w-full bg-amber-600 hover:bg-amber-700"
                                >
                                    Start Work
                                </Button>
                            )}

                            {record.status === 'in_progress' && (
                                <>
                                    <Button
                                        onClick={() => setShowCompleteModal(true)}
                                        className="w-full bg-green-600 hover:bg-green-700"
                                    >
                                        Mark Complete
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleStatusChange('postponed')}
                                        className="w-full"
                                    >
                                        Postpone
                                    </Button>
                                </>
                            )}

                            {record.status === 'completed' && (
                                <Badge className="w-full text-center py-2 bg-green-100 text-green-800 dark:bg-green-900/30 justify-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Completed
                                </Badge>
                            )}
                        </div>

                        <div className="text-xs text-muted-foreground pt-4 border-t">
                            <p>Created: {new Date(record.created_at).toLocaleDateString()}</p>
                            {record.completed_date && (
                                <p>Completed: {new Date(record.completed_date).toLocaleDateString()}</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Complete Modal */}
            <AlertDialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Complete Maintenance Record</AlertDialogTitle>
                        <AlertDialogDescription>
                            Record final details for this maintenance task
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="actual_cost">Actual Cost (TZS)</Label>
                            <Input
                                id="actual_cost"
                                type="number"
                                step="0.01"
                                value={completionData.actual_cost}
                                onChange={(e) => setCompletionData({ ...completionData, actual_cost: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <Label htmlFor="completed_date">Completion Date</Label>
                            <Input
                                id="completed_date"
                                type="date"
                                value={completionData.completed_date}
                                onChange={(e) => setCompletionData({ ...completionData, completed_date: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label htmlFor="completion_notes">Completion Notes</Label>
                            <Textarea
                                id="completion_notes"
                                value={completionData.notes}
                                onChange={(e) => setCompletionData({ ...completionData, notes: e.target.value })}
                                placeholder="Summary of work completed"
                                className="min-h-20"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleStatusChange('completed')}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Complete
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
