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
    contract_number: string;
    clientId: string;
    client_id: string;
    client: ContractParty;

    transporter: ContractParty; // CALVARY INVESTMENT CO LTD

    effectiveDate: string; // YYYY-MM-DD
    effective_date: string;
    expiryDate: string; // YYYY-MM-DD
    expiry_date: string;
    termMonths: number;
    term_months: number;
    autoRenew: boolean;
    auto_renew: boolean;

    status: ContractStatus;

    // Client Signature
    clientSignatoryName?: string;
    client_signatory_name?: string;
    clientSignatoryPosition?: string;
    client_signatory_position?: string;
    clientSignatureData?: string; // base64 PNG
    client_signature_data?: string;
    clientSignedAt?: string;
    client_signed_at?: string;

    // Transporter Signature
    transporterSignatoryName?: string;
    transporter_signatory_name?: string;
    transporterSignatoryPosition?: string;
    transporter_signatory_position?: string;
    transporterSignatureData?: string; // base64 PNG
    transporter_signature_data?: string;
    transporterSignedAt?: string;
    transporter_signed_at?: string;

    // PDF Files
    signedPdfUrl?: string; // uploaded by user
    signed_pdf_url?: string;
    generatedPdfUrl?: string; // system-generated
    generated_pdf_url?: string;

    // Metadata
    createdBy: string; // user_id
    created_by?: string;
    createdAt: string;
    created_at: string;
    updatedAt: string;
    updated_at: string;

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
    created_at: string;
}

export interface CreateContractDTO {
    clientId?: string;
    client_id?: string;
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
