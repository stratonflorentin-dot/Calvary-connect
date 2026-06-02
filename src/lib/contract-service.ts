// Contract Management Service - Supabase Backend + Legacy Contract Generation
// Combines new contract management system with existing contract generation
import { supabase } from './supabase';
import type {
  Contract,
  ContractStatus,
  CreateContractDTO,
  SignContractDTO,
  TerminateContractDTO,
  ContractHistory
} from '@/types/contract';

// ============================================================================
// CONTRACT MANAGEMENT SYSTEM (NEW)
// ============================================================================

/**
 * Generate next contract number in format CT-{YEAR}-{4-digit-sequence}
 */
export async function generateContractNumber(): Promise<string> {
  const year = new Date().getFullYear();

  // Get the highest sequence for this year
  const { data, error } = await supabase
    .from('contracts')
    .select('contract_number')
    .like('contract_number', `CT-${year}-%`)
    .order('contract_number', { ascending: false })
    .limit(1);

  if (error) throw error;

  let sequence = 1;
  if (data && data.length > 0) {
    const lastNumber = data[0].contract_number;
    const parts = lastNumber.split('-');
    sequence = parseInt(parts[2]) + 1;
  }

  return `CT-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Fetch all contracts with optional filters
 */
export async function fetchContracts(filters?: {
  status?: ContractStatus;
  clientId?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('contracts')
    .select(`
      *,
      client:clients(*),
      contract_history(*)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Fetch single contract with full details
 */
export async function fetchContract(contractId: string): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      *,
      client:clients(*)
    `)
    .eq('id', contractId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create new contract
 */
export async function createContract(
  clientId: string,
  dto: CreateContractDTO,
  userId: string
): Promise<Contract> {
  const contractNumber = await generateContractNumber();

  const { data, error } = await supabase
    .from('contracts')
    .insert({
      contract_number: contractNumber,
      client_id: clientId,
      effective_date: dto.effectiveDate,
      expiry_date: dto.expiryDate,
      term_months: dto.termMonths,
      auto_renew: dto.autoRenew || false,
      status: 'draft',
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Record creation in history
  await addContractHistory(data.id, 'created', `Contract ${contractNumber} created`, userId);

  return data;
}

/**
 * Update contract metadata
 */
export async function updateContract(
  contractId: string,
  updates: Partial<Contract>
): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .update(updates)
    .eq('id', contractId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark contract as sent
 */
export async function markContractAsSent(
  contractId: string,
  userId: string
): Promise<Contract> {
  const contract = await updateContract(contractId, { status: 'sent' });
  await addContractHistory(contractId, 'sent', 'Contract marked as sent', userId);
  return contract;
}

/**
 * Sign contract as client
 */
export async function signContractAsClient(
  contractId: string,
  signatory: SignContractDTO,
  userId: string
): Promise<Contract> {
  const now = new Date().toISOString();

  const contract = await updateContract(contractId, {
    client_signatory_name: signatory.signatory_name,
    client_signatory_position: signatory.signatory_position,
    client_signature_data: signatory.signature_data,
    client_signed_at: now,
  });

  await addContractHistory(
    contractId,
    'client_signed',
    `Signed by ${signatory.signatory_name} (${signatory.signatory_position})`,
    userId
  );

  return contract;
}

/**
 * Countersign contract as transporter
 */
export async function signContractAsTransporter(
  contractId: string,
  signatory: SignContractDTO,
  userId: string
): Promise<Contract> {
  const now = new Date().toISOString();

  const contract = await updateContract(contractId, {
    transporter_signatory_name: signatory.signatory_name,
    transporter_signatory_position: signatory.signatory_position,
    transporter_signature_data: signatory.signature_data,
    transporter_signed_at: now,
  });

  await addContractHistory(
    contractId,
    'transporter_signed',
    `Countersigned by ${signatory.signatory_name} (${signatory.signatory_position})`,
    userId
  );

  return contract;
}

/**
 * Upload signed PDF
 */
export async function uploadSignedPdf(
  contractId: string,
  pdfUrl: string,
  userId: string
): Promise<Contract> {
  const contract = await updateContract(contractId, {
    signed_pdf_url: pdfUrl,
  });

  await addContractHistory(contractId, 'pdf_uploaded', 'Signed PDF uploaded', userId);
  return contract;
}

/**
 * Mark contract as active
 */
export async function markContractAsActive(
  contractId: string,
  userId: string
): Promise<Contract> {
  const contract = await updateContract(contractId, { status: 'active' });
  await addContractHistory(contractId, 'activated', 'Contract activated', userId);
  return contract;
}

/**
 * Terminate contract
 */
export async function terminateContract(
  contractId: string,
  reason: string,
  userId: string
): Promise<Contract> {
  const contract = await updateContract(contractId, { status: 'terminated' });
  await addContractHistory(
    contractId,
    'terminated',
    `Contract terminated. Reason: ${reason}`,
    userId
  );
  return contract;
}

/**
 * Add history entry
 */
export async function addContractHistory(
  contractId: string,
  event: string,
  description: string,
  userId: string
): Promise<ContractHistory> {
  const { data, error } = await supabase
    .from('contract_history')
    .insert({
      contract_id: contractId,
      event,
      description,
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch contract history
 */
export async function fetchContractHistory(contractId: string): Promise<ContractHistory[]> {
  const { data, error } = await supabase
    .from('contract_history')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get status badge colors - FIX #1
 */
export function getStatusColor(status: ContractStatus): { bg: string; text: string } {
  const colors = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-800' },
    sent: { bg: 'bg-blue-100', text: 'text-blue-800' },
    active: { bg: 'bg-green-100', text: 'text-green-800' },
    expired: { bg: 'bg-red-100', text: 'text-red-800' },
    terminated: { bg: 'bg-red-100', text: 'text-red-800' },
  };
  return colors[status] || colors.draft;
}

/**
 * Get visible actions based on contract status - FIX #2
 */
export function getVisibleActions(status: ContractStatus): string[] {
  const actions = {
    draft: ['edit', 'markSent', 'sign', 'terminate'],
    sent: ['view', 'signClient', 'terminate'],
    active: ['view', 'countersign', 'uploadPdf', 'terminate'],
    expired: ['view', 'archive'],
    terminated: ['view', 'archive'],
  };
  return actions[status] || [];
}

// ============================================================================
// LEGACY CONTRACT GENERATION (EXISTING - PRESERVED FOR BACKWARD COMPATIBILITY)
// ============================================================================

export const RATE_SHEET = {
  "KIGALI - RWANDA": { "20FT": "$3,100.00", "40FT": "$3,100.00", "LOOSE": "$3,100.00", "TYPE": "C28", "DAYS": 3 },
  "LUSAKA - ZAMBIA": { "20FT": "$4,000.00", "40FT": "$4,000.00", "LOOSE": "$4,000.00", "TYPE": "C28", "DAYS": 5 },
  "SOLWEZI - ZAMBIA": { "20FT": "$4,800.00", "40FT": "$4,800.00", "LOOSE": "$4,800.00", "TYPE": "C28", "DAYS": 6 },
  "BUJUMBURA - BURUNDI": { "20FT": "$3,200.00", "40FT": "$3,200.00", "LOOSE": "$3,200.00", "TYPE": "C28", "DAYS": 3 },
  "LILONGWE - MALAWI": { "20FT": "$4,000.00", "40FT": "$4,000.00", "LOOSE": "$4,000.00", "TYPE": "C28", "DAYS": 4 },
  "BLANTYRE - MALAWI": { "20FT": "$4,400.00", "40FT": "$4,400.00", "LOOSE": "$4,400.00", "TYPE": "C28", "DAYS": 4 },
  "KITWE - ZAMBIA": { "20FT": "$4,000.00", "40FT": "$4,000.00", "LOOSE": "$4,400.00", "TYPE": "C28", "DAYS": 5 },
  "GOMA - DRC": { "20FT": "$4,400.00", "40FT": "$4,400.00", "LOOSE": "$4,400.00", "TYPE": "C28", "DAYS": 4 },
  "BUKAVU - DRC": { "20FT": "$4,800.00", "40FT": "$4,800.00", "LOOSE": "$4,800.00", "TYPE": "C28", "DAYS": 5 },
  "LUBUMBASHI - DRC": { "20FT": "$6,400.00", "40FT": "$6,400.00", "LOOSE": "$6,400.00", "TYPE": "C28", "DAYS": 7 },
  "KOLWEZI - DRC": { "20FT": "$7,200.00", "40FT": "$7,200.00", "LOOSE": "$7,200.00", "TYPE": "C28", "DAYS": 8 },
  "LIKASI - DRC": { "20FT": "$8,500.00", "40FT": "$8,500.00", "LOOSE": "$8,500.00", "TYPE": "C28", "DAYS": 9 },
};

export const CORE_CLAUSES = [
  {
    number: "1",
    title: "Purpose of the agreement",
    content: "This agreement describes the terms and conditions under which the Transporter agrees to transport and deliver container with its loaded cargo and on behalf of The Client."
  },
  {
    number: "2",
    title: "Performance of the agreement (The Transporter)",
    content: "The Transporter shall collect and deliver the consignment to be carried as instructed by The Client. Be responsible for any loss/damage to the consignment and shall indemnify The Client for such loss unless occasioned by proven 'Force Majeure'. Provide the Client with minimum twice daily updates (AM & PM) on status of cargo."
  },
  {
    number: "3",
    title: "Client Responsibilities",
    content: "The client shall request truck on FOT terms. The Client will make sure that all shipping line and port charges are paid, and complete necessary customs documentation promptly to avoid storage and demurrage charges."
  },
  {
    number: "4",
    title: "Operations & Health and Safety",
    content: "All the operations of the Transporter are to be conducted in a safe manner and in compliance with all rules, laws and regulations of the United Republic of Tanzania and neighboring countries. Ensure drivers are checked with alcohol test before starting journey and fully equipped with necessary PPE."
  },
  {
    number: "5",
    title: "Duration of Road Carriage Agreement",
    content: "This Agreement shall be valid for a period of One year from the date of contract and may be subject to renewal upon consent of both parties in writing."
  },
  {
    number: "6",
    title: "Risk, Ownership & Indemnity",
    content: "Ownership of the goods shall remain vested in the Actual Consignee. However, the liability of the goods and container from the point once loaded on trucks and in transit shall solely rest with the Transporter. The transporter shall indemnify the Client from all liabilities and claims made against the Client while goods are in possession of the Transporter."
  }
];

export interface ContractData {
  clientName: string;
  clientPOBox: string;
  clientRoad: string;
  clientCity: string;
  clientPhone?: string;
  clientEmail?: string;
  destination: string;
  contractType: "Long Term" | "Single Trip";
  startDate: string;
  endDate?: string;
  minMonthlyTrips?: number;
  contractValue?: number;
  paymentTerms: "30 Days" | "60 Days" | "90 Days" | "COD";
  notes?: string;
  signatoryName?: string;
  signatoryTitle?: string;
}

export function getDestinationRate(destination: string) {
  return RATE_SHEET[destination as keyof typeof RATE_SHEET] || null;
}

export function formatContractHTML(data: ContractData): string {
  const rate = getDestinationRate(data.destination);
  const contractDate = new Date(data.startDate);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Transportation Agreement - ${data.clientName}</title>
      <style>
        body { font-family: 'Times New Roman', serif; max-width: 900px; margin: 0 auto; padding: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 30px; }
        .company-title { color: #1e3a5f; font-size: 20px; font-weight: bold; }
        .subtitle { font-size: 14px; color: #555; margin-top: 5px; }
        .parties { margin: 30px 0; }
        .party { margin-bottom: 20px; }
        .party-label { font-weight: bold; margin-bottom: 8px; }
        .clause { margin-bottom: 20px; }
        .clause-title { font-weight: bold; margin-bottom: 8px; }
        .rate-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .rate-table th, .rate-table td { border: 1px solid #1e3a5f; padding: 8px; text-align: left; }
        .rate-table th { background-color: #1e3a5f; color: white; }
        .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
        .signature-box { width: 45%; }
        .signature-line { border-top: 1px solid #333; margin-top: 30px; padding-top: 10px; }
        h2 { color: #1e3a5f; text-align: center; margin-top: 30px; }
        .stamp-area { border: 2px dashed #c53030; padding: 20px; text-align: center; color: #c53030; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-title">TRANSPORTATION AGREEMENT</div>
        <div class="subtitle">CALVARY INVESTMENT COMPANY LIMITED</div>
        <div class="subtitle">P.O. Box 12929, Dar Es Salaam, Tanzania</div>
      </div>

      <div class="parties">
        <div class="party">
          <div class="party-label">BETWEEN:</div>
          <div>${data.clientName.toUpperCase()}</div>
          <div>P.O. Box ${data.clientPOBox}</div>
          <div>${data.clientRoad}, ${data.clientCity}</div>
          <div style="font-style: italic; margin-top: 10px;">(Hereinafter referred to as "The Client")</div>
        </div>
        
        <div style="text-align: center; margin: 20px 0;"><strong>AND</strong></div>
        
        <div class="party">
          <div class="party-label">CALVARY INVESTMENT COMPANY LIMITED</div>
          <div>P.O. Box 12929, Dar Es Salaam, Tanzania</div>
          <div style="font-style: italic; margin-top: 10px;">(Hereinafter referred to as "The Transporter")</div>
        </div>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <strong>This Agreement is made on the ${contractDate.getDate()} day of ${contractDate.toLocaleString('default', { month: 'long' })} ${contractDate.getFullYear()}</strong>
      </p>

      <h2>TERMS AND CONDITIONS</h2>

      ${CORE_CLAUSES.map(clause => `
        <div class="clause">
          <div class="clause-title">${clause.number}. ${clause.title}</div>
          <p>${clause.content}</p>
        </div>
      `).join('')}

      ${data.destination && rate ? `
        <h2>SPECIFIC ROUTE & PRICING (ANNEXURE A)</h2>
        <table class="rate-table">
          <thead>
            <tr>
              <th>Origin</th>
              <th>Destination</th>
              <th>20ft Container</th>
              <th>40ft Container</th>
              <th>Loose Cargo</th>
              <th>Truck Type</th>
              <th>Transit Days</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>DAR PORT</td>
              <td>${data.destination}</td>
              <td>${rate['20FT']}</td>
              <td>${rate['40FT']}</td>
              <td>${rate['LOOSE']}</td>
              <td>${rate['TYPE']}</td>
              <td>${rate['DAYS']}</td>
            </tr>
          </tbody>
        </table>
      ` : ''}

      <h2>CONTRACT DETAILS</h2>
      <table class="rate-table">
        <tr>
          <td style="width: 50%;"><strong>Contract Type:</strong></td>
          <td>${data.contractType}</td>
        </tr>
        <tr>
          <td><strong>Start Date:</strong></td>
          <td>${new Date(data.startDate).toLocaleDateString()}</td>
        </tr>
        ${data.endDate ? `
          <tr>
            <td><strong>End Date:</strong></td>
            <td>${new Date(data.endDate).toLocaleDateString()}</td>
          </tr>
        ` : ''}
        ${data.minMonthlyTrips ? `
          <tr>
            <td><strong>Minimum Monthly Trips:</strong></td>
            <td>${data.minMonthlyTrips}</td>
          </tr>
        ` : ''}
        ${data.contractValue ? `
          <tr>
            <td><strong>Contract Value (TZS):</strong></td>
            <td>${data.contractValue.toLocaleString()}</td>
          </tr>
        ` : ''}
        <tr>
          <td><strong>Payment Terms:</strong></td>
          <td>${data.paymentTerms}</td>
        </tr>
      </table>

      ${data.notes ? `
        <h2>ADDITIONAL NOTES</h2>
        <p>${data.notes}</p>
      ` : ''}

      <h2>SIGNATURES</h2>
      <div class="signatures">
        <div class="signature-box">
          <p><strong>FOR THE CLIENT</strong></p>
          <p>${data.clientName}</p>
          <div class="signature-line">
            <p>Name: ${data.signatoryName || '____________________'}</p>
            <p>Title: ${data.signatoryTitle || '____________________'}</p>
            <p>Signature: ____________________</p>
            <p>Date: ____________________</p>
          </div>
          <div class="stamp-area" style="margin-top: 20px;">
            Company Stamp / Seal
          </div>
        </div>
        
        <div class="signature-box">
          <p><strong>FOR THE TRANSPORTER</strong></p>
          <p>CALVARY INVESTMENT COMPANY LIMITED</p>
          <div class="signature-line">
            <p>Name: ____________________</p>
            <p>Title: ____________________</p>
            <p>Signature: ____________________</p>
            <p>Date: ____________________</p>
          </div>
          <div class="stamp-area" style="margin-top: 20px;">
            Company Stamp / Seal
          </div>
        </div>
      </div>

      <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ccc; padding-top: 20px;">
        <p>CALVARY INVESTMENT COMPANY LIMITED | P.O. Box 12929, Dar Es Salaam, Tanzania</p>
        <p>This Agreement is governed by the Laws of the United Republic of Tanzania</p>
      </div>
    </body>
    </html>
  `;
}

export function downloadContract(html: string, clientName: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Transport_Agreement_${clientName}_${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function printContract(html: string) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
}
