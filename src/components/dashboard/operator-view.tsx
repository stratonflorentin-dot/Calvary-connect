"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCards } from './stat-cards';
import { useLanguage } from '@/hooks/use-language';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DriverLocationMap } from '@/components/driver-location-map';
import { Receipt, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function OperatorView() {
    const { t } = useLanguage();
    const [form, setForm] = useState({
        partName: '',
        quantity: '',
        urgency: '',
        reason: '',
        details: '',
    });
    
    const [expenseForm, setExpenseForm] = useState({
        amount: '',
        category: 'Maintenance',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    const [loading, setLoading] = useState(false);
    const [expenseLoading, setExpenseLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleExpenseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setExpenseLoading(true);
        try {
            const { error } = await supabase.from('expenses').insert([{
                amount: parseFloat(expenseForm.amount),
                category: expenseForm.category,
                description: expenseForm.description,
                created_at: new Date(expenseForm.date).toISOString(),
                status: 'pending'
            }]);

            if (error) throw error;

            toast({ title: "Expense Recorded", description: "Your expense report has been submitted." });
            setExpenseForm({ amount: '', category: 'Maintenance', description: '', date: new Date().toISOString().split('T')[0] });
        } catch (err) {
            console.error(err);
            toast({ title: "Error", description: "Failed to record expense", variant: "destructive" });
        } finally {
            setExpenseLoading(false);
        }
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Receipt className="size-5 text-primary" />
                            Record Expense
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={handleExpenseSubmit}>
                            <div>
                                <Label htmlFor="expAmount">Amount ($)</Label>
                                <Input 
                                    id="expAmount" 
                                    type="number" 
                                    value={expenseForm.amount} 
                                    onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} 
                                    required 
                                />
                            </div>
                            <div>
                                <Label htmlFor="expCategory">Category</Label>
                                <Select value={expenseForm.category} onValueChange={v => setExpenseForm({...expenseForm, category: v})}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                                        <SelectItem value="Fuel">Fuel</SelectItem>
                                        <SelectItem value="Tolls">Tolls</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="expDate">Date</Label>
                                <Input 
                                    id="expDate" 
                                    type="date" 
                                    value={expenseForm.date} 
                                    onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} 
                                    required 
                                />
                            </div>
                            <div>
                                <Label htmlFor="expDesc">Description</Label>
                                <Textarea 
                                    id="expDesc" 
                                    value={expenseForm.description} 
                                    onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} 
                                    placeholder="What was this expense for?"
                                    rows={2}
                                />
                            </div>
                            <Button type="submit" disabled={expenseLoading} className="w-full">
                                {expenseLoading ? 'Saving...' : 'Record Expense'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
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
                            {success && <p className="text-green-600 mt-2">Request submitted successfully!</p>}
                            {error && <p className="text-red-600 mt-2">{error}</p>}
                        </form>
                    </CardContent>
                </Card>
            </div>
            <DriverLocationMap />
        </div>
    );
}
