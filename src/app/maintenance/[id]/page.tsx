'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Edit, Trash2, Wrench, History } from 'lucide-react';
import Link from 'next/link';
import { useCurrency } from '@/hooks/use-currency';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { applyTransition } from '@/lib/workflow/engine';
import { toast } from '@/hooks/use-toast';
import { ActivityFeed } from '@/components/workflow/activity-feed';
import { TransitionButtons } from '@/components/workflow/transition-buttons';

interface MaintenancePart {
    description: string;
    quantity: number;
    unit_price: number;
    total_value: number;
}

interface MaintenanceRecord {
    id: string;
    record_number: string;
    vehicle_id: string | null;
    trailer_id: string | null;
    trip_id: string | null;
    title: string;
    description: string | null;
    type: string;
    priority: string;
    status: string;
    scheduled_date: string | null;
    completed_date: string | null;
    technician: string | null;
    technician_phone: string | null;
    technician_signature: string | null;
    workshop: string | null;
    estimated_cost: number | null;
    actual_cost: number | null;
    currency: string;
    job_card_number: string | null;
    job_card_date: string;
    odometer_reading_km: number | null;
    engine_hours: number | null;
    driver_name: string | null;
    driver_phone: string | null;
    customer_id: string | null;
    customer_company_name: string | null;
    customer_contact_person: string | null;
    customer_phone: string | null;
    inspection_findings: string | null;
    work_performed: string[];
    work_performed_other: string | null;
    parts_used: MaintenancePart[];
    driver_confirmation_name: string | null;
    driver_confirmation_signature: string | null;
    driver_confirmation_at: string | null;
    notes: string | null;
    completion_notes: string | null;
    created_at: string;
    vehicles?: {
        id: string;
        plate_number: string;
        make: string;
        model: string;
    };
    trailers?: {
        id: string;
        plate_number: string;
        make: string;
        model: string;
        trailerSubType?: string;
    };
}

