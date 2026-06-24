"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Receipt, Printer, Download, CheckCircle2, AlertCircle,
  FileText, DollarSign, Building2, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// ─── Company Info ─────────────────────────────────────────────────────────────
const COMPANY = {
  name:    "Calvary Investment Company Ltd",
  address: "P.O. Box 75941, Dar es Salaam, Tanzania",
  phone:   "+255 XXX XXX XXX",
  email:   "accounts@calvary.co.tz",
  tin:     "XXX-XXX-XXX",
  vrn:     "XX-XXXXXX-X",      // VAT Registration Number
  bank:    "CRDB Bank PLC — Account No: XXXXXXXXXXXXXXX",
};

// Tanzania VAT rates
const VAT_RATE   = 0.18;  // 18% VAT
const WHT_RATE   = 0.05;  // 5% Withholding Tax (transport services)
const WHT_EXEMPT = 500000; // WHT not applicable below TZS 500,000

function buildInvoiceHTML(invoice: any, client: any, lineItems: LineItem[]): string {
  const subtotal = lineItems.reduce((s, l) => s + (l.qty * l.unit_price), 0);
  const vatAmount = invoice.vat_applicable ? subtotal * VAT_RATE : 0;
  const totalBeforeWHT = subtotal + vatAmount;
  const whtAmount = (invoice.wht_applicable && totalBeforeWHT > WHT_EXEMPT)
    ? subtotal * WHT_RATE
    : 0;
  const totalPayable = totalBeforeWHT - whtAmount;

  const statusStamp = invoice.status === "paid"
    ? `<div style="position:absolute;top:220px;right:60px;transform:rotate(-20deg);border:3px solid #059669;color:#059669;padding:8px 20px;font-size:24px;font-weight:900;letter-spacing:4px;opacity:0.2;border-radius:4px">PAID</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Tax Invoice — ${invoice.invoice_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 20px; }
    .page { max-width: 794px; margin: 0 auto; border: 1px solid #ccc; position: relative; }

    /* Header */
    .header { background: #1e3a5f; color: #fff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .company-name { font-size: 17px; font-weight: 800; }
    .company-sub { font-size: 9.5px; opacity: 0.75; line-height: 1.5; margin-top: 3px; }
    .invoice-meta { text-align: right; }
    .invoice-type { font-size: 22px; font-weight: 900; letter-spacing: 2px; color: #fbbf24; }
    .invoice-sub { font-size: 10px; color: #93c5fd; margin-top: 3px; }

    /* TRA Notice */
    .tra-notice { background: #fef3c7; border-bottom: 2px solid #f59e0b; padding: 5px 24px; font-size: 9px; font-weight: 700; color: #92400e; text-align: center; letter-spacing: 1px; text-transform: uppercase; }

    /* Body */
    .body-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #e5e7eb; }
    .billed-to, .invoice-details { padding: 14px 24px; }
    .invoice-details { border-left: 1px solid #e5e7eb; }
    .section-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #1e3a5f; margin-bottom: 8px; }
    .field { margin-bottom: 5px; }
    .field-key { font-size: 9px; color: #6b7280; font-weight: 600; text-transform: uppercase; }
    .field-val { font-size: 12px; font-weight: 600; color: #111; }

    /* Line Items */
    .items-section { padding: 0 24px 16px; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .items-table th { background: #1e3a5f; color: #fff; padding: 7px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
    .items-table td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
    .items-table tr:nth-child(even) td { background: #f9fafb; }
    .text-right { text-align: right; }

    /* Totals */
    .totals-section { padding: 0 24px 16px; display: flex; justify-content: flex-end; }
    .totals-table { width: 280px; border-collapse: collapse; }
    .totals-table td { padding: 5px 8px; font-size: 11px; }
    .totals-table .total-row td { border-top: 2px solid #1e3a5f; font-weight: 800; font-size: 13px; color: #1e3a5f; background: #f0f4ff; }
    .totals-table .subtotal-row td { border-top: 1px solid #e5e7eb; }
    .tax-label { font-size: 9px; color: #6b7280; font-style: italic; }

    /* Notes */
    .notes-section { padding: 10px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 10px; color: #374151; line-height: 1.6; }
    .notes-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #1e3a5f; margin-bottom: 4px; }

    /* Footer */
    .footer { background: #1e3a5f; color: #fff; padding: 10px 24px; text-align: center; font-size: 9px; opacity: 0.9; line-height: 1.5; }

    @media print { body { padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
<div class="page">
  ${statusStamp}

  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">${COMPANY.name}</div>
      <div class="company-sub">
        ${COMPANY.address}<br/>
        Tel: ${COMPANY.phone} · ${COMPANY.email}<br/>
        <strong>TIN: ${COMPANY.tin}</strong> &nbsp;|&nbsp; <strong>VRN: ${COMPANY.vrn}</strong>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-type">TAX INVOICE</div>
      <div class="invoice-sub">No. <strong>${invoice.invoice_number}</strong></div>
      <div style="font-size:10px;color:#d1d5db;margin-top:4px">Date: ${format(new Date(invoice.created_at || new Date()), "dd/MM/yyyy")}</div>
      <div style="font-size:10px;color:#d1d5db">Due: ${format(new Date(invoice.due_date || new Date()), "dd/MM/yyyy")}</div>
    </div>
  </div>

  <!-- TRA Notice -->
  <div class="tra-notice">✅ TRA-Compliant Tax Invoice — VAT Registration No. ${COMPANY.vrn} — Tanzania Revenue Authority</div>

  <!-- Bill To + Invoice Details -->
  <div class="body-grid">
    <div class="billed-to">
      <div class="section-label">Bill To</div>
      <div class="field">
        <div class="field-key">Company</div>
        <div class="field-val">${client?.company_name || invoice.customer_name || "—"}</div>
      </div>
      <div class="field">
        <div class="field-key">Address</div>
        <div class="field-val">${client?.address || "—"}</div>
      </div>
      <div class="field">
        <div class="field-key">Contact</div>
        <div class="field-val">${client?.contact_person || "—"}</div>
      </div>
      <div class="field">
        <div class="field-key">Phone</div>
        <div class="field-val">${client?.phone || "—"}</div>
      </div>
      <div class="field">
        <div class="field-key">TIN (Client)</div>
        <div class="field-val">${client?.tin || "—"}</div>
      </div>
    </div>
    <div class="invoice-details">
      <div class="section-label">Invoice Details</div>
      <div class="field">
        <div class="field-key">Invoice No.</div>
        <div class="field-val">${invoice.invoice_number}</div>
      </div>
      <div class="field">
        <div class="field-key">Invoice Date</div>
        <div class="field-val">${format(new Date(invoice.created_at || new Date()), "dd MMMM yyyy")}</div>
      </div>
      <div class="field">
        <div class="field-key">Payment Due</div>
        <div class="field-val" style="color:${new Date(invoice.due_date) < new Date() && invoice.status !== 'paid' ? '#dc2626' : '#111'}">${format(new Date(invoice.due_date || new Date()), "dd MMMM yyyy")}</div>
      </div>
      <div class="field">
        <div class="field-key">Payment Terms</div>
        <div class="field-val">${invoice.payment_terms || "Net 30 Days"}</div>
      </div>
      <div class="field">
        <div class="field-key">Currency</div>
        <div class="field-val">TZS — Tanzania Shilling</div>
      </div>
      ${invoice.trip_number ? `<div class="field"><div class="field-key">Trip Reference</div><div class="field-val">${invoice.trip_number}</div></div>` : ""}
    </div>
  </div>

  <!-- Line Items -->
  <div class="items-section">
    <div class="section-label" style="padding-top:12px">Services Rendered</div>
    <table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>From</th>
          <th>To</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Price (TZS)</th>
          <th class="text-right">Amount (TZS)</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${item.description}</td>
          <td>${item.origin || "—"}</td>
          <td>${item.destination || "—"}</td>
          <td class="text-right">${item.qty}</td>
          <td class="text-right">${Number(item.unit_price).toLocaleString()}</td>
          <td class="text-right"><strong>${Number(item.qty * item.unit_price).toLocaleString()}</strong></td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>

  <!-- Totals -->
  <div class="totals-section">
    <table class="totals-table">
      <tr class="subtotal-row">
        <td>Subtotal</td>
        <td class="text-right">TZS ${subtotal.toLocaleString()}</td>
      </tr>
      ${invoice.vat_applicable ? `
      <tr>
        <td>VAT (18%) <span class="tax-label">VRN: ${COMPANY.vrn}</span></td>
        <td class="text-right">TZS ${vatAmount.toLocaleString()}</td>
      </tr>` : `
      <tr><td style="color:#6b7280;font-size:9px">VAT: Exempt</td><td></td></tr>`}
      ${whtAmount > 0 ? `
      <tr>
        <td>WHT Deductible (5%) <span class="tax-label">Transport Services</span></td>
        <td class="text-right" style="color:#dc2626">(TZS ${whtAmount.toLocaleString()})</td>
      </tr>` : ""}
      <tr class="total-row">
        <td>TOTAL PAYABLE</td>
        <td class="text-right">TZS ${totalPayable.toLocaleString()}</td>
      </tr>
    </table>
  </div>

  <!-- Notes & Banking -->
  <div class="notes-section">
    <div class="notes-label">Payment Instructions</div>
    <p>${COMPANY.bank}</p>
    <p style="margin-top:4px">Please quote invoice number <strong>${invoice.invoice_number}</strong> when making payment. For queries contact ${COMPANY.email} or ${COMPANY.phone}.</p>
    ${invoice.notes ? `<p style="margin-top:6px;font-style:italic;color:#6b7280">Note: ${invoice.notes}</p>` : ""}
  </div>

  <!-- Footer -->
  <div class="footer">
    ${COMPANY.name} · TIN: ${COMPANY.tin} · VRN: ${COMPANY.vrn}<br/>
    This is a computer-generated tax invoice compliant with TRA Electronic Fiscal Device (EFD) regulations.<br/>
    Calvary Connect Fleet Management System
  </div>
</div>
</body>
</html>`;
}

