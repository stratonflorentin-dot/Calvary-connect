"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Printer, Plus, Settings, Trash2 } from 'lucide-react';
import { RATE_SHEET, ContractData, formatContractHTML, downloadContract, printContract } from '@/lib/contract-service';
import { fetchRateSheets, RateSheetRoute } from '@/lib/rate-sheet-service';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { format } from 'date-fns';

export function TransportAgreementGenerator() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHTML, setPreviewHTML] = useState('');
  const [dbRates, setDbRates] = useState<RateSheetRoute[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);

  const [formData, setFormData] = useState<ContractData>({
    clientName: '',
    clientPOBox: '',
    clientRoad: '',
    clientCity: '',
    clientPhone: '',
    clientEmail: '',
    destination: '',
    contractType: 'Long Term',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    minMonthlyTrips: 10,
    contractValue: 0,
    paymentTerms: '30 Days',
    notes: '',
    signatoryName: '',
    signatoryTitle: ''
  });

  useEffect(() => {
    loadDatabaseRates();
  }, []);

  const loadDatabaseRates = async () => {
    setLoadingRates(true);
    try {
      const rates = await fetchRateSheets();
      setDbRates(rates);
      if (rates.length > 0) {
        setFormData(prev => ({ ...prev, destination: rates[0].route_name }));
      }
    } catch (error) {
      console.error('Error loading rates:', error);
      toast({ title: 'Warning', description: 'Using default rates' });
    } finally {
      setLoadingRates(false);
    }
  };

  const handleGeneratePreview = () => {
    const html = formatContractHTML(formData);
    setPreviewHTML(html);
    setIsPreviewOpen(true);
  };

  const handlePrint = () => {
  if (!previewHTML) {
    handleGeneratePreview();
  } else {
    printContract(previewHTML);
  }
};

const handleDownload = () => {
  if (!previewHTML) {
    handleGeneratePreview();
  } else {
    downloadContract(previewHTML, formData.clientName);
    toast({ title: 'Success', description: 'Contract downloaded successfully' });
  }
};

return (
  <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Create Transport Contract
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Transport Contract</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Customer</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Customer Name *</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  placeholder="e.g. Karimjee Value Chain Limited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPOBox">P.O. Box *</Label>
                <Input
                  id="clientPOBox"
                  value={formData.clientPOBox}
                  onChange={(e) => setFormData({ ...formData, clientPOBox: e.target.value })}
                  placeholder="e.g. 409"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientRoad">Road/Address *</Label>
                <Input
                  id="clientRoad"
                  value={formData.clientRoad}
                  onChange={(e) => setFormData({ ...formData, clientRoad: e.target.value })}
                  placeholder="e.g. Nyerere Road"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientCity">City *</Label>
                <Input
                  id="clientCity"
                  value={formData.clientCity}
                  onChange={(e) => setFormData({ ...formData, clientCity: e.target.value })}
                  placeholder="e.g. Dar es Salaam"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Phone</Label>
                <Input
                  id="clientPhone"
                  value={formData.clientPhone}
                  onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                  placeholder="+255..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>
            </div>
          </div>

          {/* Contract Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Contract Type</h3>
            <div className="space-y-2">
              <Label htmlFor="contractType">Contract Type *</Label>
              <Select value={formData.contractType} onValueChange={(value) => setFormData({ ...formData, contractType: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Long Term">Long Term</SelectItem>
                  <SelectItem value="Single Trip">Single Trip</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Destination Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Route Details</h3>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination Route *</Label>
              <Select value={formData.destination} onValueChange={(value) => setFormData({ ...formData, destination: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingRates ? "Loading routes..." : "Select a destination"} />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {dbRates.length === 0 ? (
                    <SelectItem value="" disabled>
                      {loadingRates ? "Loading..." : "No routes available"}
                    </SelectItem>
                  ) : (
                    dbRates.map((route) => (
                      <SelectItem key={route.id} value={route.route_name}>
                        {route.route_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Start Date</h3>
            <div className="space-y-2">
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <h3 className="font-semibold text-sm">End Date (optional)</h3>
            <div className="space-y-2">
              <Input
                type="date"
                placeholder="mm/dd/yyyy"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          {/* Min Monthly Trips Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Min Monthly Trips</h3>
            <div className="space-y-2">
              <Input
                type="number"
                value={formData.minMonthlyTrips}
                onChange={(e) => setFormData({ ...formData, minMonthlyTrips: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Contract Value Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Contract Value (TZS)</h3>
            <div className="space-y-2">
              <Input
                type="number"
                value={formData.contractValue}
                onChange={(e) => setFormData({ ...formData, contractValue: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Payment Terms Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Payment Terms *</h3>
            <div className="space-y-2">
              <Select value={formData.paymentTerms} onValueChange={(value) => setFormData({ ...formData, paymentTerms: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30 Days">30 Days</SelectItem>
                  <SelectItem value="60 Days">60 Days</SelectItem>
                  <SelectItem value="90 Days">90 Days</SelectItem>
                  <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Notes</h3>
            <div className="space-y-2">
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional terms or conditions..."
                rows={3}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={handleGeneratePreview}>
              <FileText className="size-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleDownload} className="flex-1">
              <Download className="size-4 mr-2" />
              Download
            </Button>
            <Button onClick={handlePrint} className="flex-1">
              <Printer className="size-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Preview Dialog */}
    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contract Preview - {formData.clientName}</DialogTitle>
        </DialogHeader>
        {previewHTML && (
          <div
            className="prose max-w-none p-4"
            dangerouslySetInnerHTML={{ __html: previewHTML }}
          />
        )}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleDownload} className="flex-1">
            <Download className="size-4 mr-2" />
            Download
          </Button>
          <Button onClick={handlePrint} className="flex-1">
            <Printer className="size-4 mr-2" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>
);
}

