'use client';

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Download, Printer } from 'lucide-react';
import { generateContractHTML, generatePDF, printContract } from '@/lib/contract-clauses';
import type { Contract } from '@/types/contract';

interface ContractPreviewModalProps {
    contract: Contract;
    trigger?: React.ReactNode;
}

export function ContractPreviewModal({ contract, trigger }: ContractPreviewModalProps) {
    const [open, setOpen] = useState(false);
    const [html, setHtml] = useState('');

    useEffect(() => {
        if (open) {
            const contractHtml = generateContractHTML({
                contractNumber: contract.contract_number,
                clientName: contract.client?.name || 'Unknown',
                clientAddress: contract.client?.address || '',
                effectiveDate: contract.effective_date,
                expiryDate: contract.expiry_date,
                clientSignatoryName: contract.client_signatory_name,
                clientSignatoryPosition: contract.client_signatory_position,
                clientSignatureData: contract.client_signature_data,
                clientSignedAt: contract.client_signed_at,
                transporterSignatoryName: contract.transporter_signatory_name,
                transporterSignatoryPosition: contract.transporter_signatory_position,
                transporterSignatureData: contract.transporter_signature_data,
                transporterSignedAt: contract.transporter_signed_at,
            });
            setHtml(contractHtml);
        }
    }, [open, contract]);

    function handleDownloadPDF() {
        generatePDF(html, `${contract.contract_number}.pdf`);
    }

    function handlePrint() {
        printContract(html);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <FileText className="w-4 h-4" />
                        Preview Contract
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[90vh] p-0 flex flex-col">
                <DialogHeader className="px-6 pt-6 pb-0">
                    <DialogTitle>Contract Preview</DialogTitle>
                    <DialogDescription>{contract.contract_number}</DialogDescription>
                </DialogHeader>

                {/* Action Buttons */}
                <div className="px-6 py-2 border-b flex gap-2 justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadPDF}
                        className="gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Download PDF
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        className="gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        Print
                    </Button>
                </div>

                {/* Preview Content */}
                {html && (
                    <div className="flex-1 overflow-auto bg-gray-100 p-4">
                        <div className="bg-white mx-auto" style={{ width: '210mm' }}>
                            <iframe
                                srcDoc={html}
                                className="w-full h-full border-0"
                                style={{
                                    minHeight: '100vh',
                                }}
                            />
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
