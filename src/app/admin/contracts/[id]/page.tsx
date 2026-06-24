'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRole } from '@/hooks/use-role';
import { useToast } from '@/hooks/use-toast';
import {
    fetchContract,
    fetchContractHistory,
    markContractAsSent,
    markContractAsActive,
    terminateContract,
    getStatusColor,
    getVisibleActions,
} from '@/lib/contract-service';
import type { Contract, ContractHistory } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, FileText, Signature } from 'lucide-react';
import { ContractPreviewModal } from '@/components/contracts/contract-preview-modal';
import Link from 'next/link';
import { useSupabase } from '@/components/supabase-provider';

interface SignatureDisplayProps {
    name?: string;
    position?: string;
    signatureData?: string;
    signedAt?: string;
}

function SignatureDisplay({ name, position, signatureData, signedAt }: SignatureDisplayProps) {
    if (!signatureData) {
        return <p className="text-gray-500 text-sm">Not signed</p>;
    }

    return (
        <div className="space-y-2">
            <div className="border rounded-lg p-3 bg-gray-50">
                <img
                    src={signatureData}
                    alt="Signature"
                    className="h-16 object-contain"
                />
            </div>
            {name && <p className="font-semibold text-sm">{name}</p>}
            {position && <p className="text-xs text-gray-600">{position}</p>}
            {signedAt && (
                <p className="text-xs text-gray-500">
                    Signed: {new Date(signedAt).toLocaleDateString()}
                </p>
            )}
        </div>
    );
}

