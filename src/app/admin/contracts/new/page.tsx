'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { createContract } from '@/lib/contract-service';
import type { CreateContractDTO } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Client {
    id: string;
    name: string;
    email?: string;
}

export default function NewContractPage() {
    const router = useRouter();
    const { toast } = useToast();

    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    // Form state
    const [clientId, setClientId] = useState('');
    const [effectiveDate, setEffectiveDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [termMonths, setTermMonths] = useState('12');
    const [autoRenew, setAutoRenew] = useState(false);

    useEffect(() => {
        loadClients();
    }, []);

    async function loadClients() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('clients')
                .select('id, name, email')
                .order('name');

            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load clients',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!clientId || !effectiveDate || !expiryDate || !termMonths) {
            toast({
                title: 'Error',
                description: 'Please fill in all required fields',
                variant: 'destructive',
            });
            return;
        }

        const effective = new Date(effectiveDate);
        const expiry = new Date(expiryDate);
        if (expiry <= effective) {
            toast({
                title: 'Error',
                description: 'Expiry date must be after effective date',
                variant: 'destructive',
            });
            return;
        }

        try {
            setCreating(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const dto: CreateContractDTO = {
                effectiveDate,
                expiryDate,
                termMonths: parseInt(termMonths),
                autoRenew,
            };

            const contract = await createContract(clientId, dto, user.id);

            toast({
                title: 'Success',
                description: 'Contract created successfully',
            });

            router.push(`/admin/contracts/${contract.id}`);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to create contract',
                variant: 'destructive',
            });
        } finally {
            setCreating(false);
        }
    }

    if (loading) {
        return <div className="p-6 text-center">Loading clients...</div>;
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/contracts">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">Create New Contract</h1>
                    <p className="text-gray-600 mt-1">
                        Set up a new transportation contract
                    </p>
                </div>
            </div>

            {/* Create Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Contract Details</CardTitle>
                    <CardDescription>Fill in the basic contract information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Client Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="client">Client</Label>
                        {clients.length === 0 ? (
                            <div className="text-sm text-gray-500">
                                No clients available. Please create a client first.
                            </div>
                        ) : (
                            <Select value={clientId} onValueChange={setClientId}>
                                <SelectTrigger id="client">
                                    <SelectValue placeholder="Select a client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((client) => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Effective Date */}
                    <div className="space-y-2">
                        <Label htmlFor="effective-date">Effective Date</Label>
                        <Input
                            id="effective-date"
                            type="date"
                            value={effectiveDate}
                            onChange={(e) => setEffectiveDate(e.target.value)}
                        />
                    </div>

                    {/* Expiry Date */}
                    <div className="space-y-2">
                        <Label htmlFor="expiry-date">Expiry Date</Label>
                        <Input
                            id="expiry-date"
                            type="date"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                        />
                    </div>

                    {/* Term in Months */}
                    <div className="space-y-2">
                        <Label htmlFor="term-months">Contract Term (Months)</Label>
                        <Input
                            id="term-months"
                            type="number"
                            min="1"
                            value={termMonths}
                            onChange={(e) => setTermMonths(e.target.value)}
                        />
                    </div>

                    {/* Auto-renew */}
                    <div className="space-y-2">
                        <Label htmlFor="auto-renew">Auto-Renew</Label>
                        <Select
                            value={autoRenew ? 'yes' : 'no'}
                            onValueChange={(value) => setAutoRenew(value === 'yes')}
                        >
                            <SelectTrigger id="auto-renew">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no">No</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
                <Link href="/admin/contracts">
                    <Button variant="outline">Cancel</Button>
                </Link>
                <Button
                    onClick={handleCreate}
                    disabled={creating || clients.length === 0}
                >
                    {creating ? 'Creating...' : 'Create Contract'}
                </Button>
            </div>
        </div>
    );
}
