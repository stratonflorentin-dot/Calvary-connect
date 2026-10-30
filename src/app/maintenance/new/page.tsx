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
import { useCustomers } from '@/hooks/data/use-customers';
import { AlertCircle, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function NewMaintenancePage() {
    const router = useRouter();
    const { vehicles, loading: vehiclesLoading } = useFleetVehicles();
    const { trips, loading: tripsLoading } = useTrips();
    const { customers, loading: customersLoading } = useCustomers();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        vehicle_id: '',
        trailer_id: '',
        trip_id: '',
        title: '',
        type: 'scheduled',
        priority: 'medium',
        description: '',
        scheduled_date: '',
        technician: '',
        technician_phone: '',
        workshop: '',
        estimated_cost: '',
        job_card_number: '',
        job_card_date: new Date().toISOString().split('T')[0],
        odometer_reading_km: '',
        engine_hours: '',
        driver_name: '',
        driver_phone: '',
        customer_id: '',
        customer_company_name: '',
        customer_contact_person: '',
        customer_phone: '',
        inspection_findings: '',
        work_performed: [] as string[],
        work_performed_other: '',
        parts_used: [{ description: '', quantity: '1', unit_price: '' }],
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
                    trailer_id: formData.trailer_id || null,
                    trip_id: formData.trip_id || null,
                    title: formData.title,
                    type: formData.type,
                    priority: formData.priority,
                    description: formData.description || null,
                    scheduled_date: formData.scheduled_date || null,
                    technician: formData.technician || null,
                    technician_phone: formData.technician_phone || null,
                    workshop: formData.workshop || null,
                    estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
                    currency: 'TZS',
                    job_card_number: formData.job_card_number || null,
                    job_card_date: formData.job_card_date,
                    odometer_reading_km: formData.odometer_reading_km ? Number(formData.odometer_reading_km) : null,
                    engine_hours: formData.engine_hours ? Number(formData.engine_hours) : null,
                    driver_name: formData.driver_name || null,
                    driver_phone: formData.driver_phone || null,
                    customer_id: formData.customer_id || null,
                    customer_company_name: formData.customer_company_name || null,
                    customer_contact_person: formData.customer_contact_person || null,
                    customer_phone: formData.customer_phone || null,
                    inspection_findings: formData.inspection_findings || null,
                    work_performed: formData.work_performed,
                    work_performed_other: formData.work_performed_other || null,
                    parts_used: formData.parts_used
                        .filter((part) => part.description.trim())
                        .map((part) => {
                            const quantity = Number(part.quantity) || 0;
                            const unitPrice = Number(part.unit_price) || 0;
                            return {
                                description: part.description.trim(),
                                quantity,
                                unit_price: unitPrice,
                                total_value: quantity * unitPrice,
                            };
                        }),
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
                                <Label htmlFor="vehicle_id">Truck (Vehicle)</Label>
                                <Select value={formData.vehicle_id} onValueChange={(val) => setFormData({ ...formData, vehicle_id: val })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select truck" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehicles.filter(v => v.type === 'TRUCK_HEAD' || v.type === 'DUMP_TRUCK').map((v) => (
                                            <SelectItem key={v.id} value={v.id}>
                                                {v.plate_number} - {v.make} {v.model}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="trailer_id">Trailer (Optional)</Label>
                                <Select value={formData.trailer_id} onValueChange={(val) => setFormData({ ...formData, trailer_id: val })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select trailer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehicles.filter(v => v.type === 'TRAILER').map((v) => (
                                            <SelectItem key={v.id} value={v.id}>
                                                {v.plate_number} - {v.make} {v.model} {v.trailerSubType ? `(${v.trailerSubType})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
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

                        <section className="space-y-4 rounded-xl border p-4">
                            <div>
                                <h2 className="font-semibold">Vehicle and Driver Details</h2>
                                <p className="text-sm text-muted-foreground">Capture the truck condition and driver details at check-in.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="odometer_reading_km">Odometer Reading (km)</Label>
                                    <Input id="odometer_reading_km" type="number" min="0" step="0.1" value={formData.odometer_reading_km} onChange={(e) => setFormData({ ...formData, odometer_reading_km: e.target.value })} placeholder="e.g. 184250" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="engine_hours">Engine Hours</Label>
                                    <Input id="engine_hours" type="number" min="0" step="0.1" value={formData.engine_hours} onChange={(e) => setFormData({ ...formData, engine_hours: e.target.value })} placeholder="e.g. 5230" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="driver_name">Driver Name</Label>
                                    <Input id="driver_name" value={formData.driver_name} onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })} placeholder="Driver full name" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="driver_phone">Driver Phone Number</Label>
                                    <Input id="driver_phone" type="tel" value={formData.driver_phone} onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })} placeholder="+255 XXX XXX XXX" />
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4 rounded-xl border p-4">
                            <div>
                                <h2 className="font-semibold">Customer Details</h2>
                                <p className="text-sm text-muted-foreground">Choose a customer to fill the details, or enter them manually.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customer_id">Customer</Label>
                                <Select value={formData.customer_id || 'none'} onValueChange={(value) => {
                                    const selected = customers.find((customer: any) => customer.id === value);
                                    setFormData({
                                        ...formData,
                                        customer_id: value === 'none' ? '' : value,
                                        customer_company_name: selected?.company_name || formData.customer_company_name,
                                        customer_contact_person: selected?.contact_person || formData.customer_contact_person,
                                        customer_phone: selected?.phone || formData.customer_phone,
                                    });
                                }}>
                                    <SelectTrigger><SelectValue placeholder={customersLoading ? 'Loading customers...' : 'Select customer (optional)'} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No customer / enter manually</SelectItem>
                                        {customers.map((customer: any) => (
                                            <SelectItem key={customer.id} value={customer.id}>{customer.company_name || customer.contact_person}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="customer_company_name">Company Name</Label>
                                    <Input id="customer_company_name" value={formData.customer_company_name} onChange={(e) => setFormData({ ...formData, customer_company_name: e.target.value })} placeholder="Company" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="customer_contact_person">Contact Person</Label>
                                    <Input id="customer_contact_person" value={formData.customer_contact_person} onChange={(e) => setFormData({ ...formData, customer_contact_person: e.target.value })} placeholder="Contact full name" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="customer_phone">Customer Phone Number</Label>
                                    <Input id="customer_phone" type="tel" value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} placeholder="+255 XXX XXX XXX" />
                                </div>
                            </div>
                        </section>

                        <div className="space-y-2">
                            <Label htmlFor="title">Job Card Title *</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g., Engine Oil Change, Brake Inspection"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Reported Problem / Service Request</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe the issue reported by the driver or customer"
                                className="min-h-24"
                            />
                        </div>

                        <section className="space-y-4 rounded-xl border p-4">
                            <div>
                                <h2 className="font-semibold">Inspection and Work Performed</h2>
                                <p className="text-sm text-muted-foreground">Record findings and the repair areas completed.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="inspection_findings">Inspection Findings</Label>
                                <Textarea id="inspection_findings" value={formData.inspection_findings} onChange={(e) => setFormData({ ...formData, inspection_findings: e.target.value })} placeholder="Inspection observations, diagnosis, and recommended action" className="min-h-24" />
                            </div>
                            <div className="space-y-3">
                                <Label>Work Performed</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {['Engine', 'Transmission', 'Brakes', 'Suspension', 'Electrical', 'Tyres', 'Body Repair', 'Welding', 'Lubrication', 'Other'].map((item) => (
                                        <label key={item} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={formData.work_performed.includes(item)}
                                                onChange={(event) => setFormData({
                                                    ...formData,
                                                    work_performed: event.target.checked
                                                        ? [...formData.work_performed, item]
                                                        : formData.work_performed.filter((value) => value !== item),
                                                })}
                                                className="h-4 w-4 accent-primary"
                                            />
                                            {item}
                                        </label>
                                    ))}
                                </div>
                                {formData.work_performed.includes('Other') && (
                                    <div className="space-y-2">
                                        <Label htmlFor="work_performed_other">Other Work</Label>
                                        <Input id="work_performed_other" value={formData.work_performed_other} onChange={(e) => setFormData({ ...formData, work_performed_other: e.target.value })} placeholder="Specify any other work performed" />
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="space-y-4 rounded-xl border p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="font-semibold">Parts Used</h2>
                                    <p className="text-sm text-muted-foreground">Enter quantities and unit prices; line totals are calculated automatically.</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, parts_used: [...formData.parts_used, { description: '', quantity: '1', unit_price: '' }] })}>
                                    <Plus className="mr-1 h-4 w-4" /> Add Part
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {formData.parts_used.map((part, index) => {
                                    const lineTotal = (Number(part.quantity) || 0) * (Number(part.unit_price) || 0);
                                    return (
                                        <div key={index} className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto] gap-3 items-end">
                                            <div className="space-y-2">
                                                <Label htmlFor={`part-description-${index}`}>Part Description</Label>
                                                <Input id={`part-description-${index}`} value={part.description} onChange={(e) => setFormData({ ...formData, parts_used: formData.parts_used.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item) })} placeholder="Part or material" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`part-quantity-${index}`}>Quantity</Label>
                                                <Input id={`part-quantity-${index}`} type="number" min="0" step="0.01" value={part.quantity} onChange={(e) => setFormData({ ...formData, parts_used: formData.parts_used.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: e.target.value } : item) })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`part-price-${index}`}>Unit Price (TZS)</Label>
                                                <Input id={`part-price-${index}`} type="number" min="0" step="0.01" value={part.unit_price} onChange={(e) => setFormData({ ...formData, parts_used: formData.parts_used.map((item, itemIndex) => itemIndex === index ? { ...item, unit_price: e.target.value } : item) })} placeholder="0.00" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Line Total</Label>
                                                <div className="h-10 flex items-center rounded-md border px-3 text-sm font-mono">{lineTotal.toLocaleString('en-TZ')}</div>
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" aria-label="Remove part" disabled={formData.parts_used.length === 1} onClick={() => setFormData({ ...formData, parts_used: formData.parts_used.filter((_, itemIndex) => itemIndex !== index) })}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                                <Label htmlFor="technician_phone">Technician Phone</Label>
                                <Input
                                    id="technician_phone"
                                    type="tel"
                                    value={formData.technician_phone}
                                    onChange={(e) => setFormData({ ...formData, technician_phone: e.target.value })}
                                    placeholder="+255 XXX XXX XXX"
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
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

                            <div className="space-y-2">
                                <Label htmlFor="job_card_number">Job Card Number</Label>
                                <Input
                                    id="job_card_number"
                                    value={formData.job_card_number}
                                    onChange={(e) => setFormData({ ...formData, job_card_number: e.target.value })}
                                    placeholder="e.g., JC-2024-001"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="job_card_date">Job Card Date</Label>
                                <Input id="job_card_date" type="date" value={formData.job_card_date} onChange={(e) => setFormData({ ...formData, job_card_date: e.target.value })} required />
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
