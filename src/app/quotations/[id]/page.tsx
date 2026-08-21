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
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { downloadDocumentPdf, fetchLogoDataUrl, DocumentCompanyInfo } from "@/lib/finance/document-pdf";
import { getRate } from "@/lib/finance/fx";
import { cn } from "@/lib/utils";
import { ArrowLeft, Copy, Download, FileText, Loader2, Send } from "lucide-react";

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-info/10 text-info border-info/20",
  viewed: "bg-warning/10 text-warning border-warning/20",
  accepted: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  expired: "bg-muted text-muted-foreground border-border",
};

export default function QuotationDetailPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [quotation, setQuotation] = useState<any | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [company, setCompany] = useState<DocumentCompanyInfo>({});
  const [fxRate, setFxRate] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("company_settings")
      .select("company_name, tagline, vat_registration, tax_id, phone, email, address, bank_name, bank_account_name, bank_account_number_tzs, bank_account_number_usd, bank_branch_code, bank_swift_code, logo_url")
      .limit(1).maybeSingle().then(async ({ data }) => {
        if (!data) return;
        setCompany(data);
        const logoDataUrl = await fetchLogoDataUrl((data as any).logo_url);
        if (logoDataUrl) setCompany((c) => ({ ...c, logoDataUrl }));
      });
  }, []);

  useEffect(() => {
    if (!quotation || !quotation.currency || quotation.currency === "TZS") { setFxRate(null); return; }
    getRate(quotation.currency, "TZS").then(setFxRate).catch(() => setFxRate(null));
  }, [quotation?.currency]);

  const load = async () => {
    setLoading(true);
    const { data: q } = await supabase.from("quotations").select("*, customer:customer_id(company_name, contact_person, email, phone, vrn, tax_id)").eq("id", id).maybeSingle();
    setQuotation(q);
    if (q) {
      const { data: l } = await supabase.from("quotation_lines").select("*").eq("quotation_id", id).order("line_number");
      setLines(l ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const send = async () => {
    if (!quotation) return;
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/quotations/${quotation.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ email: quotation.customer?.email, customerName: quotation.customer?.company_name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.emailSent) {
        toast({ variant: "success", title: "Quotation sent", description: `Emailed to ${quotation.customer?.email}` });
      } else {
        await navigator.clipboard?.writeText(json.link).catch(() => {});
        toast({
          variant: "success",
          title: "Quotation sent",
          description: `Email wasn't sent (${json.emailError || "not configured"}) — link copied, share it directly: ${json.link}`,
        });
      }
      load();
    } catch (err: any) {
      toast({ title: "Couldn't send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const convertToShipment = async () => {
    if (!quotation || quotation.shipment_id) return;
    setConverting(true);
    try {
      const { data: shipmentNumber } = await supabase.rpc("next_doc_number", { p_type: "shipment" });
      const { data: shipment, error: shipErr } = await supabase
        .from("shipments")
        .insert({
          shipment_number: shipmentNumber || `SH-${Date.now().toString().slice(-6)}`,
          quotation_id: quotation.id,
          customer_id: quotation.customer_id,
          origin_city: quotation.origin,
          destination_city: quotation.destination,
          quoted_amount: quotation.total_amount,
          currency: quotation.currency,
          status: "created",
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (shipErr) throw shipErr;
      await supabase.from("quotations").update({ shipment_id: shipment.id }).eq("id", quotation.id);
      toast({ variant: "success", title: "Shipment created", description: shipment.shipment_number });
      router.push(`/shipments/${shipment.id}`);
    } catch (err: any) {
      toast({ title: "Couldn't create shipment", description: err.message, variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  const duplicate = async () => {
    if (!quotation) return;
    const { data: quotationNumber } = await supabase.rpc("next_doc_number", { p_type: "quotation" });
    const { data: copy, error } = await supabase.from("quotations").insert({
      quotation_number: quotationNumber,
      customer_id: quotation.customer_id,
      contact_person: quotation.contact_person,
      quotation_date: new Date().toISOString().slice(0, 10),
      expiry_date: quotation.valid_until,
      valid_until: quotation.valid_until,
      origin: quotation.origin, destination: quotation.destination,
      subtotal: quotation.subtotal, vat_rate: quotation.vat_rate, zero_rated_vat: quotation.zero_rated_vat,
      vat_amount: quotation.vat_amount, total_amount: quotation.total_amount, amount: quotation.total_amount,
      currency: quotation.currency, payment_terms: quotation.payment_terms, terms_conditions: quotation.terms_conditions,
      internal_notes: quotation.internal_notes, status: "draft", created_by: user?.id ?? null,
    }).select().single();
    if (error) { toast({ title: "Duplicate failed", description: error.message, variant: "destructive" }); return; }
    const lineRows = lines.map((l) => ({ quotation_id: copy.id, line_number: l.line_number, service_type: l.service_type, description: l.description, quantity: l.quantity, duration_days: l.duration_days, unit_price: l.unit_price, line_total: l.line_total }));
    if (lineRows.length) await supabase.from("quotation_lines").insert(lineRows);
    toast({ variant: "success", title: "Duplicated as draft", description: copy.quotation_number });
    router.push(`/quotations/${copy.id}`);
  };

  const [pdfBusy, setPdfBusy] = useState(false);

  const pdf = () => {
    if (!quotation) return;
    // Deferred past the next paint so the button's own busy state renders
    // before jsPDF's synchronous document build blocks the main thread —
    // that block is exactly what trips Chrome's INP warning otherwise.
    setPdfBusy(true);
    setTimeout(() => {
      try {
        downloadDocumentPdf({
          kind: "quotation",
          number: quotation.quotation_number,
          dateIssued: quotation.quotation_date,
          dueOrValidUntil: quotation.valid_until,
          status: quotation.status,
          company,
          customer: {
            name: quotation.customer?.company_name ?? quotation.contact_person ?? "",
            email: quotation.customer?.email, phone: quotation.customer?.phone,
            vrn: quotation.customer?.vrn, tin: quotation.customer?.tax_id,
          },
          paymentTerms: quotation.payment_terms, currency: quotation.currency || "TZS", fxRateToTzs: fxRate,
          vatRate: Number(quotation.vat_rate) || 0, zeroRated: !!quotation.zero_rated_vat,
          subtotal: Number(quotation.subtotal) || 0, vatAmount: Number(quotation.vat_amount) || 0, total: Number(quotation.total_amount) || 0,
          lines: lines.map((l) => ({ description: l.description, item_type_label: l.service_type, quantity: l.quantity, duration_days: l.duration_days, unit_price: l.unit_price, line_total: l.line_total })),
          termsConditions: quotation.terms_conditions,
        });
      } finally {
        setPdfBusy(false);
      }
    }, 0);
  };

  if (!role) return null;
  if (loading) return (
    <div className="flex min-h-screen bg-background"><Sidebar role={role} /><main className="flex-1 flex items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></main></div>
  );
  if (!quotation) return (
    <div className="flex min-h-screen bg-background"><Sidebar role={role} /><main className="flex-1 p-8 text-center text-muted-foreground">Quotation not found.</main></div>
  );

  const publicLink = typeof window !== "undefined" ? `${window.location.origin}/q/${quotation.public_token}` : "";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Link href="/quotations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to Quotations
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {["draft", "sent"].includes(quotation.status) && (
              <Button onClick={send} disabled={sending} size="sm" className="gap-2">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send to Customer
              </Button>
            )}
            <Button onClick={duplicate} variant="outline" size="sm" className="gap-2"><Copy className="size-4" /> Duplicate</Button>
            <Button onClick={pdf} variant="outline" size="sm" className="gap-2" disabled={pdfBusy}>
              {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} PDF
            </Button>
          </div>

          {quotation.status !== "draft" && (
            <div className="rounded-xl bg-muted/30 border border-border p-3 text-xs text-muted-foreground">
              Customer link: <a href={publicLink} target="_blank" rel="noreferrer" className="text-primary hover:underline font-mono">{publicLink}</a>
            </div>
          )}

          {quotation.status === "accepted" && (
            <div className="rounded-xl bg-success/10 border border-success/20 p-3 text-xs flex items-center justify-between gap-3">
              {quotation.shipment_id ? (
                <>
                  <span className="text-success font-bold">Accepted — converted to a shipment.</span>
                  <Link href={`/shipments/${quotation.shipment_id}`} className="text-primary hover:underline font-bold">View Shipment →</Link>
                </>
              ) : (
                <>
                  <span className="text-success">Accepted, but no shipment was created (auto-create may have failed).</span>
                  <Button size="sm" variant="outline" onClick={convertToShipment} disabled={converting} className="gap-2">
                    {converting ? <Loader2 className="size-3.5 animate-spin" /> : null} Convert to Shipment
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Letterhead — mirrors the real reference document (QT-2026-0001.pdf) field-for-field */}
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
            <div className="flex justify-between items-start gap-4">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-widest">QUOTATION</h1>
              {company.logoDataUrl && (
                <img src={company.logoDataUrl} alt="Company logo" className="h-14 w-auto max-w-[130px] object-contain shrink-0" />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="text-sm">
                <p className="font-black text-foreground">{company.company_name || "Company"}</p>
                {company.tagline && <p className="text-muted-foreground text-xs">{company.tagline}</p>}
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {company.vat_registration && <p><span className="font-bold text-foreground">VRN:</span> {company.vat_registration}</p>}
                  {company.tax_id && <p><span className="font-bold text-foreground">TIN:</span> {company.tax_id}</p>}
                  {company.phone && <p><span className="font-bold text-foreground">Phone:</span> {company.phone}</p>}
                  {company.email && <p><span className="font-bold text-foreground">Email:</span> {company.email}</p>}
                  {company.address && <p>{company.address}</p>}
                </div>
              </div>
              <div className="text-sm sm:text-right space-y-0.5">
                <p><span className="text-muted-foreground">Quote No:</span> <span className="font-bold text-foreground font-mono">{quotation.quotation_number}</span></p>
                <p><span className="text-muted-foreground">Date Issued:</span> <span className="font-bold text-foreground">{quotation.quotation_date ? new Date(quotation.quotation_date).toLocaleDateString("en-GB") : quotation.created_at ? new Date(quotation.created_at).toLocaleDateString("en-GB") : "—"}</span></p>
                <p><span className="text-muted-foreground">Valid Until:</span> <span className="font-bold text-foreground">{quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString("en-GB") : "—"}</span></p>
                <p><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={cn("ml-1", STATUS_BADGES[quotation.status] ?? "")}>{quotation.status}</Badge></p>
              </div>
            </div>

            <div className="border-t border-border my-4" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="text-sm">
                <p className="text-destructive font-black text-xs uppercase tracking-widest">Prepared For:</p>
                <p className="font-black text-foreground mt-1">{quotation.customer?.company_name ?? quotation.contact_person ?? "—"}</p>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {quotation.customer?.vrn && <p><span className="font-bold text-foreground">VRN:</span> {quotation.customer.vrn}</p>}
                  {quotation.customer?.tax_id && <p><span className="font-bold text-foreground">TIN:</span> {quotation.customer.tax_id}</p>}
                  {quotation.customer?.email && <p><span className="font-bold text-foreground">Email:</span> {quotation.customer.email}</p>}
                  {quotation.customer?.phone && <p><span className="font-bold text-foreground">Phone:</span> {quotation.customer.phone}</p>}
                </div>
              </div>
              <div className="text-sm sm:text-right space-y-0.5">
                {quotation.payment_terms && <p><span className="text-muted-foreground">Pay. Terms:</span> <span className="font-bold text-foreground">{quotation.payment_terms}</span></p>}
                <p><span className="text-muted-foreground">Currency:</span> <span className="font-bold text-foreground">{quotation.currency}{fxRate ? ` (Rate: ${fxRate.toLocaleString()} TZS)` : ""}</span></p>
                <p><span className="text-muted-foreground">VAT Status:</span> <span className={cn("font-bold", quotation.zero_rated_vat ? "text-success" : "text-foreground")}>{quotation.zero_rated_vat ? "Zero Rated (0%)" : `Standard (${quotation.vat_rate}%)`}</span></p>
                {quotation.origin && quotation.destination && <p><span className="text-muted-foreground">Route:</span> <span className="font-bold text-foreground">{quotation.origin} → {quotation.destination}</span></p>}
              </div>
            </div>

            <table className="w-full text-sm mt-5 border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Particulars</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Price ({quotation.currency})</th>
                  <th className="px-3 py-2 text-right">Days</th>
                  <th className="px-3 py-2 text-right">Subtotal ({quotation.currency})</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="text-foreground">{l.description}</p>
                      {l.service_type && <p className="text-[11px] text-muted-foreground">{l.service_type}</p>}
                    </td>
                    <td className="px-3 py-2 text-right">{l.quantity}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(l.unit_price, quotation.currency)}</td>
                    <td className="px-3 py-2 text-right">{l.duration_days || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{formatCurrency(l.line_total, quotation.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mt-3">
              <div className="w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Sub-Total:</span><span className="font-bold text-foreground">{formatCurrency(quotation.subtotal, quotation.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT:</span><span className={cn("font-bold", quotation.zero_rated_vat ? "text-success" : "text-foreground")}>{quotation.zero_rated_vat ? "Zero Rated (0%)" : formatCurrency(quotation.vat_amount, quotation.currency)}</span></div>
                <div className="flex justify-between font-black text-base pt-2 border-t border-border text-destructive"><span>Grand Total:</span><span>{formatCurrency(quotation.total_amount, quotation.currency)}</span></div>
              </div>
            </div>

            {quotation.valid_until && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg text-center py-2 mt-5 text-sm font-black text-warning tracking-wide">
                VALID UNTIL {new Date(quotation.valid_until).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
            )}

            {company.bank_name && (
              <div className="mt-5 text-xs space-y-0.5">
                <p><span className="text-muted-foreground">Bank:</span> <span className="font-bold text-foreground">{company.bank_name}</span></p>
                {company.bank_account_name && <p><span className="text-muted-foreground">A/C Name:</span> <span className="font-bold text-foreground">{company.bank_account_name}</span></p>}
                {(company.bank_account_number_tzs || company.bank_account_number_usd) && (
                  <p><span className="text-muted-foreground">Account No.:</span> <span className="font-bold text-foreground">{[company.bank_account_number_tzs && `TZS ${company.bank_account_number_tzs}`, company.bank_account_number_usd && `USD ${company.bank_account_number_usd}`].filter(Boolean).join(" ")}</span></p>
                )}
                {company.bank_branch_code && <p><span className="text-muted-foreground">Branch Code:</span> <span className="font-bold text-foreground">{company.bank_branch_code}</span></p>}
                {company.bank_swift_code && <p><span className="text-muted-foreground">Swift Code:</span> <span className="font-bold text-foreground">{company.bank_swift_code}</span></p>}
              </div>
            )}

            <div className="flex justify-end mt-8">
              <div className="text-center text-xs">
                <div className="w-40 border-t border-border pt-1">
                  <p className="text-muted-foreground">Authorized Signature</p>
                  <p className="font-bold text-foreground">{company.company_name}</p>
                </div>
              </div>
            </div>

            <p className="text-center text-[11px] text-muted-foreground mt-6">
              This quotation was generated by the {company.company_name || "company"} Logistics System.<br />Thank you for your trust and partnership!
            </p>
          </div>

          {quotation.internal_notes && (
            <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4 text-sm">
              <p className="text-[10px] font-bold uppercase text-warning tracking-widest mb-1">Internal Notes</p>
              <p className="text-foreground">{quotation.internal_notes}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
