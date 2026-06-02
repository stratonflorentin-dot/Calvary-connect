'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { fetchContract, uploadSignedPdf } from '@/lib/contract-service';
import type { Contract } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FileUp } from 'lucide-react';
import Link from 'next/link';

export default function UploadPdfPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const contractId = params.id as string;

    const [contract, setContract] = useState<Contract | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        loadContract();
    }, [contractId]);

    async function loadContract() {
        try {
            setLoading(true);
            const data = await fetchContract(contractId);

            // Only allow upload if contract is in active status and both parties signed
            if (
                data.status !== 'active' ||
                !data.client_signed_at ||
                !data.transporter_signed_at
            ) {
                toast({
                    title: 'Error',
                    description: 'Contract must be active and both parties must have signed',
                    variant: 'destructive',
                });
                router.push(`/admin/contracts/${contractId}`);
                return;
            }

            setContract(data);
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

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== 'application/pdf') {
                toast({
                    title: 'Error',
                    description: 'Please select a PDF file',
                    variant: 'destructive',
                });
                return;
            }
            if (selectedFile.size > 10 * 1024 * 1024) {
                toast({
                    title: 'Error',
                    description: 'File size must be less than 10MB',
                    variant: 'destructive',
                });
                return;
            }
            setFile(selectedFile);
        }
    }

    async function handleUpload() {
        if (!file) {
            toast({
                title: 'Error',
                description: 'Please select a file',
                variant: 'destructive',
            });
            return;
        }

        try {
            setUploading(true);

            // In a real app, you would upload to Supabase Storage here
            // For now, we'll create a mock URL
            const mockPdfUrl = URL.createObjectURL(file);

            await uploadSignedPdf(contractId, mockPdfUrl, '');

            toast({
                title: 'Success',
                description: 'PDF uploaded successfully',
            });

            router.push(`/admin/contracts/${contractId}`);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to upload PDF',
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
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
                    <h1 className="text-3xl font-bold">Upload Signed PDF</h1>
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
                            <p className="text-sm text-gray-600">Status</p>
                            <p className="font-semibold">{contract.status}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Both Signed</p>
                            <p className="font-semibold text-green-600">
                                ✓ Yes
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Upload Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Upload Signed Contract PDF</CardTitle>
                    <CardDescription>
                        Upload the fully signed contract as a PDF file (Max 10MB)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* File Input */}
                    <div className="space-y-2">
                        <Label htmlFor="pdf-file">PDF File</Label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <FileUp className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                            <div className="space-y-2">
                                <p className="font-semibold text-gray-700">
                                    {file ? file.name : 'Click to upload or drag and drop'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    PDF (up to 10MB)
                                </p>
                            </div>
                            <Input
                                id="pdf-file"
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <label htmlFor="pdf-file">
                                <Button
                                    asChild
                                    variant="outline"
                                    className="mt-4 cursor-pointer"
                                >
                                    <span>Select File</span>
                                </Button>
                            </label>
                        </div>
                    </div>

                    {/* File Info */}
                    {file && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <p className="text-sm text-blue-700">
                                <span className="font-semibold">File selected:</span> {file.name} (
                                {(file.size / 1024 / 1024).toFixed(2)}MB)
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
                <Link href={`/admin/contracts/${contractId}`}>
                    <Button variant="outline">Cancel</Button>
                </Link>
                <Button
                    onClick={handleUpload}
                    disabled={uploading || !file}
                    className="bg-green-600 hover:bg-green-700"
                >
                    {uploading ? 'Uploading...' : 'Upload PDF'}
                </Button>
            </div>
        </div>
    );
}
