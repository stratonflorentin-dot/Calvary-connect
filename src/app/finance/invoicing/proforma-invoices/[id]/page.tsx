"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { downloadDocumentPdf, fetchLogoDataUrl, DocumentCompanyInfo } from "@/lib/finance/document-pdf";
import {
  ArrowLeft, ArrowRight, Ban, Copy, FileText, Loader2, Send as SendIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  sent: { label: "Sent", className: "bg-info/10 text-info border-info/20" },
  accepted: { label: "Accepted", className: "bg-success/10 text-success border-success/20" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
  converted: { label: "Converted", className: "bg-primary/10 text-primary border-primary/20" },
};

export default function ProformaInvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { role, hasPermission } = useRole();
  const { user } = useSupabase();
  const { toast } = useToast();

  const [pf, setPf] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [convertedInvoice, setConvertedInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);
  const [settings, setSettings] = useState<DocumentCompanyInfo>({});

  const load = async () => {
    setLoading(true);
    const { data: p } = await supabase.from("proforma_invoices").select("*").eq("id", id).maybeSingle();
    setPf(p);
    if (p?.customer_id) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", p.customer_id).maybeSingle();
      setCustomer(c);
    }
    if (p?.converted_invoice_id) {
      const { data: inv } = await supabase.from("invoices").select("id, invoice_number, status").eq("id", p.converted_invoice_id).maybeSingle();
      setConvertedInvoice(inv);
    } else {
      setConvertedInvoice(null);
    }
    const { data: l } = await supabase.from("proforma_invoice_lines").select("*").eq("proforma_invoice_id", id).order("line_number");
    setLines(l ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  useEffect(() => {
    supabase.from("company_settings")
      .select("company_name, tagline, vat_registration, tax_id, phone, email, address, bank_name, bank_account_name, bank_account_number_tzs, bank_account_number_usd, bank_branch_code, bank_swift_code, logo_url")
      .limit(1).maybeSingle().then(async ({ data }) => {
        if (!data) return;
        setSettings(data);
        const logoDataUrl = await fetchLogoDataUrl((data as any).logo_url);
        if (logoDataUrl) setSettings((s) => ({ ...s, logoDataUrl }));
      });
  }, []);

  const canManage = hasPermission(["CEO", "ADMIN", "SALESMAN", "ACCOUNTANT"]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const effectiveStatus = pf && ["draft", "sent"].includes(pf.status) && pf.valid_until && pf.valid_until < todayStr ? "expired" : pf?.status;
  const meta = STATUS_META[effectiveStatus] ?? STATUS_META.draft;
  const currency = pf?.currency || "TZS";

  const downloadPdf = () => {
    if (!pf) return;
    downloadDocumentPdf({
      kind: "proforma_invoice",
      number: pf.proforma_number,
      dateIssued: pf.issue_date,
      dueOrValidUntil: pf.valid_until,
      status: effectiveStatus,
      company: settings,
      customer: {
        name: customer?.company_name ?? pf.customer_name ?? "",
        email: customer?.email, phone: customer?.phone,
        vrn: customer?.vrn, tin: customer?.tax_id,
      },
      paymentTerms: pf.payment_terms, currency, fxRateToTzs: null,
      vatRate: pf.vat_rate, zeroRated: pf.zero_rated_vat, subtotal: pf.subtotal, vatAmount: pf.vat_amount, total: pf.total_amount,
      lines: lines.map((l) => ({
        description: l.description, item_type_label: l.item_type, quantity: Number(l.quantity) || 1,
        duration_days: l.duration_days, unit_price: Number(l.unit_price) || 0, line_total: Number(l.line_total) || 0,
      })),
      termsConditions: pf.terms_conditions,
    });
  };

  const sendProforma = async () => {
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/proforma-invoices/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send");
      toast({ variant: "success", title: json.emailSent ? "Proforma sent" : "Marked as sent", description: json.emailSent ? `Emailed to ${customer?.email}` : json.emailError });
      load();
    } catch (err: any) {
      toast({ title: "Couldn't send", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    if (!pf) return;
    setBusy(true);
    try {
      const { data: proformaNumber } = await supabase.rpc("next_doc_number", { p_type: "proforma_invoice" });
      const { data: copy, error } = await supabase.from("proforma_invoices").insert({
        proforma_number: proformaNumber,
        customer_id: pf.customer_id, customer_name: pf.customer_name, customer_reference: pf.customer_reference,
        quotation_id: pf.quotation_id,
        issue_date: new Date().toISOString().slice(0, 10),
        valid_until: pf.valid_until, currency: pf.currency,
        vat_applicable: pf.vat_applicable, zero_rated_vat: pf.zero_rated_vat,
        subtotal: pf.subtotal, vat_rate: pf.vat_rate, vat_amount: pf.vat_amount, total_amount: pf.total_amount,
        payment_terms: pf.payment_terms, billing_address: pf.billing_address, delivery_address: pf.delivery_address,
        notes: pf.notes, terms_conditions: pf.terms_conditions,
        status: "draft", created_by: user?.id ?? null,
      }).select().single();
      if (error) throw error;

      if (lines.length > 0) {
        await supabase.from("proforma_invoice_lines").insert(
          lines.map((l) => ({
            proforma_invoice_id: copy.id, line_number: l.line_number, item_type: l.item_type,
            description: l.description, quantity: l.quantity, duration_days: l.duration_days,
            unit_price: l.unit_price, line_total: l.line_total,
          })),
        );
      }
      toast({ variant: "success", title: "Duplicated", description: `Created ${copy.proforma_number} as a new draft` });
      router.push(`/finance/invoicing/proforma-invoices/${copy.id}`);
    } catch (err: any) {
      toast({ title: "Couldn't duplicate", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const submitCancel = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("cancel_proforma_invoice", { p_proforma_id: id, p_reason: cancelReason || null });
      if (error) throw error;
      toast({ variant: "success", title: "Proforma invoice cancelled" });
      setCancelOpen(false);
      setCancelReason("");
      load();
    } catch (err: any) {
      toast({ title: "Couldn't cancel", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const submitConvert = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("convert_proforma_invoice", { p_proforma_id: id });
      if (error) throw error;
      toast({ variant: "success", title: "Converted to invoice", description: (data as any)?.invoice_number });
      setConvertOpen(false);
      router.push(`/finance/invoicing/customer-invoices/${(data as any).id}`);
    } catch (err: any) {
      toast({ title: "Couldn't convert", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!pf) return <div className="p-8 text-center text-muted-foreground">Proforma invoice not found.</div>;
  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6 pb-8">
          <Link href="/finance/invoicing/proforma-invoices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> All Proforma Invoices
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-foreground font-mono">{pf.proforma_number}</h1>
                <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {customer?.company_name ?? pf.customer_name ?? "—"} · Issued {new Date(pf.issue_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                {pf.valid_until && ` · Valid until ${new Date(pf.valid_until).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadPdf} className="gap-2"><FileText className="size-4" /> Download PDF</Button>
              {canManage && effectiveStatus !== "converted" && effectiveStatus !== "cancelled" && (
                <Button variant="outline" size="sm" onClick={sendProforma} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <SendIcon className="size-4" />} Send
                </Button>
              )}
              {canManage && (
                <Button variant="outline" size="sm" onClick={duplicate} disabled={busy} className="gap-2">
                  <Copy className="size-4" /> Duplicate
                </Button>
              )}
              {canManage && effectiveStatus === "converted" && convertedInvoice && (
                <Button asChild size="sm" className="gap-2">
                  <Link href={`/finance/invoicing/customer-invoices/${convertedInvoice.id}`}>
                    <ArrowRight className="size-4" /> View Invoice {convertedInvoice.invoice_number}
                  </Link>
                </Button>
              )}
              {canManage && effectiveStatus !== "converted" && effectiveStatus !== "cancelled" && (
                <Button size="sm" onClick={() => setConvertOpen(true)} className="gap-2 bg-primary hover:bg-primary/90">
                  <ArrowRight className="size-4" /> Convert to Invoice
                </Button>
              )}
              {canManage && effectiveStatus !== "converted" && effectiveStatus !== "cancelled" && (
                <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)} className="gap-2 text-destructive border-destructive/30">
                  <Ban className="size-4" /> Cancel
                </Button>
              )}
            </div>
          </div>

          {effectiveStatus === "converted" && convertedInvoice && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-foreground flex items-center gap-2">
              <ArrowRight className="size-4 text-primary shrink-0" />
              Converted to invoice <Link href={`/finance/invoicing/customer-invoices/${convertedInvoice.id}`} className="font-bold text-primary hover:underline">{convertedInvoice.invoice_number}</Link>
              {pf.converted_at && ` on ${new Date(pf.converted_at).toLocaleString()}`}
            </div>
          )}
          {effectiveStatus === "cancelled" && (
            <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-xs text-foreground">
              Cancelled {pf.cancelled_at && `on ${new Date(pf.cancelled_at).toLocaleString()}`}{pf.cancel_reason && ` — ${pf.cancel_reason}`}
            </div>
          )}
          {effectiveStatus !== "converted" && (
            <div className="rounded-xl bg-muted/30 border border-border p-3 text-xs text-muted-foreground">
              This is a preliminary commercial document. It does not create revenue, accounts receivable, or a journal entry — that only happens once it's converted to a real invoice.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="font-black text-sm text-foreground">Items</h2>
                  <span className="text-xs text-muted-foreground">{lines.length} item{lines.length === 1 ? "" : "s"}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <tr><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Unit Price</th><th className="px-4 py-2 text-right">Days</th><th className="px-4 py-2 text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="px-4 py-2 text-foreground">{l.description}</td>
                        <td className="px-4 py-2 text-right">{l.quantity}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatCurrency(Number(l.unit_price) || 0, currency)}</td>
                        <td className="px-4 py-2 text-right">{l.duration_days || "—"}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold">{formatCurrency(Number(l.line_total) || 0, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4 border-t border-border ml-auto max-w-xs space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-bold text-foreground">{formatCurrency(pf.subtotal, currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span className={cn("font-bold", pf.zero_rated_vat ? "text-success" : "text-foreground")}>{pf.zero_rated_vat ? "Zero Rated (0%)" : formatCurrency(pf.vat_amount, currency)}</span></div>
                  <div className="flex justify-between font-black text-base pt-2 border-t border-border"><span>Total</span><span>{formatCurrency(pf.total_amount, currency)}</span></div>
                </div>
              </div>

              {(pf.notes || pf.terms_conditions) && (
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  {pf.notes && (
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Notes</p><p className="text-sm text-foreground mt-1">{pf.notes}</p></div>
                  )}
                  {pf.terms_conditions && (
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Terms & Conditions</p><p className="text-sm text-foreground mt-1 whitespace-pre-line">{pf.terms_conditions}</p></div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h2 className="font-black text-sm text-foreground">Details</h2>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Client</p>
                  <p className="font-bold text-foreground">{customer?.company_name ?? pf.customer_name ?? "—"}</p>
                  {customer?.vrn && <p className="text-xs text-muted-foreground">VRN: {customer.vrn}</p>}
                  {customer?.tax_id && <p className="text-xs text-muted-foreground">TIN: {customer.tax_id}</p>}
                  {customer?.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                </div>
                {pf.customer_reference && (
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Customer Reference</p><p className="text-foreground text-sm">{pf.customer_reference}</p></div>
                )}
                {pf.payment_terms && (
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Payment Terms</p><p className="text-foreground text-sm">{pf.payment_terms}</p></div>
                )}
                {pf.billing_address && (
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Billing Address</p><p className="text-foreground text-sm">{pf.billing_address}</p></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Convert confirmation */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Convert Proforma Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-foreground font-mono font-bold">{pf.proforma_number}</p>
            <div className="text-sm text-muted-foreground">
              Customer: <span className="text-foreground font-medium">{customer?.company_name ?? pf.customer_name}</span><br />
              Total: <span className="text-foreground font-medium">{formatCurrency(pf.total_amount, currency)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Converting this proforma will create a final invoice. The proforma will become <span className="font-bold">Converted</span> and cannot be converted again.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setConvertOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={submitConvert} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Convert to Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Cancel Proforma Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">This keeps the document on record for audit purposes but marks it as cancelled.</p>
            <div className="space-y-1"><Label className="text-xs">Reason (optional)</Label><Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={busy}>Back</Button>
              <Button onClick={submitCancel} disabled={busy} variant="destructive" className="gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Cancel Proforma
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
