'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { fetchContract, signContractAsClient } from '@/lib/contract-service';
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

export default function SignClientPage() {
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

            // Only allow signing if in sent status
            if (data.status !== 'sent' || data.client_signed_at) {
                toast({
                    title: 'Error',
                    description: 'This contract cannot be signed by client now',
                    variant: 'destructive',
                });
                router.push(`/admin/contracts/${contractId}`);
                return;
            }

            setContract(data);
            setName(data.client_signatory_name || '');
            setPosition(data.client_signatory_position || '');
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

            await signContractAsClient(
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
                description: 'Contract signed successfully',
            });

            router.push(`/admin/contracts/${contractId}`);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to sign contract',
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
                    <h1 className="text-3xl font-bold">Sign as Client</h1>
                    <p className="text-gray-600 mt-1">{contract.contract_number}</p>
                </div>
            </div>

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
                    <CardTitle>Digital Signature</CardTitle>
                    <CardDescription>Sign the contract using the pad below</CardDescription>
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
                    className="bg-green-600 hover:bg-green-700"
                >
                    {signing ? 'Signing...' : 'Sign Contract'}
                </Button>
            </div>
        </div>
    );
}