export default function MaintenanceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { format } = useCurrency();
    const { role } = useRole();
    const { user } = useSupabase();
    const [record, setRecord] = useState<MaintenanceRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [completionData, setCompletionData] = useState({
        actual_cost: '',
        completed_date: new Date().toISOString().split('T')[0],
        notes: '',
        technician_signature: '',
        driver_confirmation_name: '',
        driver_confirmation_signature: '',
        driver_confirmation_at: (() => {
            const now = new Date();
            return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        })(),
    });
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');

    useEffect(() => {
        const fetchRecord = async () => {
            try {
                const { data, error: fetchError } = await supabase
                    .from('maintenance_records')
                    .select(`
            *,
            vehicles:vehicle_id(id, plate_number, make, model),
            trailers:trailer_id(id, plate_number, make, model, trailerSubType)
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

    const handleStatusChange = async (newStatus: string, payload?: Record<string, any>) => {
        if (!record) return;

        const result = await applyTransition({
            kind: 'maintenance_request',
            entityId: record.id,
            toState: newStatus,
            actorId: user?.id ?? 'system',
            actorRole: (role as any) ?? undefined,
            payload,
        });

        if (!result.ok) {
            toast({ title: 'Blocked', description: result.message, variant: 'destructive' });
            return;
        }

        setRecord({ ...record, ...(result.entity ?? {}), status: newStatus, ...(payload ?? {}) });
        toast({
            title: 'Status updated',
            description:
                result.sideEffects.length > 0
                    ? result.sideEffects.map((s) => s.replace(/_/g, ' ')).join(', ')
                    : `Moved to ${newStatus.replace('_', ' ')}.`,
        });
    };

    const completeFromModal = () => {
        const hasDriverConfirmation = Boolean(
            completionData.driver_confirmation_name.trim() || completionData.driver_confirmation_signature.trim()
        );
        if (hasDriverConfirmation && (!completionData.driver_confirmation_name.trim() || !completionData.driver_confirmation_signature.trim())) {
            toast({ title: 'Driver confirmation incomplete', description: 'Enter both the driver name and typed signature.', variant: 'destructive' });
            return;
        }

        setShowCompleteModal(false);
        handleStatusChange('completed', {
            actual_cost: completionData.actual_cost ? parseFloat(completionData.actual_cost) : null,
            completed_date: completionData.completed_date,
            completion_notes: completionData.notes || null,
            technician_signature: completionData.technician_signature.trim() || null,
            driver_confirmation_name: hasDriverConfirmation ? completionData.driver_confirmation_name.trim() : null,
            driver_confirmation_signature: hasDriverConfirmation ? completionData.driver_confirmation_signature.trim() : null,
            driver_confirmation_at: hasDriverConfirmation && completionData.driver_confirmation_at
                ? new Date(completionData.driver_confirmation_at).toISOString()
                : null,
        });
    };

    const openScheduleModal = () => {
        // Prefill with any date proposed on the request, else today.
        setScheduleDate(record?.scheduled_date?.split('T')[0] ?? new Date().toISOString().split('T')[0]);
        setShowScheduleModal(true);
    };

    const scheduleFromModal = () => {
        if (!scheduleDate) return;
        setShowScheduleModal(false);
        handleStatusChange('scheduled', { scheduled_date: scheduleDate });
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
                                <Label className="text-xs font-semibold text-muted-foreground">Truck</Label>
                                <Link href={`/vehicles/${record.vehicle_id}`} className="text-sm text-primary hover:underline block mt-2">
                                    <div className="font-mono font-bold">{record.vehicles.plate_number}</div>
                                    <div className="text-muted-foreground">{record.vehicles.make} {record.vehicles.model}</div>
                                </Link>
                            </div>
                        )}

                        {record.trailers && (
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Trailer</Label>
                                <Link href={`/vehicles/${record.trailer_id}`} className="text-sm text-primary hover:underline block mt-2">
                                    <div className="font-mono font-bold">{record.trailers.plate_number}</div>
                                    <div className="text-muted-foreground">{record.trailers.make} {record.trailers.model} {record.trailers.trailerSubType ? `(${record.trailers.trailerSubType})` : ''}</div>
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

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Technician Phone</Label>
                                <p className="text-sm mt-2">{record.technician_phone || 'Not provided'}</p>
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Job Card Number</Label>
                                <p className="text-sm mt-2">{record.job_card_number || 'Not assigned'}</p>
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Job Card Date</Label>
                                <p className="text-sm mt-2">{record.job_card_date ? new Date(record.job_card_date).toLocaleDateString() : '—'}</p>
                            </div>
                        </div>

                        <section className="space-y-4 rounded-xl border p-4">
                            <h2 className="font-semibold">Vehicle and Driver Details</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Odometer Reading</Label>
                                    <p className="text-sm mt-2">{record.odometer_reading_km != null ? `${record.odometer_reading_km.toLocaleString()} km` : 'Not recorded'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Engine Hours</Label>
                                    <p className="text-sm mt-2">{record.engine_hours != null ? `${record.engine_hours.toLocaleString()} hrs` : 'Not recorded'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Driver Name</Label>
                                    <p className="text-sm mt-2">{record.driver_name || 'Not provided'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Driver Phone</Label>
                                    <p className="text-sm mt-2">{record.driver_phone || 'Not provided'}</p>
                                </div>
                            </div>
                        </section>

                        {(record.customer_company_name || record.customer_contact_person || record.customer_phone) && (
                            <section className="space-y-4 rounded-xl border p-4">
                                <h2 className="font-semibold">Customer Details</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div><Label className="text-xs font-semibold text-muted-foreground">Company</Label><p className="text-sm mt-2">{record.customer_company_name || '—'}</p></div>
                                    <div><Label className="text-xs font-semibold text-muted-foreground">Contact Person</Label><p className="text-sm mt-2">{record.customer_contact_person || '—'}</p></div>
                                    <div><Label className="text-xs font-semibold text-muted-foreground">Phone</Label><p className="text-sm mt-2">{record.customer_phone || '—'}</p></div>
                                </div>
                            </section>
                        )}

                        {record.inspection_findings && (
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Inspection Findings</Label>
                                <p className="text-sm mt-2 whitespace-pre-wrap">{record.inspection_findings}</p>
                            </div>
                        )}

                        {((record.work_performed ?? []).length > 0 || record.work_performed_other) && (
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Work Performed</Label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {(record.work_performed ?? []).map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
                                    {record.work_performed_other && <Badge variant="outline">Other: {record.work_performed_other}</Badge>}
                                </div>
                            </div>
                        )}

                        {Array.isArray(record.parts_used) && record.parts_used.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground">Parts Used</Label>
                                <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50"><tr><th className="p-2 text-left">Description</th><th className="p-2 text-right">Quantity</th><th className="p-2 text-right">Unit Price</th><th className="p-2 text-right">Total Value</th></tr></thead>
                                        <tbody>
                                            {record.parts_used.map((part, index) => (
                                                <tr key={`${part.description}-${index}`} className="border-t">
                                                    <td className="p-2">{part.description}</td>
                                                    <td className="p-2 text-right">{part.quantity}</td>
                                                    <td className="p-2 text-right font-mono">{format(part.unit_price)}</td>
                                                    <td className="p-2 text-right font-mono">{format(part.total_value)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

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

                        {record.technician_signature && (
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Technician Signature</Label>
                                <p className="text-sm mt-2">{record.technician_signature}</p>
                            </div>
                        )}

                        {(record.driver_confirmation_name || record.driver_confirmation_signature) && (
                            <section className="space-y-3 rounded-xl border p-4">
                                <h2 className="font-semibold">Driver Confirmation</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div><Label className="text-xs font-semibold text-muted-foreground">Name</Label><p className="text-sm mt-2">{record.driver_confirmation_name || '—'}</p></div>
                                    <div><Label className="text-xs font-semibold text-muted-foreground">Typed Signature</Label><p className="text-sm mt-2">{record.driver_confirmation_signature || '—'}</p></div>
                                    <div><Label className="text-xs font-semibold text-muted-foreground">Date and Time</Label><p className="text-sm mt-2">{record.driver_confirmation_at ? new Date(record.driver_confirmation_at).toLocaleString() : '—'}</p></div>
                                </div>
                            </section>
                        )}

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
                        {record.completion_notes && (
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground">Completion Notes</Label>
                                <p className="text-sm mt-2 whitespace-pre-wrap">{record.completion_notes}</p>
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
                            {record.status === 'in_progress' && (
                                <Button
                                    onClick={() => setShowCompleteModal(true)}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                >
                                    Mark Complete
                                </Button>
                            )}
                            {record.status === 'requested' && (role === 'ADMIN' || role === 'CEO' || role === 'MECHANIC') && (
                                <Button
                                    onClick={openScheduleModal}
                                    className="w-full"
                                >
                                    Approve &amp; Schedule
                                </Button>
                            )}
                            <TransitionButtons
                                kind="maintenance_request"
                                entity={record}
                                actorId={user?.id ?? 'system'}
                                actorRole={role ?? undefined}
                                layout="stack"
                                exclude={
                                    record.status === 'in_progress'
                                        ? ['completed']
                                        : record.status === 'requested'
                                            ? ['scheduled']
                                            : undefined
                                }
                                onDone={(next) => setRecord({ ...record, ...next })}
                            />
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

            {/* Activity timeline */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <History className="w-4 h-4" /> Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ActivityFeed entityType="maintenance_request" entityId={record.id} />
                </CardContent>
            </Card>

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

                        <div className="space-y-3 rounded-md border p-4">
                            <p className="font-medium">Technician Sign-off</p>
                            <div>
                                <Label htmlFor="technician_signature">Technician Typed Signature</Label>
                                <Input id="technician_signature" value={completionData.technician_signature} onChange={(e) => setCompletionData({ ...completionData, technician_signature: e.target.value })} placeholder="Type technician's full name" />
                            </div>
                        </div>

                        <div className="space-y-3 rounded-md border p-4">
                            <p className="font-medium">Driver Confirmation</p>
                            <p className="text-xs text-muted-foreground">Enter both fields to record a driver confirmation. The date and time are saved with it.</p>
                            <div>
                                <Label htmlFor="driver_confirmation_name">Driver Name</Label>
                                <Input id="driver_confirmation_name" value={completionData.driver_confirmation_name} onChange={(e) => setCompletionData({ ...completionData, driver_confirmation_name: e.target.value })} placeholder="Driver full name" />
                            </div>
                            <div>
                                <Label htmlFor="driver_confirmation_signature">Driver Typed Signature</Label>
                                <Input id="driver_confirmation_signature" value={completionData.driver_confirmation_signature} onChange={(e) => setCompletionData({ ...completionData, driver_confirmation_signature: e.target.value })} placeholder="Type name to confirm completed work" />
                            </div>
                            <div>
                                <Label htmlFor="driver_confirmation_at">Confirmation Date and Time</Label>
                                <Input id="driver_confirmation_at" type="datetime-local" value={completionData.driver_confirmation_at} onChange={(e) => setCompletionData({ ...completionData, driver_confirmation_at: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={completeFromModal}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Complete
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            {/* Schedule Modal */}
            <AlertDialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve &amp; Schedule Maintenance</AlertDialogTitle>
                        <AlertDialogDescription>
                            Set the date this maintenance is scheduled for. This approves the request and moves it to Scheduled.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="scheduled_date">Scheduled Date</Label>
                            <Input
                                id="scheduled_date"
                                type="date"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={scheduleFromModal}
                            disabled={!scheduleDate}
                        >
                            Approve &amp; Schedule
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
