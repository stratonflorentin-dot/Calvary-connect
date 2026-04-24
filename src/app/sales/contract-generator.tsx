"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Printer, Calendar, DollarSign, MapPin, Truck } from 'lucide-react';

interface ContractTemplate {
  id: string;
  template_name: string;
  company_name: string;
  company_address: string;
  ceo_name: string;
  ceo_title: string;
  contract_title: string;
  preamble: string;
  clauses: Array<{
    number: string;
    title: string;
    content: string;
  }>;
  terms_conditions: string;
}

interface RateSheet {
  id: string;
  rate_sheet_name: string;
  effective_date: string;
  currency: string;
  rates: Array<{
    from: string;
    destination: string;
    container_20ft: number;
    container_40ft: number;
    loose: number;
    truck_type: string;
    transit_days: number;
  }>;
  special_conditions: string;
}

interface Customer {
  id: string;
  company_name: string;
  address: string;
  contact_person: string;
  email: string;
  phone: string;
}

export function ContractGenerator({ customerId, onClose }: { customerId?: string; onClose?: () => void }) {
  const { user } = useSupabase();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedRateSheet, setSelectedRateSheet] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>(customerId || '');
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  
  const [contractDetails, setContractDetails] = useState({
    contract_date: new Date().toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    client_signatory_name: '',
    client_signatory_title: '',
    special_notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [templatesRes, ratesRes, customersRes] = await Promise.all([
        supabase.from('contract_templates').select('*').eq('is_active', true),
        supabase.from('rate_sheets').select('*').eq('is_active', true),
        supabase.from('customers').select('id, company_name, address, contact_person, email, phone').is('deleted_at', null)
      ]);
      
      setTemplates(templatesRes.data || []);
      setRateSheets(ratesRes.data || []);
      setCustomers(customersRes.data || []);
      
      // Set defaults
      if (templatesRes.data?.length > 0) setSelectedTemplate(templatesRes.data[0].id);
      if (ratesRes.data?.length > 0) setSelectedRateSheet(ratesRes.data[0].id);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);
  const selectedRateSheetData = rateSheets.find(r => r.id === selectedRateSheet);
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  const generateContractHTML = () => {
    if (!selectedTemplateData || !selectedCustomerData) return '';
    
    const template = selectedTemplateData;
    const rateSheet = selectedRateSheetData;
    
    return `
      <div style="font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
        <!-- Header with Logo -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px;">
          <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
            <div style="width: 80px; height: 80px; background: #1e3a5f; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
              CALVARY<br>INVESTMENT
            </div>
            <div>
              <h1 style="margin: 0; color: #1e3a5f; font-size: 24px;">${template.contract_title}</h1>
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
                ${template.company_name}<br>
                ${template.company_address}
              </p>
            </div>
          </div>
        </div>

        <!-- Parties -->
        <div style="margin-bottom: 30px;">
          <p style="text-align: center; font-weight: bold; margin-bottom: 20px;">Between</p>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div style="flex: 1;">
              <p><strong>${selectedCustomerData.company_name}</strong></p>
              <p>${selectedCustomerData.address || 'P.O. Box [To be specified]'}</p>
              <p>Contact: ${selectedCustomerData.contact_person || '[To be specified]'}</p>
              <p style="font-style: italic; margin-top: 10px;">Hereinafter referred to as <strong>"The Client"</strong></p>
            </div>
            <div style="text-align: center; padding: 0 20px;">And</div>
            <div style="flex: 1;">
              <p><strong>${template.company_name}</strong></p>
              <p>${template.company_address}</p>
              <p>Contact: ${template.ceo_name} - ${template.ceo_title}</p>
              <p style="font-style: italic; margin-top: 10px;">Hereinafter referred to as <strong>"The Transporter"</strong></p>
            </div>
          </div>
        </div>

        <!-- Date -->
        <p style="text-align: center; margin: 30px 0;">
          <strong>This Agreement is made on the ${new Date(contractDetails.contract_date).getDate()} day of ${new Date(contractDetails.contract_date).toLocaleString('default', { month: 'long' })} ${new Date(contractDetails.contract_date).getFullYear()}</strong>
        </p>

        <!-- Preamble -->
        <div style="margin-bottom: 30px; text-align: justify;">
          <p>${template.preamble?.replace('{{client_name}}', selectedCustomerData.company_name).replace('{{client_address}}', selectedCustomerData.address || 'P.O. Box [Address]')}</p>
        </div>

        <hr style="margin: 30px 0;">

        <!-- Clauses -->
        <div style="margin-bottom: 30px;">
          <h2 style="text-align: center; color: #1e3a5f; margin-bottom: 20px;">TERMS AND CONDITIONS</h2>
          
          ${template.clauses?.map((clause, index) => `
            <div style="margin-bottom: 20px;">
              <p style="font-weight: bold; margin-bottom: 10px;">
                ${clause.number}. ${clause.title}
              </p>
              <p style="text-align: justify; white-space: pre-line;">${clause.content}</p>
            </div>
          `).join('')}
        </div>

        <!-- Additional Terms -->
        ${template.terms_conditions ? `
          <div style="margin-bottom: 30px; background: #f5f5f5; padding: 15px; border-left: 4px solid #1e3a5f;">
            <p style="font-weight: bold; margin-bottom: 10px;">Additional Terms:</p>
            <p style="white-space: pre-line;">${template.terms_conditions}</p>
          </div>
        ` : ''}

        ${rateSheet ? `
          <div style="page-break-before: always; margin-top: 40px;">
            <h2 style="text-align: center; color: #1e3a5f; margin-bottom: 20px;">ANNEXURE A - RATE SHEET</h2>
            <p style="text-align: center; margin-bottom: 20px;">
              <strong>${rateSheet.rate_sheet_name}</strong><br>
              Effective Date: ${new Date(rateSheet.effective_date).toLocaleDateString()}
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
              <thead>
                <tr style="background: #1e3a5f; color: white;">
                  <th style="border: 1px solid #333; padding: 8px; text-align: left;">From</th>
                  <th style="border: 1px solid #333; padding: 8px; text-align: left;">Destination</th>
                  <th style="border: 1px solid #333; padding: 8px; text-align: right;">20ft (${rateSheet.currency})</th>
                  <th style="border: 1px solid #333; padding: 8px; text-align: right;">40ft (${rateSheet.currency})</th>
                  <th style="border: 1px solid #333; padding: 8px; text-align: right;">Loose (${rateSheet.currency})</th>
                  <th style="border: 1px solid #333; padding: 8px; text-align: center;">Truck</th>
                  <th style="border: 1px solid #333; padding: 8px; text-align: center;">Days</th>
                </tr>
              </thead>
              <tbody>
                ${rateSheet.rates?.map((rate, idx) => `
                  <tr style="${idx % 2 === 0 ? 'background: #f9f9f9;' : ''}">
                    <td style="border: 1px solid #333; padding: 6px;">${rate.from}</td>
                    <td style="border: 1px solid #333; padding: 6px;">${rate.destination}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: right;">${rate.container_20ft?.toLocaleString()}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: right;">${rate.container_40ft?.toLocaleString()}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: right;">${rate.loose?.toLocaleString()}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">${rate.truck_type}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">${rate.transit_days}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            ${rateSheet.special_conditions ? `
              <div style="background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin-bottom: 20px; font-size: 11px;">
                <strong>Note:</strong> ${rateSheet.special_conditions}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Signature Blocks -->
        <div style="margin-top: 60px; page-break-before: always;">
          <p style="text-align: center; font-weight: bold; margin-bottom: 40px;">IN WITNESS WHEREOF, the parties have executed this Agreement:</p>
          
          <div style="display: flex; justify-content: space-between; gap: 60px;">
            <!-- Client Signature -->
            <div style="flex: 1;">
              <p style="font-weight: bold; margin-bottom: 20px;">For and on behalf of<br><strong>The Client</strong></p>
              <div style="border-bottom: 1px solid #333; margin-bottom: 10px; height: 40px;"></div>
              <p style="margin-bottom: 5px;"><strong>Name:</strong> ${contractDetails.client_signatory_name || '_______________________'}</p>
              <p style="margin-bottom: 5px;"><strong>Title:</strong> ${contractDetails.client_signatory_title || '_______________________'}</p>
              <p style="margin-top: 15px; font-size: 11px; color: #666;">(Affix company stamp)</p>
            </div>
            
            <!-- Transporter Signature -->
            <div style="flex: 1;">
              <p style="font-weight: bold; margin-bottom: 20px;">For and on behalf of<br><strong>The Transporter</strong></p>
              <div style="border-bottom: 1px solid #333; margin-bottom: 10px; height: 40px;"></div>
              <p style="margin-bottom: 5px;"><strong>Name:</strong> ${template.ceo_name}</p>
              <p style="margin-bottom: 5px;"><strong>Title:</strong> ${template.ceo_title}</p>
              <p style="margin-top: 15px; font-size: 11px; color: #666;">(Affix company stamp)</p>
            </div>
          </div>

          <!-- Witnesses -->
          <div style="margin-top: 40px;">
            <p style="font-weight: bold; margin-bottom: 20px;">Witnesses:</p>
            <div style="display: flex; gap: 60px;">
              <div style="flex: 1;">
                <p style="font-size: 12px; margin-bottom: 10px;"><strong>For The Client:</strong></p>
                <div style="border-bottom: 1px solid #333; margin-bottom: 5px; height: 30px;"></div>
                <p style="font-size: 11px;">Name: _________________________</p>
                <p style="font-size: 11px;">Signature: _____________________</p>
              </div>
              <div style="flex: 1;">
                <p style="font-size: 12px; margin-bottom: 10px;"><strong>For The Transporter:</strong></p>
                <div style="border-bottom: 1px solid #333; margin-bottom: 5px; height: 30px;"></div>
                <p style="font-size: 11px;">Name: _________________________</p>
                <p style="font-size: 11px;">Signature: _____________________</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 60px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 20px;">
          <p>${template.company_name} | ${template.company_address}</p>
          <p>This Agreement is governed by the Laws of the United Republic of Tanzania</p>
        </div>
      </div>
    `;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Transportation Agreement - ${selectedCustomerData?.company_name}</title>
          </head>
          <body>
            ${generateContractHTML()}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Transportation Agreement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label>Select Client</Label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Contract Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.template_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rate Sheet Selection */}
          <div className="space-y-2">
            <Label>Rate Sheet (Annexure A)</Label>
            <Select value={selectedRateSheet} onValueChange={setSelectedRateSheet}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rateSheets.map((sheet) => (
                  <SelectItem key={sheet.id} value={sheet.id}>
                    {sheet.rate_sheet_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contract Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contract Date</Label>
              <Input 
                type="date" 
                value={contractDetails.contract_date}
                onChange={(e) => setContractDetails({...contractDetails, contract_date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Contract End Date</Label>
              <Input 
                type="date" 
                value={contractDetails.end_date}
                onChange={(e) => setContractDetails({...contractDetails, end_date: e.target.value})}
              />
            </div>
          </div>

          {/* Client Signatory */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client Signatory Name</Label>
              <Input 
                value={contractDetails.client_signatory_name}
                onChange={(e) => setContractDetails({...contractDetails, client_signatory_name: e.target.value})}
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Client Signatory Title</Label>
              <Input 
                value={contractDetails.client_signatory_title}
                onChange={(e) => setContractDetails({...contractDetails, client_signatory_title: e.target.value})}
                placeholder="e.g. Managing Director"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <FileText className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print / PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rate Sheet Quick View */}
      {selectedRateSheetData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Rate Sheet Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="text-right">20ft ({selectedRateSheetData.currency})</TableHead>
                  <TableHead className="text-right">40ft ({selectedRateSheetData.currency})</TableHead>
                  <TableHead className="text-center">Transit Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedRateSheetData.rates?.slice(0, 5).map((rate, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{rate.from}</TableCell>
                    <TableCell>{rate.destination}</TableCell>
                    <TableCell className="text-right">{rate.container_20ft?.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{rate.container_40ft?.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{rate.transit_days}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {selectedRateSheetData.rates?.length > 5 && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                ... and {selectedRateSheetData.rates.length - 5} more routes
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract Preview</DialogTitle>
          </DialogHeader>
          <div 
            className="mt-4"
            dangerouslySetInnerHTML={{ __html: generateContractHTML() }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
