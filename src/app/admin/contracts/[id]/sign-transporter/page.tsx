'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { fetchContract, signContractAsTransporter } from '@/lib/contract-service';
import type { Contract } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

declare global {
    interface Window {
        SignaturePad: any;
    }
}

export default function SignTransporterPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const contractId = params.id as string;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signaturePadRef = useRef<any>(null);

    const [contract, setContract] = useState<Contract | null>(null);
    const [loading, setLoading] = useState(true);
    const [signing, setSigning] = useState(false);
    const [name, setName] = useState('');
    const [position, setPosition] = useState('');
    const [signatureLoaded, setSignatureLoaded] = useState(false);

    useEffect(() => {
        loadContract();
    }, [contractId]);

    useEffect(() => {
        if (contract && canvasRef.current && !signatureLoaded) {
            initSignaturePad();
        }
    }, [contract, signatureLoaded]);

    async function loadContract() {
        try {
            setLoading(true);
            const data = await fetchContract(contractId);

            // Only allow signing if client already signed and transporter hasn't
            if (
                data.status !== 'active' ||
                !data.client_signed_at ||
                data.transporter_signed_at
            ) {
                toast({
                    title: 'Error',
                    description: 'This contract cannot be countersigned now',
                    variant: 'destructive',
                });
                router.push(`/admin/contracts/${contractId}`);
                return;
            }

            setContract(data);
            setName(data.transporter_signatory_name || '');
            setPosition(data.transporter_signatory_position || '');
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

    function initSignaturePad() {
        // Load signature_pad library
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js';
        script.onload = () => {
            if (canvasRef.current && window.SignaturePad) {
                // Set canvas size
                const canvas = canvasRef.current;
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;

                signaturePadRef.current = new window.SignaturePad(canvas, {
                    backgroundColor: 'rgb(255, 255, 255)',
                });
                setSignatureLoaded(true);
            }
        };
        document.head.appendChild(script);
    }

    function clearSignature() {
        if (signaturePadRef.current) {
            signaturePadRef.current.clear();
        }
    }

    async function handleSign() {
        if (!name.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter your name',
                variant: 'destructive',
            });
            return;
        }

        if (!position.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter your position',
                variant: 'destructive',
            });
            return;
        }

        if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
            toast({
                title: 'Error',
                description: 'Please provide a signature',
                variant: 'destructive',
            });
            return;
        }

        try {
            setSigning(true);
            const signatureDataUrl = signaturePadRef.current.toDataURL('image/png');

            await signContractAsTransporter(
                contractId,
                {
                    signatory_name: name,
                    signatory_position: position,
                    signature_data: signatureDataUrl,
                },
                '', // userId would come from auth context
            );

            toast({
                title: 'Success',
                description: 'Contract countersigned successfully',
            });

            router.push(`/admin/contracts/${contractId}`);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to countersign contract',
                variant: 'destructive',
            });
        } finally {
            setSigning(false);
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
                    <h1 className="text-3xl font-bold">Countersign as Transporter</h1>
                    <p className="text-gray-600 mt-1">{contract.contract_number}</p>
                </div>
            </div>

            {/* Client Signature Reference */}
            <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6">
                    <div className="space-y-2">
                        <p className="font-semibold text-green-900">✓ Client has signed</p>
                        <p className="text-sm text-green-800">
                            {contract.client_signatory_name} ({contract.client_signatory_position})
                        </p>
                        <p className="text-xs text-green-700">
                            Signed on{' '}
                            {contract.client_signed_at &&
                                new Date(contract.client_signed_at).toLocaleDateString()}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Contract Info */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Contract Number</p>
                            <p className="font-semibold">{contract.contract_number}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Client</p>
                            <p className="font-semibold">{contract.client?.name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Effective Date</p>
                            <p className="font-semibold">
                                {new Date(contract.effective_date).toLocaleDateString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Expiry Date</p>
                            <p className="font-semibold">
                                {new Date(contract.expiry_date).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Signature Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Transporter Digital Signature</CardTitle>
                    <CardDescription>Sign the contract as the transporter representative</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            placeholder="Enter your full name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* Position */}
                    <div className="space-y-2">
                        <Label htmlFor="position">Position/Title</Label>
                        <Input
                            id="position"
                            placeholder="Enter your position"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                        />
                    </div>

                    {/* Signature Pad */}
                    <div className="space-y-2">
                        <Label>Signature</Label>
                        <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
                            <canvas
                                ref={canvasRef}
                                style={{
                                    cursor: 'crosshair',
                                    display: 'block',
                                    width: '100%',
                                    height: '200px',
                                }}
                            />
                        </div>
                        <div className="text-xs text-gray-500">
                            Draw your signature in the box above
                        </div>
                    </div>

                    {/* Clear Button */}
                    <Button
                        variant="outline"
                        onClick={clearSignature}
                        type="button"
                        className="w-full"
                    >
                        Clear Signature
                    </Button>
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
                <Link href={`/admin/contracts/${contractId}`}>
                    <Button variant="outline">Cancel</Button>
                </Link>
                <Button
                    onClick={handleSign}
                    disabled={signing}
                    className="border-sky-600 text-sky-600 hover:bg-sky-50 border-2 bg-white"
                >
                    {signing ? 'Countersigning...' : 'Countersign Contract'}
                </Button>
            </div>
        </div>
    );
}
