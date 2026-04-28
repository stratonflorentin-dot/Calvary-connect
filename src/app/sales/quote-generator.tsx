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

interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

interface QuoteData {
  quoteNumber: string;
  issueDate: string;
  validThrough: string;
  senderName: string;
  senderAddress1: string;
  senderAddress2: string;
  senderAddress3: string;
  senderPhone: string;
  senderEmail: string;
  receiverName: string;
  receiverAddress1: string;
  receiverAddress2: string;
  receiverAddress3: string;
  receiverPhone: string;
  receiverEmail: string;
  lineItems: QuoteLineItem[];
  termsAndConditions: string;
  notes: string;
  taxRate: number;
}

interface QuoteGeneratorProps {
  initialData?: Partial<QuoteData>;
  onClose: () => void;
}

export function QuoteGenerator({ initialData, onClose }: QuoteGeneratorProps) {
  const { format: formatCurrency } = useCurrency();
  const quoteRef = useRef<HTMLDivElement>(null);

  const [quoteData, setQuoteData] = useState<QuoteData>({
    quoteNumber: initialData?.quoteNumber || `QT-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    issueDate: initialData?.issueDate || format(new Date(), 'yyyy-MM-dd'),
    validThrough: initialData?.validThrough || format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    senderName: initialData?.senderName || 'Calvary Connect Limited',
    senderAddress1: initialData?.senderAddress1 || 'Dar es Salaam, Tanzania',
    senderAddress2: initialData?.senderAddress2 || '',
    senderAddress3: initialData?.senderAddress3 || '',
    senderPhone: initialData?.senderPhone || '+255 XXX XXX XXX',
    senderEmail: initialData?.senderEmail || 'info@calvaryconnect.co.tz',
    receiverName: initialData?.receiverName || '',
    receiverAddress1: initialData?.receiverAddress1 || '',
    receiverAddress2: initialData?.receiverAddress2 || '',
    receiverAddress3: initialData?.receiverAddress3 || '',
    receiverPhone: initialData?.receiverPhone || '',
    receiverEmail: initialData?.receiverEmail || '',
    lineItems: initialData?.lineItems || [
      { id: '1', description: 'Transport Services', quantity: 1, unitPrice: 0, discount: 0 }
    ],
    termsAndConditions: initialData?.termsAndConditions || 
      '1. Prices are valid for the specified period.\n' +
      '2. Payment terms: Net 30 days from invoice date.\n' +
      '3. Cancellation policy: 24-hour notice required.\n' +
      '4. All transport is at owner\'s risk unless insurance is purchased.',
    notes: initialData?.notes || '',
    taxRate: initialData?.taxRate || 10
  });

  const addLineItem = () => {
    setQuoteData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { 
        id: Date.now().toString(), 
        description: '', 
        quantity: 1, 
        unitPrice: 0, 
        discount: 0 
      }]
    }));
  };

  const removeLineItem = (id: string) => {
    setQuoteData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(item => item.id !== id)
    }));
  };

  const updateLineItem = (id: string, field: keyof QuoteLineItem, value: string | number) => {
    setQuoteData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const calculateSubtotal = (item: QuoteLineItem) => {
    const discountedPrice = item.unitPrice * (1 - (item.discount || 0) / 100);
    return item.quantity * discountedPrice;
  };

  const calculateTax = (item: QuoteLineItem) => {
    return calculateSubtotal(item) * (quoteData.taxRate / 100);
  };

  const totalSubtotal = quoteData.lineItems.reduce((sum, item) => sum + calculateSubtotal(item), 0);
  const totalTax = quoteData.lineItems.reduce((sum, item) => sum + calculateTax(item), 0);
  const grandTotal = totalSubtotal + totalTax;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && quoteRef.current) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Transport Price Quote - ${quoteData.quoteNumber}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
              body { 
                font-family: 'Inter', Arial, sans-serif; 
                padding: 40px; 
                line-height: 1.5;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
              }
              .header { 
                text-align: center; 
                margin-bottom: 30px;
              }
              .header-title {
                background: #666;
                color: white;
                padding: 15px 30px;
                font-size: 20px;
                font-weight: 600;
                letter-spacing: 1px;
              }
              .company-info {
                margin-bottom: 30px;
              }
              .company-name {
                color: #22c55e;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 5px;
              }
              .two-columns {
                display: flex;
                justify-content: space-between;
                gap: 60px;
                margin-bottom: 30px;
              }
              .column {
                flex: 1;
              }
              .column-header {
                color: #3b82f6;
                font-weight: 600;
                font-size: 12px;
                text-transform: uppercase;
                margin-bottom: 10px;
                letter-spacing: 0.5px;
              }
              .field-row {
                display: flex;
                margin-bottom: 5px;
                font-size: 12px;
              }
              .field-label {
                width: 100px;
                font-weight: 600;
                color: #555;
              }
              .field-value {
                flex: 1;
                color: #666;
              }
              .quote-meta {
                display: flex;
                gap: 40px;
                margin: 30px 0;
                font-size: 12px;
              }
              .meta-item {
                display: flex;
                align-items: center;
              }
              .meta-label {
                font-weight: 600;
                margin-right: 8px;
              }
              .meta-value {
                color: #666;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 12px;
              }
              th {
                background: #666;
                color: white;
                padding: 10px;
                text-align: left;
                font-weight: 500;
              }
              td {
                padding: 10px;
                border-bottom: 1px solid #e5e7eb;
              }
              .text-right {
                text-align: right;
              }
              .totals-section {
                margin-top: 20px;
                border-top: 2px solid #666;
                padding-top: 15px;
              }
              .total-row {
                display: flex;
                justify-content: flex-end;
                gap: 40px;
                margin-bottom: 8px;
                font-size: 12px;
              }
              .grand-total {
                background: #22c55e;
                color: white;
                padding: 10px 20px;
                font-weight: 600;
              }
              .terms-section {
                margin-top: 30px;
              }
              .terms-title {
                color: #3b82f6;
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 10px;
              }
              .terms-content {
                font-size: 11px;
                line-height: 1.6;
                color: #666;
              }
              @media print {
                body { padding: 20px; }
              }
            </style>
          </head>
          <body>
            ${quoteRef.current.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    const content = `
TRANSPORT PRICE QUOTE

Quote Number: ${quoteData.quoteNumber}
Issue Date: ${format(new Date(quoteData.issueDate), 'MMMM dd, yyyy')}
Valid Through: ${format(new Date(quoteData.validThrough), 'MMMM dd, yyyy')}

SENDER:
Name: ${quoteData.senderName}
Address: ${quoteData.senderAddress1}
Address: ${quoteData.senderAddress2 || 'N/A'}
Address: ${quoteData.senderAddress3 || 'N/A'}
Phone Number: ${quoteData.senderPhone}
Email: ${quoteData.senderEmail}

RECEIVER:
Name: ${quoteData.receiverName}
Address: ${quoteData.receiverAddress1 || 'N/A'}
Address: ${quoteData.receiverAddress2 || 'N/A'}
Address: ${quoteData.receiverAddress3 || 'N/A'}
Phone Number: ${quoteData.receiverPhone || 'N/A'}
Email: ${quoteData.receiverEmail || 'N/A'}

LINE ITEMS:
${quoteData.lineItems.map((item, i) => `
${i + 1}. ${item.description}
   Qty: ${item.quantity} | Unit Price: ${formatCurrency(item.unitPrice)}${item.discount ? ` | Discount: ${item.discount}%` : ''} | Subtotal: ${formatCurrency(calculateSubtotal(item))} | Tax (${quoteData.taxRate}%): ${formatCurrency(calculateTax(item))}
`).join('')}

SUBTOTAL: ${formatCurrency(totalSubtotal)}
TAX (${quoteData.taxRate}%): ${formatCurrency(totalTax)}
TOTAL: ${formatCurrency(grandTotal)}

TERMS AND CONDITIONS:
${quoteData.termsAndConditions}

NOTES:
${quoteData.notes || 'N/A'}

Generated by Calvary Connect Ltd.
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quote_${quoteData.quoteNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Quote Number</Label>
          <Input 
            value={quoteData.quoteNumber}
            onChange={(e) => setQuoteData({...quoteData, quoteNumber: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <Label>Tax Rate (%)</Label>
          <Input 
            type="number"
            value={quoteData.taxRate}
            onChange={(e) => setQuoteData({...quoteData, taxRate: Number(e.target.value)})}
          />
        </div>
        <div className="space-y-2">
          <Label>Issue Date</Label>
          <Input 
            type="date"
            value={quoteData.issueDate}
            onChange={(e) => setQuoteData({...quoteData, issueDate: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <Label>Valid Through</Label>
          <Input 
            type="date"
            value={quoteData.validThrough}
            onChange={(e) => setQuoteData({...quoteData, validThrough: e.target.value})}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Sender Info */}
        <div className="space-y-3">
          <h3 className="font-semibold text-blue-600">SENDER</h3>
          <div className="space-y-2">
            <Input 
              placeholder="Company Name"
              value={quoteData.senderName}
              onChange={(e) => setQuoteData({...quoteData, senderName: e.target.value})}
            />
            <Input 
              placeholder="Address Line 1"
              value={quoteData.senderAddress1}
              onChange={(e) => setQuoteData({...quoteData, senderAddress1: e.target.value})}
            />
            <Input 
              placeholder="Address Line 2"
              value={quoteData.senderAddress2}
              onChange={(e) => setQuoteData({...quoteData, senderAddress2: e.target.value})}
            />
            <Input 
              placeholder="Address Line 3"
              value={quoteData.senderAddress3}
              onChange={(e) => setQuoteData({...quoteData, senderAddress3: e.target.value})}
            />
            <Input 
              placeholder="Phone Number"
              value={quoteData.senderPhone}
              onChange={(e) => setQuoteData({...quoteData, senderPhone: e.target.value})}
            />
            <Input 
              placeholder="Email"
              value={quoteData.senderEmail}
              onChange={(e) => setQuoteData({...quoteData, senderEmail: e.target.value})}
            />
          </div>
        </div>

        {/* Receiver Info */}
        <div className="space-y-3">
          <h3 className="font-semibold text-blue-600">RECEIVER</h3>
          <div className="space-y-2">
            <Input 
              placeholder="Company Name"
              value={quoteData.receiverName}
              onChange={(e) => setQuoteData({...quoteData, receiverName: e.target.value})}
            />
            <Input 
              placeholder="Address Line 1"
              value={quoteData.receiverAddress1}
              onChange={(e) => setQuoteData({...quoteData, receiverAddress1: e.target.value})}
            />
            <Input 
              placeholder="Address Line 2"
              value={quoteData.receiverAddress2}
              onChange={(e) => setQuoteData({...quoteData, receiverAddress2: e.target.value})}
            />
            <Input 
              placeholder="Address Line 3"
              value={quoteData.receiverAddress3}
              onChange={(e) => setQuoteData({...quoteData, receiverAddress3: e.target.value})}
            />
            <Input 
              placeholder="Phone Number"
              value={quoteData.receiverPhone}
              onChange={(e) => setQuoteData({...quoteData, receiverPhone: e.target.value})}
            />
            <Input 
              placeholder="Email"
              value={quoteData.receiverEmail}
              onChange={(e) => setQuoteData({...quoteData, receiverEmail: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Line Items</h3>
          <Button onClick={addLineItem} variant="outline" size="sm">
            <Plus className="size-4 mr-1" /> Add Item
          </Button>
        </div>
        
        <div className="space-y-2">
          {quoteData.lineItems.map((item) => (
            <div key={item.id} className="grid grid-cols-6 gap-2 items-end">
              <div className="col-span-2">
                <Input 
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                />
              </div>
              <div>
                <Input 
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(item.id, 'quantity', Number(e.target.value))}
                />
              </div>
              <div>
                <Input 
                  type="number"
                  placeholder="Unit Price"
                  value={item.unitPrice}
                  onChange={(e) => updateLineItem(item.id, 'unitPrice', Number(e.target.value))}
                />
              </div>
              <div>
                <Input 
                  type="number"
                  placeholder="Discount %"
                  value={item.discount || 0}
                  onChange={(e) => updateLineItem(item.id, 'discount', Number(e.target.value))}
                />
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => removeLineItem(item.id)}
                  disabled={quoteData.lineItems.length === 1}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Terms and Conditions</Label>
        <Textarea 
          rows={4}
          value={quoteData.termsAndConditions}
          onChange={(e) => setQuoteData({...quoteData, termsAndConditions: e.target.value})}
        />
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea 
          rows={2}
          value={quoteData.notes}
          onChange={(e) => setQuoteData({...quoteData, notes: e.target.value})}
        />
      </div>

      {/* Preview Section */}
      <Card className="border-2">
        <CardContent className="p-6">
          <div ref={quoteRef} className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="bg-gray-600 text-white py-3 px-6 text-xl font-semibold tracking-wide inline-block">
                TRANSPORT PRICE QUOTE
              </div>
            </div>

            {/* Two Columns */}
            <div className="grid grid-cols-2 gap-8">
              {/* Sender */}
              <div>
                <h4 className="text-blue-600 font-semibold text-sm mb-2">SENDER</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex">
                    <span className="w-28 font-semibold text-gray-600">Name:</span>
                    <span>{quoteData.senderName}</span>
                  </div>
                  <div className="flex">
                    <span className="w-28 font-semibold text-gray-600">Address:</span>
                    <span>{quoteData.senderAddress1}</span>
                  </div>
                  {quoteData.senderAddress2 && (
                    <div className="flex">
                      <span className="w-28 font-semibold text-gray-600">Address:</span>
                      <span>{quoteData.senderAddress2}</span>
                    </div>
                  )}
                  {quoteData.senderAddress3 && (
                    <div className="flex">
                      <span className="w-28 font-semibold text-gray-600">Address:</span>
                      <span>{quoteData.senderAddress3}</span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="w-28 font-semibold text-gray-600">Phone Number:</span>
                    <span>{quoteData.senderPhone}</span>
                  </div>
                  <div className="flex">
                    <span className="w-28 font-semibold text-gray-600">Email:</span>
                    <span>{quoteData.senderEmail}</span>
                  </div>
                </div>
              </div>

              {/* Receiver */}
              <div>
                <h4 className="text-blue-600 font-semibold text-sm mb-2">RECEIVER</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex">
                    <span className="w-28 font-semibold text-gray-600">Name:</span>
                    <span>{quoteData.receiverName || '[Company Name]'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-28 font-semibold text-gray-600">Address:</span>
                    <span>{quoteData.receiverAddress1 || '[Company Address]'}</span>
                  </div>
                  {quoteData.receiverAddress2 && (
                    <div className="flex">
                      <span className="w-28 font-semibold text-gray-600">Address:</span>
                      <span>{quoteData.receiverAddress2}</span>
                    </div>
                  )}
                  {quoteData.receiverAddress3 && (
                    <div className="flex">
                      <span className="w-28 font-semibold text-gray-600">Address:</span>
                      <span>{quoteData.receiverAddress3}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quote Meta */}
            <div className="flex gap-8 text-sm">
              <div className="flex">
                <span className="font-semibold mr-2">Quote Number:</span>
                <span className="text-gray-600">{quoteData.quoteNumber}</span>
              </div>
              <div className="flex">
                <span className="font-semibold mr-2">Issue Date:</span>
                <span className="text-gray-600">{format(new Date(quoteData.issueDate), 'MMMM dd, yyyy')}</span>
              </div>
              <div className="flex">
                <span className="font-semibold mr-2">Valid Through:</span>
                <span className="text-gray-600">{format(new Date(quoteData.validThrough), 'MMMM dd, yyyy')}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-600 text-white">
                  <th className="text-left p-2">DESCRIPTION</th>
                  <th className="text-center p-2">QTY</th>
                  <th className="text-right p-2">UNIT PRICE</th>
                  <th className="text-right p-2">SUBTOTAL</th>
                  <th className="text-right p-2">TAX</th>
                </tr>
              </thead>
              <tbody>
                {quoteData.lineItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-2">{item.description}</td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="p-2 text-right">{formatCurrency(calculateSubtotal(item))}</td>
                    <td className="p-2 text-right">{formatCurrency(calculateTax(item))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="space-y-2">
                <div className="flex justify-between gap-8">
                  <span className="font-semibold">Subtotal</span>
                  <span>{formatCurrency(totalSubtotal)}</span>
                </div>
                <div className="flex justify-between gap-8">
                  <span className="font-semibold">Tax ({quoteData.taxRate}%)</span>
                  <span>{formatCurrency(totalTax)}</span>
                </div>
                <div className="flex justify-between gap-8 bg-green-600 text-white px-4 py-2 font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div>
              <h4 className="text-blue-600 font-semibold text-sm mb-2">Terms and Conditions</h4>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">
                {quoteData.termsAndConditions}
              </pre>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 pt-4 border-t">
              Generated by Calvary Connect Ltd. | {format(new Date(), 'MMMM dd, yyyy')}
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
          Print / Save as PDF
        </Button>
      </div>
    </div>
  );
}