export default function ContractDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { role } = useRole();
    const { user } = useSupabase();
    const { toast } = useToast();
    const contractId = params.id as string;

    const [contract, setContract] = useState<Contract | null>(null);
    const [history, setHistory] = useState<ContractHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [terminateReason, setTerminateReason] = useState('');
    const [terminateOpen, setTerminateOpen] = useState(false);
    const [terminating, setTerminating] = useState(false);

    useEffect(() => {
        loadContractDetails();
    }, [contractId]);

    async function loadContractDetails() {
        try {
            setLoading(true);
            const [contractData, historyData] = await Promise.all([
                fetchContract(contractId),
                fetchContractHistory(contractId),
            ]);
            setContract(contractData);
            setHistory(historyData);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load contract details',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleMarkAsSent() {
        if (!contract) return;
        try {
            const updated = await markContractAsSent(contractId, user?.id || '');
            setContract(updated);
            await loadContractDetails();
            toast({ title: 'Success', description: 'Contract marked as sent' });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to mark contract as sent',
                variant: 'destructive',
            });
        }
    }

    async function handleActivate() {
        if (!contract) return;
        try {
            const updated = await markContractAsActive(contractId, user?.id || '');
            setContract(updated);
            await loadContractDetails();
            toast({ title: 'Success', description: 'Contract activated' });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to activate contract',
                variant: 'destructive',
            });
        }
    }

    async function handleTerminate() {
        if (!contract || !terminateReason.trim()) {
            toast({
                title: 'Error',
                description: 'Please provide a termination reason',
                variant: 'destructive',
            });
            return;
        }
        try {
            setTerminating(true);
            const updated = await terminateContract(contractId, terminateReason, user?.id || '');
            setContract(updated);
            setTerminateOpen(false);
            setTerminateReason('');
            await loadContractDetails();
            toast({ title: 'Success', description: 'Contract terminated' });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to terminate contract',
                variant: 'destructive',
            });
        } finally {
            setTerminating(false);
        }
    }

    if (loading) {
        return <div className="p-6 text-center">Loading contract...</div>;
    }

    if (!contract) {
        return <div className="p-6 text-center">Contract not found</div>;
    }

    const statusColor = getStatusColor(contract.status);
    const visibleActions = getVisibleActions(contract.status);

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/contracts">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">{contract.contract_number}</h1>
                        <p className="text-gray-600 mt-1">
                            {contract.client?.name || 'Unknown Client'}
                        </p>
                    </div>
                </div>
                <Badge className={`${statusColor.bg} ${statusColor.text} text-lg px-4 py-2`}>
                    {contract.status}
                </Badge>
            </div>

            {/* Main Grid: 3 columns */}
            <div className="grid grid-cols-3 gap-6">
                {/* Left: Contract Parties */}
                <Card>
                    <CardHeader>
                        <CardTitle>Contract Parties</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Client */}
                        <div>
                            <h3 className="font-semibold text-sm text-gray-700 mb-2">CLIENT</h3>
                            <div className="space-y-1 text-sm">
                                <p className="font-medium">{contract.client?.name}</p>
                                {contract.client?.email && <p className="text-gray-600">{contract.client.email}</p>}
                                {contract.client?.phone && <p className="text-gray-600">{contract.client.phone}</p>}
                            </div>
                        </div>

                        {/* Effective Dates */}
                        <div>
                            <h3 className="font-semibold text-sm text-gray-700 mb-2">TERM</h3>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <p className="text-gray-600">Effective</p>
                                    <p className="font-medium">
                                        {new Date(contract.effective_date).toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Expiry</p>
                                    <p className="font-medium">
                                        {new Date(contract.expiry_date).toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Duration</p>
                                    <p className="font-medium">{contract.term_months} months</p>
                                </div>
                            </div>
                        </div>

                        {/* Auto-renew */}
                        {contract.auto_renew && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                <p className="text-xs text-blue-700 font-semibold">Auto-renew enabled</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Middle: Company Representative & Transporter */}
                <Card>
                    <CardHeader>
                        <CardTitle>Company Representatives</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Client Signatory */}
                        <div>
                            <h3 className="font-semibold text-sm text-gray-700 mb-3">CLIENT SIGNATORY</h3>
                            {contract.client_signatory_name ? (
                                <div className="space-y-2 text-sm">
                                    <p className="font-medium">{contract.client_signatory_name}</p>
                                    <p className="text-gray-600">{contract.client_signatory_position}</p>
                                    {contract.client_signed_at && (
                                        <p className="text-xs text-green-600 font-semibold">✓ Signed</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm">Not assigned</p>
                            )}
                        </div>

                        {/* Transporter Signatory */}
                        <div>
                            <h3 className="font-semibold text-sm text-gray-700 mb-3">TRANSPORTER SIGNATORY</h3>
                            {contract.transporter_signatory_name ? (
                                <div className="space-y-2 text-sm">
                                    <p className="font-medium">{contract.transporter_signatory_name}</p>
                                    <p className="text-gray-600">{contract.transporter_signatory_position}</p>
                                    {contract.transporter_signed_at && (
                                        <p className="text-xs text-green-600 font-semibold">✓ Signed</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm">Not assigned</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Signatures Card - FIX #5 */}
                <Card>
                    <CardHeader>
                        <CardTitle>Digital Signatures</CardTitle>
                        <CardDescription>Captured signatures and signing dates</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Client Signature */}
                        <div>
                            <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                                <Signature className="w-4 h-4" />
                                CLIENT SIGNATURE
                            </h3>
                            <SignatureDisplay
                                name={contract.client_signatory_name}
                                position={contract.client_signatory_position}
                                signatureData={contract.client_signature_data}
                                signedAt={contract.client_signed_at}
                            />
                        </div>

                        {/* Transporter Signature - FIX #3 */}
                        <div>
                            <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                                <Signature className="w-4 h-4" />
                                TRANSPORTER SIGNATURE
                            </h3>
                            <SignatureDisplay
                                name={contract.transporter_signatory_name}
                                position={contract.transporter_signatory_position}
                                signatureData={contract.transporter_signature_data}
                                signedAt={contract.transporter_signed_at}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Action Buttons - FIX #2 */}
            <div className="flex gap-3 flex-wrap">
                {/* Preview Modal - FIX #4 & #8 */}
                <ContractPreviewModal contract={contract} />

                {visibleActions.includes('edit') && (
                    <Link href={`/admin/contracts/${contractId}/edit`}>
                        <Button variant="outline">Edit Draft</Button>
                    </Link>
                )}
                {visibleActions.includes('markSent') && (
                    <Button onClick={handleMarkAsSent}>Mark as Sent</Button>
                )}
                {visibleActions.includes('signClient') && (
                    <Link href={`/admin/contracts/${contractId}/sign-client`}>
                        <Button variant="outline">Sign as Client</Button>
                    </Link>
                )}
                {/* FIX #3: Countersign button with sky-600 border */}
                {visibleActions.includes('countersign') && (
                    <Link href={`/admin/contracts/${contractId}/sign-transporter`}>
                        <Button
                            variant="outline"
                            className="border-sky-600 text-sky-600 hover:bg-sky-50"
                        >
                            Countersign as Transporter
                        </Button>
                    </Link>
                )}
                {visibleActions.includes('uploadPdf') && (
                    <Link href={`/admin/contracts/${contractId}/upload-pdf`}>
                        <Button variant="outline">Upload Signed PDF</Button>
                    </Link>
                )}
                {contract.status === 'sent' && contract.client_signed_at && contract.transporter_signed_at && (
                    <Button onClick={handleActivate} className="bg-green-600 hover:bg-green-700">
                        Activate Contract
                    </Button>
                )}
                {visibleActions.includes('terminate') && (
                    <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
                        <DialogTrigger asChild>
                            <Button variant="destructive">Terminate</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Terminate Contract</DialogTitle>
                                <DialogDescription>
                                    Provide a reason for terminating this contract
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <Textarea
                                    placeholder="Termination reason..."
                                    value={terminateReason}
                                    onChange={(e) => setTerminateReason(e.target.value)}
                                />
                                <div className="flex gap-3 justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setTerminateOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleTerminate}
                                        disabled={terminating}
                                    >
                                        {terminating ? 'Terminating...' : 'Terminate'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* History Card - FIX #6 */}
            <Card>
                <CardHeader>
                    <CardTitle>Contract History</CardTitle>
                    <CardDescription>Audit trail of contract events</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {history.length === 0 ? (
                            <p className="text-gray-500 text-sm">No history events</p>
                        ) : (
                            history.map((entry, index) => (
                                <div
                                    key={entry.id}
                                    className="flex gap-4 pb-3 border-b last:border-b-0"
                                >
                                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className="font-semibold text-sm">{entry.event}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(entry.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        {entry.description && (
                                            <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Preview/Download Section */}
            {contract.signed_pdf_url && (
                <Card>
                    <CardHeader>
                        <CardTitle>Signed Document</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <a href={contract.signed_pdf_url} download>
                            <Button variant="outline" className="gap-2">
                                <FileText className="w-4 h-4" />
                                Download Signed PDF
                            </Button>
                        </a>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