// Display available routes
export function RateSheetPreview() {
  const [rates, setRates] = useState<RateSheetRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      const data = await fetchRateSheets();
      setRates(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Available Routes & Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">Loading routes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Available Routes & Rates
        </CardTitle>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <a href="/admin/settings">
            <Settings className="h-4 w-4" />
            Manage Rates
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead className="text-right">20ft Container</TableHead>
              <TableHead className="text-right">40ft Container</TableHead>
              <TableHead className="text-right">Loose Cargo</TableHead>
              <TableHead className="text-center">Transit Days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No routes configured
                </TableCell>
              </TableRow>
            ) : (
              rates.map((route) => (
                <TableRow key={route.id}>
                  <TableCell className="font-medium">{route.route_name}</TableCell>
                  <TableCell className="text-right">${route.container_20ft.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${route.container_40ft.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${route.loose_cargo.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{route.transit_days} days</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
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

interface CalvaryTransportAgreementGeneratorProps {
  initialData?: Partial<AgreementData>;
  onClose: () => void;
}

export function CalvaryTransportAgreementGenerator({ initialData, onClose }: CalvaryTransportAgreementGeneratorProps) {
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
    supplierTel: initialData?.supplierTel || '',
    supplierEmail: initialData?.supplierEmail || '',
    supplierTin: initialData?.supplierTin || '',

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

    bankName: initialData?.bankName || '',
    bankBranch: initialData?.bankBranch || '',
    accountNumber: initialData?.accountNumber || '',
    accountName: initialData?.accountName || '',

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
          <Input value={agreementData.agreementNumber} onChange={(e) => setAgreementData({ ...agreementData, agreementNumber: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Ref No</Label>
          <Input value={agreementData.refNo} onChange={(e) => setAgreementData({ ...agreementData, refNo: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={agreementData.date} onChange={(e) => setAgreementData({ ...agreementData, date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={agreementData.endDate} onChange={(e) => setAgreementData({ ...agreementData, endDate: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Supplier Info */}
        <div className="space-y-3">
          <h3 className="font-semibold text-red-600">SUPPLIER</h3>
          <div className="space-y-2">
            <Input placeholder="Company Name" value={agreementData.supplierCompany} onChange={(e) => setAgreementData({ ...agreementData, supplierCompany: e.target.value })} />
            <Input placeholder="Address" value={agreementData.supplierAddress} onChange={(e) => setAgreementData({ ...agreementData, supplierAddress: e.target.value })} />
            <Input placeholder="Location" value={agreementData.supplierLocation} onChange={(e) => setAgreementData({ ...agreementData, supplierLocation: e.target.value })} />
            <Input placeholder="Telephone" value={agreementData.supplierTel} onChange={(e) => setAgreementData({ ...agreementData, supplierTel: e.target.value })} />
            <Input placeholder="Email" value={agreementData.supplierEmail} onChange={(e) => setAgreementData({ ...agreementData, supplierEmail: e.target.value })} />
            <Input placeholder="TIN" value={agreementData.supplierTin} onChange={(e) => setAgreementData({ ...agreementData, supplierTin: e.target.value })} />
          </div>
        </div>

        {/* Client Info */}
        <div className="space-y-3">
          <h3 className="font-semibold text-red-600">CLIENT</h3>
          <div className="space-y-2">
            <Input placeholder="Company Name" value={agreementData.clientCompany} onChange={(e) => setAgreementData({ ...agreementData, clientCompany: e.target.value })} />
            <Input placeholder="Address" value={agreementData.clientAddress} onChange={(e) => setAgreementData({ ...agreementData, clientAddress: e.target.value })} />
            <Input placeholder="Location" value={agreementData.clientLocation} onChange={(e) => setAgreementData({ ...agreementData, clientLocation: e.target.value })} />
            <Input placeholder="Telephone" value={agreementData.clientTel} onChange={(e) => setAgreementData({ ...agreementData, clientTel: e.target.value })} />
            <Input placeholder="Email" value={agreementData.clientEmail} onChange={(e) => setAgreementData({ ...agreementData, clientEmail: e.target.value })} />
            <Input placeholder="TIN" value={agreementData.clientTin} onChange={(e) => setAgreementData({ ...agreementData, clientTin: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Scope */}
      <div className="space-y-2">
        <Label>Scope Description</Label>
        <Textarea rows={2} value={agreementData.scopeDescription} onChange={(e) => setAgreementData({ ...agreementData, scopeDescription: e.target.value })} />
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
          <Input placeholder="Bank Name" value={agreementData.bankName} onChange={(e) => setAgreementData({ ...agreementData, bankName: e.target.value })} />
          <Input placeholder="Branch" value={agreementData.bankBranch} onChange={(e) => setAgreementData({ ...agreementData, bankBranch: e.target.value })} />
          <Input placeholder="Account Number" value={agreementData.accountNumber} onChange={(e) => setAgreementData({ ...agreementData, accountNumber: e.target.value })} />
          <Input placeholder="Account Name" value={agreementData.accountName} onChange={(e) => setAgreementData({ ...agreementData, accountName: e.target.value })} />
        </div>
      </div>

      {/* Signatories */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Supplier Director</Label>
          <Input value={agreementData.supplierDirector} onChange={(e) => setAgreementData({ ...agreementData, supplierDirector: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Client Director</Label>
          <Input value={agreementData.clientDirector} onChange={(e) => setAgreementData({ ...agreementData, clientDirector: e.target.value })} />
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
