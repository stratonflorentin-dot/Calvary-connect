"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { useRole } from '@/hooks/use-role';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Printer, Calendar, DollarSign, MapPin, Truck, Save, CheckCircle } from 'lucide-react';

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

export function ContractGenerator({ customerId, onClose, onSaved }: { customerId?: string; onClose?: () => void; onSaved?: () => void }) {
  const { user } = useSupabase();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);"C:\Users\hp\Downloads\Calvary_Transport_Contract_Template.docx"
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedRateSheet, setSelectedRateSheet] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>(customerId || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingRates, setEditingRates] = useState<any[] | null>(null);
  const [editingModalOpen, setEditingModalOpen] = useState(false);
  const [newRateSheetModalOpen, setNewRateSheetModalOpen] = useState(false);
  const [newRateSheet, setNewRateSheet] = useState({
    rate_sheet_name: '',
    effective_date: new Date().toISOString().split('T')[0],
    currency: 'USD',
    special_conditions: '',
    rates: [],
  });
  
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
        supabase.from('rate_sheets').select('*').eq('is_active', true).not('rate_sheet_name', 'is', null),
        supabase.from('customers').select('id, company_name, address, contact_person, email, phone').is('deleted_at', null)
      ]);
      
      setTemplates(templatesRes.data || []);
      setRateSheets(ratesRes.data || []);
      setCustomers(customersRes.data || []);
      
      // Set defaults
      if (templatesRes.data && templatesRes.data.length > 0) setSelectedTemplate(templatesRes.data[0].id);
      if (ratesRes.data && ratesRes.data.length > 0) setSelectedRateSheet(ratesRes.data[0].id);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);
  const selectedRateSheetData = rateSheets.find(r => r.id === selectedRateSheet);
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  const { hasPermission } = useRole();
  const canEditRates = hasPermission(['CEO', 'ADMIN', 'SALESMAN']);

  const generateContractHTML = () => {
    if (!selectedTemplateData || !selectedCustomerData) return '';
    
    const template = selectedTemplateData;
    const rateSheet = selectedRateSheetData;
    
    return `
      <div style="font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
        <!-- Header with Logo -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 24px;">
            <svg width="110" height="110" viewBox="0 0 340 340">
              <style>.st{font-family:'Times New Roman',serif;fill:#1a5fa8;letter-spacing:2px}</style>
              <circle cx="170" cy="170" r="155" fill="none" stroke="#1a5fa8" stroke-width="4"/>
              <circle cx="170" cy="170" r="143" fill="none" stroke="#1a5fa8" stroke-width="1.5"/>
              <path id="ta" d="M 28,165 A 142,142 0 0,1 312,165" fill="none"/>
              <text class="st" font-size="17" font-weight="700"><textPath href="#ta" startOffset="50%" text-anchor="middle">CALVARY INVESTMENT COMPANY LTD.</textPath></text>
              <path id="ba" d="M 45,225 A 142,142 0 0,0 295,225" fill="none"/>
              <text class="st" font-size="15" font-weight="700"><textPath href="#ba" startOffset="50%" text-anchor="middle">★  TANZANIA  ★</textPath></text>
              <text x="170" y="162" class="st" font-size="14.5" font-weight="700" text-anchor="middle" letter-spacing="1">P. O. Box 75941</text>
              <text x="170" y="184" class="st" font-size="14.5" font-weight="700" text-anchor="middle" letter-spacing="1">DAR ES SALAAM</text>
              <line x1="90" y1="195" x2="250" y2="195" stroke="#1a5fa8" stroke-width="1.2"/>
              <line x1="95" y1="143" x2="245" y2="143" stroke="#1a5fa8" stroke-width="1.2"/>
            </svg>
            <div>
              <h1 style="margin: 0; color: #1e3a5f; font-size: 20px;">${template.contract_title}</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #555;">
                ${template.company_name} &nbsp;|&nbsp; ${template.company_address}
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
          <p>${((template.preamble ?? '') as string).toString().replace('{{client_name}}', (selectedCustomerData?.company_name || '').toString()).replace('{{client_address}}', (selectedCustomerData?.address || 'P.O. Box [Address]').toString())}</p>
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

  const handleSaveContract = async () => {
    if (!selectedCustomer) {
      toast({ title: 'Error', description: 'Please select a customer.', variant: 'destructive' });
      return;
    }
    if (!selectedTemplate) {
      toast({ title: 'Error', description: 'Please select a contract template.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Generate contract number via RPC
      const { data: contractNumber, error: rpcError } = await supabase.rpc('generate_next_contract_number');
      if (rpcError) throw rpcError;

      // Calculate contract value from rate sheet if available
      let contractValue = 0;
      if (selectedRateSheetData?.rates?.length) {
        contractValue = selectedRateSheetData.rates.reduce((sum, r) => sum + (r.container_20ft || 0), 0);
      }

      // Insert contract record
      const { error: insertError } = await supabase.from('transport_contracts').insert([{
        contract_number: contractNumber,
        customer_id: selectedCustomer,
        template_id: selectedTemplate,
        rate_sheet_id: selectedRateSheet || null,
        contract_type: 'standard',
        contract_date: contractDetails.contract_date,
        start_date: contractDetails.start_date,
        end_date: contractDetails.end_date || null,
        contract_value: contractValue,
        currency: selectedRateSheetData?.currency || 'USD',
        status: 'draft',
        client_signatory_name: contractDetails.client_signatory_name || null,
        client_signatory_title: contractDetails.client_signatory_title || null,
        special_notes: contractDetails.special_notes || null,
        generated_html: generateContractHTML(),
        created_by: user?.id
      }]);

      if (insertError) throw insertError;

      toast({ title: 'Contract saved!', description: `Contract ${contractNumber} created successfully` });
      
      // Notify parent and close
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (e: any) {
      console.error('Save contract error:', e);
      toast({ title: 'Error saving contract', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadDocx = async () => {
    console.log('Selected customer:', selectedCustomer);
    console.log('Selected template:', selectedTemplate);
    console.log('Contract details:', contractDetails);
    console.log('Selected template data:', selectedTemplateData);
    console.log('Selected rate sheet data:', selectedRateSheetData);
    console.log('Selected customer data:', selectedCustomerData);

    if (!selectedCustomer) {
      toast({ title: 'Error', description: 'Please select a customer.', variant: 'destructive' });
      return;
    }
    if (!selectedTemplate) {
      toast({ title: 'Error', description: 'Please select a contract template.', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        contract_number: 'CN-' + (new Date().getTime()),
        contract_date: contractDetails.contract_date,
        start_date: contractDetails.start_date,
        end_date: contractDetails.end_date,
        client_signatory_name: contractDetails.client_signatory_name,
        client_signatory_title: contractDetails.client_signatory_title,
        special_notes: contractDetails.special_notes,
        template: selectedTemplateData,
        rate_sheet: selectedRateSheetData,
        customer: selectedCustomerData
      };

      console.log('Sending payload to backend:', payload);
      const res = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to generate contract');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contract-${selectedCustomerData?.company_name || 'agreement'}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Download error', e);
      toast({ title: 'Error', description: e.message || 'Failed to download contract', variant: 'destructive' });
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedCustomer) {
      toast({ title: 'Error', description: 'Please select a customer.', variant: 'destructive' });
      return;
    }
    if (!selectedTemplate) {
      toast({ title: 'Error', description: 'Please select a contract template.', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        contract_number: 'CN-' + (new Date().getTime()),
        contract_date: contractDetails.contract_date,
        start_date: contractDetails.start_date,
        end_date: contractDetails.end_date,
        client_signatory_name: contractDetails.client_signatory_name,
        client_signatory_title: contractDetails.client_signatory_title,
        special_notes: contractDetails.special_notes,
        template: selectedTemplateData,
        rate_sheet: selectedRateSheetData,
        customer: selectedCustomerData
      };

      const res = await fetch('/api/contracts/generate?format=pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to generate PDF');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contract-${selectedCustomerData?.company_name || 'agreement'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Download PDF error', e);
      toast({ title: 'Error', description: e.message || 'Failed to download PDF', variant: 'destructive' });
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
  <div className="flex gap-2">
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
    {canEditRates && (
      <Button size="sm" variant="outline" onClick={() => setNewRateSheetModalOpen(true)}>
        Add New Rate Sheet
      </Button>
    )}
  </div>
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

          {/* Special Notes */}
          <div className="space-y-2">
            <Label>Special Notes (Optional)</Label>
            <Textarea
              value={contractDetails.special_notes}
              onChange={(e) => setContractDetails({...contractDetails, special_notes: e.target.value})}
              placeholder="Any additional notes for this contract..."
              rows={2}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="outline" onClick={() => {
              if (!selectedCustomer || !selectedTemplate) {
                toast({ title: 'Select data', description: 'Please select a customer and template before previewing.', variant: 'destructive' });
                return;
              }
              setShowPreview(true);
            }}>
              <FileText className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print / PDF
            </Button>
            <Button onClick={handleSaveContract} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Contract
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rate Sheet Quick View */}
      {selectedRateSheetData && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Rate Sheet Preview
            </CardTitle>
            {canEditRates && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  setEditingModalOpen(true);
                  setEditingRates(selectedRateSheetData?.rates || []);
                }}>
                  Edit Annexure A
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const newRate = {
                    from: '',
                    destination: '',
                    container_20ft: 0,
                    container_40ft: 0,
                    loose: 0,
                    truck_type: '',
                    transit_days: 0,
                  };
                  const updatedRates = [...(selectedRateSheetData?.rates || []), newRate];
                  setEditingRates(updatedRates);
                  setEditingModalOpen(true);
                }}>
                  Add New Rate
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="text-right">20ft ({selectedRateSheetData.currency})</TableHead>
                  <TableHead className="text-right">40ft ({selectedRateSheetData.currency})</TableHead>
                  <TableHead className="text-center">Transit Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedRateSheetData.rates?.map((rate, idx) => (
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
          </CardContent>
        </Card>
      )}

      {/* New Rate Sheet Dialog */}
      <Dialog open={newRateSheetModalOpen} onOpenChange={setNewRateSheetModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add New Rate Sheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rate Sheet Name</Label>
              <Input
                value={newRateSheet.rate_sheet_name}
                onChange={(e) => setNewRateSheet({ ...newRateSheet, rate_sheet_name: e.target.value })}
                placeholder="e.g., Q3 2024 Freight Rates"
              />
            </div>
            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={newRateSheet.effective_date}
                onChange={(e) => setNewRateSheet({ ...newRateSheet, effective_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={newRateSheet.currency}
                onValueChange={(value) => setNewRateSheet({ ...newRateSheet, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="TZS">TZS</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Special Conditions</Label>
              <Textarea
                value={newRateSheet.special_conditions}
                onChange={(e) => setNewRateSheet({ ...newRateSheet, special_conditions: e.target.value })}
                placeholder="Any special conditions or notes..."
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNewRateSheetModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={async () => {
                try {
                  if (!newRateSheet.rate_sheet_name) {
                    toast({ title: 'Error', description: 'Rate sheet name is required', variant: 'destructive' });
                    return;
                  }

                  const { data, error } = await supabase
                    .from('rate_sheets')
                    .insert([{
                      rate_sheet_name: newRateSheet.rate_sheet_name,
                      effective_date: newRateSheet.effective_date,
                      currency: newRateSheet.currency,
                      special_conditions: newRateSheet.special_conditions,
                      rates: newRateSheet.rates,
                      is_active: true,
                      created_by: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id || '') ? user?.id : null,
                    }])
                    .select()
                    .single();

                  if (error) {
                    console.error('Detailed error:', error);
                    throw error;
                  }

                  toast({ title: 'Success', description: 'Rate sheet created successfully' });
                  setNewRateSheetModalOpen(false);
                  setNewRateSheet({
                    rate_sheet_name: '',
                    effective_date: new Date().toISOString().split('T')[0],
                    currency: 'USD',
                    special_conditions: '',
                    rates: [],
                  });

                  // Refresh rate sheets
                  const { data: refreshed, error: fetchErr } = await supabase.from('rate_sheets').select('*').eq('is_active', true).not('rate_sheet_name', 'is', null);
                  if (!fetchErr) setRateSheets(refreshed || []);
                  if (data) setSelectedRateSheet(data.id);
                } catch (e: any) {
                  console.error('Error creating rate sheet:', e);
                  toast({ title: 'Error', description: e.message || 'Failed to create rate sheet', variant: 'destructive' });
                }
              }}>
                Save Rate Sheet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Rates Modal */}
      {canEditRates && selectedRateSheetData && (
        <Dialog open={editingModalOpen} onOpenChange={setEditingModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit Annexure A - Rates</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="text-left">
                    <th>From</th>
                    <th>Destination</th>
                    <th className="text-right">20ft</th>
                    <th className="text-right">40ft</th>
                    <th className="text-right">Loose</th>
                    <th className="text-center">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {(editingRates || selectedRateSheetData.rates).map((r: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="py-2">
                        <Input value={r.from} onChange={(e) => {
                          const copy = (editingRates || [...selectedRateSheetData.rates]).slice();
                          copy[i] = { ...copy[i], from: e.target.value };
                          setEditingRates(copy);
                        }} />
                      </td>
                      <td>
                        <Input value={r.destination} onChange={(e) => {
                          const copy = (editingRates || [...selectedRateSheetData.rates]).slice();
                          copy[i] = { ...copy[i], destination: e.target.value };
                          setEditingRates(copy);
                        }} />
                      </td>
                      <td className="text-right">
                        <Input value={String(r.container_20ft || 0)} onChange={(e) => {
                          const copy = (editingRates || [...selectedRateSheetData.rates]).slice();
                          copy[i] = { ...copy[i], container_20ft: Number(e.target.value) };
                          setEditingRates(copy);
                        }} />
                      </td>
                      <td className="text-right">
                        <Input value={String(r.container_40ft || 0)} onChange={(e) => {
                          const copy = (editingRates || [...selectedRateSheetData.rates]).slice();
                          copy[i] = { ...copy[i], container_40ft: Number(e.target.value) };
                          setEditingRates(copy);
                        }} />
                      </td>
                      <td className="text-right">
                        <Input value={String(r.loose || 0)} onChange={(e) => {
                          const copy = (editingRates || [...selectedRateSheetData.rates]).slice();
                          copy[i] = { ...copy[i], loose: Number(e.target.value) };
                          setEditingRates(copy);
                        }} />
                      </td>
                      <td className="text-center">
                        <Input value={String(r.transit_days || 0)} onChange={(e) => {
                          const copy = (editingRates || [...selectedRateSheetData.rates]).slice();
                          copy[i] = { ...copy[i], transit_days: Number(e.target.value) };
                          setEditingRates(copy);
                        }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setEditingModalOpen(false); setEditingRates(null); }}>Cancel</Button>
                <Button onClick={async () => {
                  try {
                    const newRates = editingRates || selectedRateSheetData.rates;
                    const { data, error } = await supabase
                      .from('rate_sheets')
                      .update({ rates: newRates, updated_at: new Date().toISOString() })
                      .eq('id', selectedRateSheetData.id)
                      .select()
                      .single();
                    if (error) throw error;
                    toast({ title: 'Saved', description: 'Rates updated' });
                    setEditingModalOpen(false);
                    setEditingRates(null);
                    // refresh rate sheets
                    const { data: refreshed, error: fetchErr } = await supabase.from('rate_sheets').select('*').eq('is_active', true).not('rate_sheet_name', 'is', null);
                    if (!fetchErr) setRateSheets(refreshed || []);
                  } catch (e: any) {
                    console.error('Error saving rates', e);
                    toast({ title: 'Error', description: e.message || 'Failed to save rates', variant: 'destructive' });
                  }
                }}>Save Rates</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract Preview</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print / PDF
            </Button>
            <Button size="sm" onClick={handleSaveContract} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Contract'}
            </Button>
            <Button size="sm" onClick={handleDownloadDocx} className="ml-2">
              <Download className="h-4 w-4 mr-2" />
              Download .docx
            </Button>
            <Button size="sm" onClick={handleDownloadPdf} className="ml-2">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
          <div 
            className="mt-4"
            dangerouslySetInnerHTML={{ __html: generateContractHTML() }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
