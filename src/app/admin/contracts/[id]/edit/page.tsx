'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { fetchContract, updateContract } from '@/lib/contract-service';
import type { Contract } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ContractEditPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const contractId = params.id as string;

    const [contract, setContract] = useState<Contract | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [effectiveDate, setEffectiveDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [termMonths, setTermMonths] = useState('12');
    const [autoRenew, setAutoRenew] = useState(false);

    useEffect(() => {
        loadContract();
    }, [contractId]);

    async function loadContract() {
        try {
            setLoading(true);
            const data = await fetchContract(contractId);

            // Only allow editing if draft
            if (data.status !== 'draft') {
                toast({
                    title: 'Error',
                    description: 'Only draft contracts can be edited',
                    variant: 'destructive',
                });
                router.push(`/admin/contracts/${contractId}`);
                return;
            }

            setContract(data);
            setEffectiveDate(data.effective_date);
            setExpiryDate(data.expiry_date);
            setTermMonths(data.term_months.toString());
            setAutoRenew(data.auto_renew);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load contract',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!effectiveDate || !expiryDate || !termMonths) {
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
            setSaving(true);
            await updateContract(contractId, {
                effective_date: effectiveDate,
                expiry_date: expiryDate,
                term_months: parseInt(termMonths),
                auto_renew: autoRenew,
            });

            toast({
                title: 'Success',
                description: 'Contract updated successfully',
            });

            router.push(`/admin/contracts/${contractId}`);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update contract',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="p-6 text-center">Loading contract...</div>;
    }

    if (!contract) {
        return <div className="p-6 text-center">Contract not found</div>;
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/admin/contracts/${contractId}`}>
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">Edit Contract</h1>
                    <p className="text-gray-600 mt-1">{contract.contract_number}</p>
                </div>
            </div>

            {/* Edit Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Contract Details</CardTitle>
                    <CardDescription>Modify contract terms</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                <Link href={`/admin/contracts/${contractId}`}>
                    <Button variant="outline">Cancel</Button>
                </Link>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
}
