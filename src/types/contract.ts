// Contract Types and Interfaces

export type ContractStatus = 'draft' | 'sent' | 'active' | 'expired' | 'terminated';

export interface ContractParty {
    id: string;
    name: string;
    address?: string;
    poBox?: string;
    regNo?: string;
    tin?: string;
    email?: string;
    phone?: string;
}

export interface ContractSignatory {
    name: string;
    position: string;
    signatureData?: string; // base64 PNG
    signedAt?: string; // ISO timestamp
}

export interface Contract {
    id: string;
    contractNumber: string; // CT-{YEAR}-{4-digit}
    clientId: string;
    client: ContractParty;

    transporter: ContractParty; // CALVARY INVESTMENT CO LTD

    effectiveDate: string; // YYYY-MM-DD
    expiryDate: string; // YYYY-MM-DD
    termMonths: number;
    autoRenew: boolean;

    status: ContractStatus;

    // Client Signature
    clientSignatoryName?: string;
    clientSignatoryPosition?: string;
    clientSignatureData?: string; // base64 PNG
    clientSignedAt?: string;

    // Transporter Signature
    transporterSignatoryName?: string;
    transporterSignatoryPosition?: string;
    transporterSignatureData?: string; // base64 PNG
    transporterSignedAt?: string;

    // PDF Files
    signedPdfUrl?: string; // uploaded by user
    generatedPdfUrl?: string; // system-generated

    // Metadata
    createdBy: string; // user_id
    createdAt: string;
    updatedAt: string;

    // Content
    clauses?: ContractClause[];
    notes?: string;
}

export interface ContractClause {
    number: number;
    title: string;
    content: string; // HTML or plain text with paragraphs
}

export interface ContractHistory {
    id: string;
    contractId: string;
    event: string; // 'created', 'sent', 'client_signed', 'transporter_signed', 'pdf_uploaded', 'activated', 'terminated'
    description?: string;
    userId: string;
    userName?: string;
    createdAt: string;
}

export interface CreateContractDTO {
    clientId: string;
    effectiveDate: string;
    expiryDate: string;
    termMonths: number;
    autoRenew?: boolean;
}

export interface SignContractDTO {
    signatory_name: string;
    signatory_position: string;
    signature_data: string; // base64 PNG from canvas
}

export interface TerminateContractDTO {
    reason: string;
}
