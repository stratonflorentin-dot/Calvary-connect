"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCards } from './stat-cards';
import { useLanguage } from '@/hooks/use-language';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export function OperatorView() {
    const { t } = useLanguage();
    const [form, setForm] = useState({
        partName: '',
        quantity: '',
        urgency: '',
        reason: '',
        details: '',
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);
        const { partName, quantity, urgency, reason, details } = form;
        const { error } = await supabase.from('parts_requests').insert([
            {
                part_name: partName,
                quantity,
                urgency,
                reason,
                details,
                created_at: new Date().toISOString(),
            },
        ]);
        setLoading(false);
        if (error) {
            setError('Failed to submit request.');
        } else {
            setSuccess(true);
            setForm({ partName: '', quantity: '', urgency: '', reason: '', details: '' });
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t.operator_dashboard || 'Operator Dashboard'}</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Manage daily operations and fleet assignments</p>
                </div>
            </div>
            <StatCards />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>System Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Welcome, Operator! Here you can manage daily operations, view fleet status, and monitor assignments.</p>
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm">All systems operational</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-sm">Fleet status monitoring active</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Request Spare Parts / Service</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="partName">Part Name / Service</Label>
                                    <Input id="partName" name="partName" value={form.partName} onChange={handleChange} required />
                                </div>
                                <div>
                                    <Label htmlFor="quantity">Quantity</Label>
                                    <Input id="quantity" name="quantity" value={form.quantity} onChange={handleChange} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="urgency">Urgency</Label>
                                    <Input id="urgency" name="urgency" value={form.urgency} onChange={handleChange} required />
                                </div>
                                <div>
                                    <Label htmlFor="reason">Reason for Request</Label>
                                    <Input id="reason" name="reason" value={form.reason} onChange={handleChange} required />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="details">Additional Details</Label>
                                <Textarea id="details" name="details" value={form.details} onChange={handleChange} rows={3} />
                            </div>
                            <Button type="submit" disabled={loading} className="w-full sm:w-auto">{loading ? 'Submitting...' : 'Submit Request'}</Button>
                            {success && <p className="text-green-600">Request submitted successfully!</p>}
                            {error && <p className="text-red-600">{error}</p>}
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
