"use client";

import { useState, useRef } from 'react';
import { useCurrency } from '@/hooks/use-currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Printer, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface RateLine {
  id: string;
  description: string;
  rate: number;
  amount: number;
}

interface AgreementData {
  agreementNumber: string;
  refNo: string;
  date: string;
  startDate: string;
  endDate: string;
  
  // Supplier
  supplierCompany: string;
  supplierAddress: string;
  supplierLocation: string;
  supplierTel: string;
  supplierEmail: string;
  supplierTin: string;
  
  // Client
  clientCompany: string;
  clientAddress: string;
  clientLocation: string;
  clientTel: string;
  clientEmail: string;
  clientTin: string;
  
  // Scope
  scopeDescription: string;
  generatorModel: string;
  rentalDuration: number;
  
  // Financial
  rates: RateLine[];
  totalContractValue: number;
  
  // Bank Details
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  accountName: string;
  
  // Terms
  paymentTerms: string;
  deliveryLocation: string;
  deliveryDate: string;
  
  // Signatories
  supplierDirector: string;
  clientDirector: string;
}

interface TransportAgreementGeneratorProps {
  initialData?: Partial<AgreementData>;
  onClose: () => void;
}

export function TransportAgreementGenerator({ initialData, onClose }: TransportAgreementGeneratorProps) {
  const { format: formatCurrency } = useCurrency();
  const agreementRef = useRef<HTMLDivElement>(null);

  const [agreementData, setAgreementData] = useState<AgreementData>({
    agreementNumber: initialData?.agreementNumber || `TA-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    refNo: initialData?.refNo || '',
    date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
    startDate: initialData?.startDate || format(new Date(), 'yyyy-MM-dd'),
    endDate: initialData?.endDate || format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    
    supplierCompany: initialData?.supplierCompany || 'Calvary Investment Company Limited',
    supplierAddress: initialData?.supplierAddress || 'P.O. Box 12929',
    supplierLocation: initialData?.supplierLocation || 'Dar es Salaam, Tanzania',
    supplierTel: initialData?.supplierTel || '+255 22 276 1025',
    supplierEmail: initialData?.supplierEmail || 'info@calvaryinvestment.co.tz',
    supplierTin: initialData?.supplierTin || '101-083-417',
    
    clientCompany: initialData?.clientCompany || '',
    clientAddress: initialData?.clientAddress || '',
    clientLocation: initialData?.clientLocation || '',
    clientTel: initialData?.clientTel || '',
    clientEmail: initialData?.clientEmail || '',
    clientTin: initialData?.clientTin || '',
    
    scopeDescription: initialData?.scopeDescription || 'Transportation and logistics services',
    generatorModel: initialData?.generatorModel || '',
    rentalDuration: initialData?.rentalDuration || 365,
    
    rates: initialData?.rates || [
      { id: '1', description: 'Transport Services (per trip)', rate: 0, amount: 0 }
    ],
    totalContractValue: initialData?.totalContractValue || 0,
    
    bankName: initialData?.bankName || 'CRDB Bank',
    bankBranch: initialData?.bankBranch || 'Water Front Branch, Dar es Salaam',
    accountNumber: initialData?.accountNumber || '0150000232800',
    accountName: initialData?.accountName || 'Calvary Investment Co. Ltd',
    
    paymentTerms: initialData?.paymentTerms || '100% upfront or 50% advance, 50% on delivery',
    deliveryLocation: initialData?.deliveryLocation || '',
    deliveryDate: initialData?.deliveryDate || '',
    
    supplierDirector: initialData?.supplierDirector || 'Charles Mwakyembe',
    clientDirector: initialData?.clientDirector || ''
  });

  const addRateLine = () => {
    setAgreementData(prev => ({
      ...prev,
      rates: [...prev.rates, { id: Date.now().toString(), description: '', rate: 0, amount: 0 }]
    }));
  };

  const removeRateLine = (id: string) => {
    setAgreementData(prev => ({
      ...prev,
      rates: prev.rates.filter(item => item.id !== id)
    }));
  };

  const updateRateLine = (id: string, field: keyof RateLine, value: string | number) => {
    setAgreementData(prev => ({
      ...prev,
      rates: prev.rates.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const totalAmount = agreementData.rates.reduce((sum, item) => sum + item.amount, 0);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && agreementRef.current) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Transportation Agreement - ${agreementData.clientCompany}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
              body { 
                font-family: 'Inter', Arial, sans-serif; 
                padding: 40px; 
                line-height: 1.6;
                color: #333;
                max-width: 900px;
                margin: 0 auto;
                font-size: 11px;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 20px;
                border-bottom: 3px solid #dc2626;
                padding-bottom: 15px;
              }
              .company-header {
                color: #dc2626;
              }
              .company-header h1 {
                font-size: 20px;
                font-weight: 700;
                margin: 0;
                color: #dc2626;
              }
              .company-header p {
                font-size: 9px;
                color: #666;
                margin: 2px 0;
              }
              .agreement-title {
                text-align: right;
              }
              .agreement-title h2 {
                font-size: 14px;
                font-weight: 700;
                margin: 0;
                text-transform: uppercase;
              }
              .agreement-title p {
                font-size: 9px;
                color: #666;
                margin: 2px 0;
              }
              .intro {
                font-size: 10px;
                margin: 15px 0;
                text-align: justify;
              }
              .parties {
                display: flex;
                gap: 20px;
                margin: 20px 0;
              }
              .party-box {
                flex: 1;
                border-left: 3px solid #dc2626;
                padding-left: 10px;
              }
              .party-box h3 {
                color: #dc2626;
                font-size: 10px;
                font-weight: 700;
                margin: 0 0 8px 0;
                text-transform: uppercase;
              }
              .party-box p {
                margin: 2px 0;
                font-size: 9px;
              }
              .clause {
                margin: 15px 0;
              }
              .clause h4 {
                color: #dc2626;
                font-size: 11px;
                font-weight: 700;
                margin: 0 0 5px 0;
                text-transform: uppercase;
              }
              .clause-content {
                font-size: 10px;
                text-align: justify;
              }
              .sub-clause {
                margin-left: 15px;
                margin-top: 5px;
              }
              table.rates {
                width: 100%;
                border-collapse: collapse;
                margin: 10px 0;
                font-size: 10px;
              }
              table.rates th {
                background: #dc2626;
                color: white;
                padding: 8px;
                text-align: left;
              }
              table.rates td {
                padding: 6px 8px;
                border-bottom: 1px solid #eee;
              }
              table.rates .total-row {
                font-weight: 700;
                background: #fef2f2;
              }
              .bank-details {
                margin: 15px 0;
                padding: 10px;
                border: 1px solid #ddd;
              }
              .bank-details h4 {
                color: #dc2626;
                font-size: 10px;
                margin: 0 0 8px 0;
              }
              .signatures {
                display: flex;
                gap: 40px;
                margin-top: 40px;
                page-break-inside: avoid;
              }
              .signature-box {
                flex: 1;
              }
              .signature-box h4 {
                color: #dc2626;
                font-size: 10px;
                margin: 0 0 10px 0;
              }
              .signature-line {
                border-bottom: 1px solid #333;
                height: 30px;
                margin-bottom: 5px;
              }
              .stamp-area {
                border: 2px dashed #ccc;
                padding: 20px;
                text-align: center;
                margin: 10px 0;
                color: #999;
                font-size: 10px;
              }
              .page-break {
                page-break-before: always;
              }
              @media print {
                body { padding: 20px; }
              }
            </style>
          </head>
          <body>
            ${agreementRef.current.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    const content = `
TRANSPORTATION AGREEMENT

Ref No: ${agreementData.refNo}
Agreement No: ${agreementData.agreementNumber}
Date: ${format(new Date(agreementData.date), 'dd/MM/yyyy')}

SUPPLIER:
${agreementData.supplierCompany}
${agreementData.supplierAddress}
${agreementData.supplierLocation}
Tel: ${agreementData.supplierTel}
Email: ${agreementData.supplierEmail}
TIN: ${agreementData.supplierTin}

CLIENT:
${agreementData.clientCompany}
${agreementData.clientAddress}
${agreementData.clientLocation}
Tel: ${agreementData.clientTel}
Email: ${agreementData.clientEmail}
TIN: ${agreementData.clientTin}

SCOPE OF AGREEMENT:
${agreementData.scopeDescription}

RENTAL FEES:
${agreementData.rates.map((r, i) => `${i + 1}. ${r.description}: ${formatCurrency(r.rate)} x ${formatCurrency(r.amount)}`).join('\n')}

Total Contract Value: ${formatCurrency(totalAmount)}

BANK DETAILS:
Bank: ${agreementData.bankName}
Branch: ${agreementData.bankBranch}
Account: ${agreementData.accountNumber}
Name: ${agreementData.accountName}

SIGNATURES:

For Supplier:                    For Client:
${agreementData.supplierDirector}              ${agreementData.clientDirector}

Date: ${format(new Date(), 'dd/MM/yyyy')}
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transport_Agreement_${agreementData.agreementNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2">
      {/* Form Section */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Agreement Number</Label>
          <Input value={agreementData.agreementNumber} onChange={(e) => setAgreementData({...agreementData, agreementNumber: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Ref No</Label>
          <Input value={agreementData.refNo} onChange={(e) => setAgreementData({...agreementData, refNo: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={agreementData.date} onChange={(e) => setAgreementData({...agreementData, date: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={agreementData.endDate} onChange={(e) => setAgreementData({...agreementData, endDate: e.target.value})} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Supplier Info */}
        <div className="space-y-3">
          <h3 className="font-semibold text-red-600">SUPPLIER</h3>
          <div className="space-y-2">
            <Input placeholder="Company Name" value={agreementData.supplierCompany} onChange={(e) => setAgreementData({...agreementData, supplierCompany: e.target.value})} />
            <Input placeholder="Address" value={agreementData.supplierAddress} onChange={(e) => setAgreementData({...agreementData, supplierAddress: e.target.value})} />
            <Input placeholder="Location" value={agreementData.supplierLocation} onChange={(e) => setAgreementData({...agreementData, supplierLocation: e.target.value})} />
            <Input placeholder="Telephone" value={agreementData.supplierTel} onChange={(e) => setAgreementData({...agreementData, supplierTel: e.target.value})} />
            <Input placeholder="Email" value={agreementData.supplierEmail} onChange={(e) => setAgreementData({...agreementData, supplierEmail: e.target.value})} />
            <Input placeholder="TIN" value={agreementData.supplierTin} onChange={(e) => setAgreementData({...agreementData, supplierTin: e.target.value})} />
          </div>
        </div>

        {/* Client Info */}
        <div className="space-y-3">
          <h3 className="font-semibold text-red-600">CLIENT</h3>
          <div className="space-y-2">
            <Input placeholder="Company Name" value={agreementData.clientCompany} onChange={(e) => setAgreementData({...agreementData, clientCompany: e.target.value})} />
            <Input placeholder="Address" value={agreementData.clientAddress} onChange={(e) => setAgreementData({...agreementData, clientAddress: e.target.value})} />
            <Input placeholder="Location" value={agreementData.clientLocation} onChange={(e) => setAgreementData({...agreementData, clientLocation: e.target.value})} />
            <Input placeholder="Telephone" value={agreementData.clientTel} onChange={(e) => setAgreementData({...agreementData, clientTel: e.target.value})} />
            <Input placeholder="Email" value={agreementData.clientEmail} onChange={(e) => setAgreementData({...agreementData, clientEmail: e.target.value})} />
            <Input placeholder="TIN" value={agreementData.clientTin} onChange={(e) => setAgreementData({...agreementData, clientTin: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Scope */}
      <div className="space-y-2">
        <Label>Scope Description</Label>
        <Textarea rows={2} value={agreementData.scopeDescription} onChange={(e) => setAgreementData({...agreementData, scopeDescription: e.target.value})} />
      </div>

      {/* Rates Table */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Rental Fees</h3>
          <Button onClick={addRateLine} variant="outline" size="sm"><Plus className="size-4 mr-1" /> Add Line</Button>
        </div>
        <div className="space-y-2">
          {agreementData.rates.map((item) => (
            <div key={item.id} className="grid grid-cols-4 gap-2 items-end">
              <Input placeholder="Description" value={item.description} onChange={(e) => updateRateLine(item.id, 'description', e.target.value)} />
              <Input type="number" placeholder="Rate" value={item.rate} onChange={(e) => updateRateLine(item.id, 'rate', Number(e.target.value))} />
              <Input type="number" placeholder="Amount" value={item.amount} onChange={(e) => updateRateLine(item.id, 'amount', Number(e.target.value))} />
              <Button variant="ghost" size="sm" onClick={() => removeRateLine(item.id)} disabled={agreementData.rates.length === 1}>
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
        <div className="text-right font-bold text-red-600">
          Total: {formatCurrency(totalAmount)}
        </div>
      </div>

      {/* Bank Details */}
      <div className="space-y-3">
        <h3 className="font-semibold text-red-600">Bank Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input placeholder="Bank Name" value={agreementData.bankName} onChange={(e) => setAgreementData({...agreementData, bankName: e.target.value})} />
          <Input placeholder="Branch" value={agreementData.bankBranch} onChange={(e) => setAgreementData({...agreementData, bankBranch: e.target.value})} />
          <Input placeholder="Account Number" value={agreementData.accountNumber} onChange={(e) => setAgreementData({...agreementData, accountNumber: e.target.value})} />
          <Input placeholder="Account Name" value={agreementData.accountName} onChange={(e) => setAgreementData({...agreementData, accountName: e.target.value})} />
        </div>
      </div>

      {/* Signatories */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Supplier Director</Label>
          <Input value={agreementData.supplierDirector} onChange={(e) => setAgreementData({...agreementData, supplierDirector: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Client Director</Label>
          <Input value={agreementData.clientDirector} onChange={(e) => setAgreementData({...agreementData, clientDirector: e.target.value})} />
        </div>
      </div>

      {/* Preview */}
      <Card className="border-2">
        <CardContent className="p-6">
          <div ref={agreementRef} className="space-y-4 text-sm">
            {/* Header */}
            <div className="flex justify-between border-b-2 border-red-600 pb-3">
              <div className="text-red-600">
                <h1 className="text-xl font-bold">{agreementData.supplierCompany}</h1>
                <p className="text-xs text-gray-600">Generator | Rental | Services</p>
                <p className="text-xs text-gray-600">{agreementData.supplierAddress}, {agreementData.supplierLocation}</p>
                <p className="text-xs text-gray-600">Tel: {agreementData.supplierTel}</p>
                <p className="text-xs text-gray-600">Email: {agreementData.supplierEmail}</p>
                <p className="text-xs text-gray-600">TIN: {agreementData.supplierTin}</p>
              </div>
              <div className="text-right">
                <h2 className="text-sm font-bold">TRANSPORTATION AGREEMENT</h2>
                <p className="text-xs text-gray-600">Ref No: {agreementData.refNo}</p>
                <p className="text-xs text-gray-600">Agreement No: {agreementData.agreementNumber}</p>
                <p className="text-xs text-gray-600">Date: {format(new Date(agreementData.date), 'dd/MM/yyyy')}</p>
              </div>
            </div>

            {/* Intro */}
            <p className="text-xs">
              This Transportation Agreement is made and entered into on {format(new Date(agreementData.date), 'dd MMMM yyyy')} between:
            </p>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border-l-2 border-red-600 pl-3">
                <h3 className="text-xs font-bold text-red-600">SUPPLIER</h3>
                <p className="text-xs font-semibold">{agreementData.supplierCompany}</p>
                <p className="text-xs">{agreementData.supplierAddress}</p>
                <p className="text-xs">{agreementData.supplierLocation}</p>
                <p className="text-xs">Tel: {agreementData.supplierTel}</p>
                <p className="text-xs">Email: {agreementData.supplierEmail}</p>
                <p className="text-xs">TIN: {agreementData.supplierTin}</p>
              </div>
              <div className="border-l-2 border-red-600 pl-3">
                <h3 className="text-xs font-bold text-red-600">CLIENT</h3>
                <p className="text-xs font-semibold">{agreementData.clientCompany || '[Company Name]'}</p>
                <p className="text-xs">{agreementData.clientAddress || '[Address]'}</p>
                <p className="text-xs">{agreementData.clientLocation || '[Location]'}</p>
                <p className="text-xs">Tel: {agreementData.clientTel || '[Phone]'}</p>
                <p className="text-xs">Email: {agreementData.clientEmail || '[Email]'}</p>
                <p className="text-xs">TIN: {agreementData.clientTin || '[TIN]'}</p>
              </div>
            </div>

            {/* Scope */}
            <div>
              <h4 className="text-xs font-bold text-red-600">1. SCOPE OF AGREEMENT</h4>
              <p className="text-xs">{agreementData.supplierCompany} agrees to provide {agreementData.scopeDescription} to the Client.</p>
            </div>

            {/* Term */}
            <div>
              <h4 className="text-xs font-bold text-red-600">2. TERM OF AGREEMENT</h4>
              <p className="text-xs">This Agreement commences on {format(new Date(agreementData.date), 'dd MMMM yyyy')} and remains in effect until {format(new Date(agreementData.endDate), 'dd MMMM yyyy')}.</p>
            </div>

            {/* Rental Fees */}
            <div>
              <h4 className="text-xs font-bold text-red-600">3. RENTAL FEES</h4>
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="bg-red-600 text-white">
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Amount (TZS)</th>
                  </tr>
                </thead>
                <tbody>
                  {agreementData.rates.map((r, i) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-2">{r.description}</td>
                      <td className="p-2 text-right">{formatCurrency(r.rate)}</td>
                      <td className="p-2 text-right">{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-red-50 font-bold">
                    <td className="p-2" colSpan={2}>Total Contract Value</td>
                    <td className="p-2 text-right text-red-600">{formatCurrency(totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Terms */}
            <div>
              <h4 className="text-xs font-bold text-red-600">4. PAYMENT TERMS</h4>
              <p className="text-xs">{agreementData.paymentTerms}</p>
            </div>

            {/* Bank Details */}
            <div className="border p-3">
              <h4 className="text-xs font-bold text-red-600">Bank Details for Payment</h4>
              <p className="text-xs">Bank: {agreementData.bankName}</p>
              <p className="text-xs">Branch: {agreementData.bankBranch}</p>
              <p className="text-xs">Account No: {agreementData.accountNumber}</p>
              <p className="text-xs">Account Name: {agreementData.accountName}</p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-8">
              <div>
                <h4 className="text-xs font-bold text-red-600">SUPPLIER</h4>
                <p className="text-xs font-semibold">{agreementData.supplierCompany}</p>
                <p className="text-xs">{agreementData.supplierDirector}</p>
                <p className="text-xs">Director</p>
                <div className="border-b border-gray-400 h-8 mt-2"></div>
                <p className="text-xs text-gray-500 mt-1">Signature</p>
                <div className="border-2 border-dashed border-gray-300 p-2 mt-2 text-center text-gray-400 text-xs">
                  [Company Stamp]
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-red-600">CLIENT</h4>
                <p className="text-xs font-semibold">{agreementData.clientCompany || '[Company Name]'}</p>
                <p className="text-xs">{agreementData.clientDirector || '[Director Name]'}</p>
                <p className="text-xs">Director</p>
                <div className="border-b border-gray-400 h-8 mt-2"></div>
                <p className="text-xs text-gray-500 mt-1">Signature</p>
                <div className="border-2 border-dashed border-gray-300 p-2 mt-2 text-center text-gray-400 text-xs">
                  [Company Stamp]
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 pt-4 border-t">
              {agreementData.supplierCompany} | {agreementData.supplierTel} | {agreementData.supplierEmail}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button variant="outline" onClick={handleDownload} className="gap-2">
          <Download className="size-4" />
          Download
        </Button>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="size-4" />
          Print / Save PDF
        </Button>
      </div>
    </div>
  );
}