// ─── Line Item type ───────────────────────────────────────────────────────────
interface LineItem {
  description: string;
  origin?: string;
  destination?: string;
  qty: number;
  unit_price: number;
}

// ─── Main Invoice Dialog ──────────────────────────────────────────────────────
interface TRAInvoiceDialogProps {
  invoice?: any;
  client?: any;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  mode?: "view" | "create";
}

export function TRAInvoiceDialog({ invoice: initialInvoice, client, open, onClose, onSaved, mode = "view" }: TRAInvoiceDialogProps) {
  const [saving, setSaving] = useState(false);
  const [vatApplicable, setVatApplicable] = useState(initialInvoice?.vat_applicable ?? true);
  const [whtApplicable, setWhtApplicable] = useState(initialInvoice?.wht_applicable ?? true);
  const [paymentTerms, setPaymentTerms] = useState(initialInvoice?.payment_terms || "Net 30 Days");
  const [notes, setNotes] = useState(initialInvoice?.notes || "");
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialInvoice?.line_items || [
      { description: "Road Freight Transportation Services", origin: initialInvoice?.origin || "", destination: initialInvoice?.destination || "", qty: 1, unit_price: initialInvoice?.amount || 0 }
    ]
  );

  const invoiceData = {
    ...(initialInvoice || {}),
    vat_applicable: vatApplicable,
    wht_applicable: whtApplicable,
    payment_terms: paymentTerms,
    notes,
    line_items: lineItems,
  };

  const subtotal = lineItems.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const vatAmount = vatApplicable ? subtotal * VAT_RATE : 0;
  const totalBeforeWHT = subtotal + vatAmount;
  const whtAmount = (whtApplicable && totalBeforeWHT > WHT_EXEMPT) ? subtotal * WHT_RATE : 0;
  const totalPayable = totalBeforeWHT - whtAmount;

  const printInvoice = () => {
    const html = buildInvoiceHTML(invoiceData, client, lineItems);
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const downloadInvoice = () => {
    const html = buildInvoiceHTML(invoiceData, client, lineItems);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${invoiceData.invoice_number || "draft"}-${format(new Date(), "yyyyMMdd")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveInvoice = async () => {
    if (!initialInvoice?.id) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("invoices")
        .update({
          vat_applicable: vatApplicable,
          wht_applicable: whtApplicable,
          payment_terms: paymentTerms,
          notes,
          vat_amount: vatAmount,
          wht_amount: whtAmount,
          total_payable: totalPayable,
          updated_at: new Date().toISOString(),
        })
        .eq("id", initialInvoice.id);
      if (error) throw error;
      toast({ title: "Invoice Saved", description: "Tax settings updated." });
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateLineItem = (i: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-blue-600" />
            TRA Tax Invoice — {initialInvoice?.invoice_number || "New Invoice"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Client & Invoice Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1 bg-slate-50 rounded-xl p-3 border">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Bill To</p>
              <p className="font-bold">{client?.company_name || initialInvoice?.customer_name || "—"}</p>
              <p className="text-slate-500">{client?.address || "—"}</p>
              <p className="text-slate-500">TIN: {client?.tin || "—"}</p>
            </div>
            <div className="space-y-1 bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Invoice</p>
              <p className="font-bold text-blue-800">{initialInvoice?.invoice_number || "—"}</p>
              <p className="text-slate-600">Due: {initialInvoice?.due_date ? format(new Date(initialInvoice.due_date), "dd MMM yyyy") : "—"}</p>
              <Badge className={cn("text-xs", initialInvoice?.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                {initialInvoice?.status || "pending"}
              </Badge>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Service Line Items</p>
            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-xl p-3 bg-slate-50">
                <div className="col-span-5 space-y-1">
                  <Label className="text-[10px]">Description</Label>
                  <Input value={item.description} onChange={e => updateLineItem(i, "description", e.target.value)} className="text-xs h-8" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px]">From</Label>
                  <Input value={item.origin || ""} onChange={e => updateLineItem(i, "origin", e.target.value)} className="text-xs h-8" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px]">To</Label>
                  <Input value={item.destination || ""} onChange={e => updateLineItem(i, "destination", e.target.value)} className="text-xs h-8" />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label className="text-[10px]">Qty</Label>
                  <Input type="number" value={item.qty} onChange={e => updateLineItem(i, "qty", +e.target.value)} className="text-xs h-8" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px]">Unit Price</Label>
                  <Input type="number" value={item.unit_price} onChange={e => updateLineItem(i, "unit_price", +e.target.value)} className="text-xs h-8" />
                </div>
              </div>
            ))}
          </div>

          {/* Tanzania Tax Settings */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
              <Building2 className="size-4" /> Tanzania Tax Settings (TRA)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vatApplicable}
                  onChange={e => setVatApplicable(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">Apply VAT (18%)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whtApplicable}
                  onChange={e => setWhtApplicable(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">WHT Deductible (5%)</span>
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment Terms</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Net 7 Days">Net 7 Days</SelectItem>
                  <SelectItem value="Net 14 Days">Net 14 Days</SelectItem>
                  <SelectItem value="Net 30 Days">Net 30 Days</SelectItem>
                  <SelectItem value="Net 45 Days">Net 45 Days</SelectItem>
                  <SelectItem value="COD">Cash on Delivery</SelectItem>
                  <SelectItem value="Prepaid">Prepaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Totals Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-medium">TZS {subtotal.toLocaleString()}</span>
            </div>
            {vatApplicable && (
              <div className="flex justify-between">
                <span className="text-slate-600">VAT (18%)</span>
                <span className="font-medium">TZS {vatAmount.toLocaleString()}</span>
              </div>
            )}
            {whtAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>WHT Deductible (5%)</span>
                <span className="font-medium">(TZS {whtAmount.toLocaleString()})</span>
              </div>
            )}
            <div className="flex justify-between font-black text-blue-800 border-t border-blue-200 pt-1.5 text-base">
              <span>TOTAL PAYABLE</span>
              <span>TZS {totalPayable.toLocaleString()}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Invoice Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment instructions, special notes…" rows={2} className="text-sm" />
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2">
            {initialInvoice?.id && (
              <Button onClick={saveInvoice} variant="outline" disabled={saving}>
                {saving ? <RefreshCw className="size-4 mr-1 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
                Save
              </Button>
            )}
            <Button onClick={printInvoice} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="size-4 mr-1" />Print Invoice
            </Button>
            <Button onClick={downloadInvoice} variant="outline">
              <Download className="size-4 mr-1" />Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
