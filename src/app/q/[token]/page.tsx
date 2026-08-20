"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { downloadDocumentPdf, fetchLogoDataUrl, DocumentCompanyInfo } from "@/lib/finance/document-pdf";
import { CheckCircle2, Download, FileText, Loader2, XCircle } from "lucide-react";

// Genuinely public — no auth, no Sidebar, no useRole. Reached only via an
// unguessable token in the URL, same trust model as any "view this
// invoice" email link. Data comes from /api/quotations/public/[token],
// which uses the service-role client since there's no session here.
const STATUS_BADGES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-info/10 text-info border-info/20",
  viewed: "bg-warning/10 text-warning border-warning/20",
  accepted: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  expired: "bg-muted text-muted-foreground border-border",
};

export default function PublicQuotationPage() {
  const params = useParams();
  const token = params.token as string;

  const [quotation, setQuotation] = useState<any | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [company, setCompany] = useState<DocumentCompanyInfo>({});
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/public/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setQuotation(json.quotation);
      setLines(json.lines ?? []);
      setCompany(json.company ?? {});
      setFxRate(json.fxRate ?? null);
      setError(null);
      fetchLogoDataUrl(json.company?.logo_url).then((logoDataUrl) => {
        if (logoDataUrl) setCompany((c) => ({ ...c, logoDataUrl }));
      });
    } catch (err: any) {
      setError(err.message || "Couldn't load this quotation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const decide = async (action: "accept" | "reject") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/public/${token}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: rejectReason }) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ variant: "success", title: action === "accept" ? "Quotation accepted" : "Quotation declined" });
      setQuotation(json.quotation);
      setRejecting(false);
    } catch (err: any) {
      toast({ title: "Couldn't record your decision", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const pdf = () => {
    if (!quotation) return;
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
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;
  if (error || !quotation) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <FileText className="size-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="font-bold text-foreground">Quotation not found</p>
        <p className="text-sm text-muted-foreground mt-1">{error || "This link may be invalid or has expired."}</p>
      </div>
    </div>
  );

  const decided = ["accepted", "rejected"].includes(quotation.status);

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <FileText className="size-8 mx-auto mb-2 text-primary" />
          <h1 className="text-xl font-black text-foreground">Quotation {quotation.quotation_number}</h1>
          <Badge variant="outline" className={`${STATUS_BADGES[quotation.status] ?? ""} mt-2`}>{quotation.status}</Badge>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Route</p><p>{quotation.origin && quotation.destination ? `${quotation.origin} → ${quotation.destination}` : "—"}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Valid Until</p><p>{quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString() : "—"}</p></div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-2">{l.description || l.service_type}</td>
                  <td className="px-4 py-2 text-right">{l.quantity}{l.duration_days ? ` × ${l.duration_days}d` : ""}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCurrency(l.line_total, quotation.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-border ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(quotation.subtotal, quotation.currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{quotation.zero_rated_vat ? "VAT (zero-rated)" : `VAT (${quotation.vat_rate}%)`}</span><span>{formatCurrency(quotation.vat_amount, quotation.currency)}</span></div>
            <div className="flex justify-between font-black text-base pt-1 border-t border-border"><span>Total</span><span>{formatCurrency(quotation.total_amount, quotation.currency)}</span></div>
          </div>
        </div>

        {quotation.payment_terms && (
          <div className="text-xs text-muted-foreground"><span className="font-bold">Payment Terms:</span> {quotation.payment_terms}</div>
        )}

        <Button onClick={pdf} variant="outline" className="w-full gap-2"><Download className="size-4" /> Download PDF</Button>

        {!decided && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            {!rejecting ? (
              <div className="flex gap-3">
                <Button onClick={() => decide("accept")} disabled={busy} className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Accept Quotation
                </Button>
                <Button onClick={() => setRejecting(true)} disabled={busy} variant="outline" className="flex-1 gap-2 text-destructive border-destructive/30">
                  <XCircle className="size-4" /> Decline
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea placeholder="Reason for declining (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} />
                <div className="flex gap-2">
                  <Button onClick={() => decide("reject")} disabled={busy} variant="destructive" className="flex-1 gap-2">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null} Confirm Decline
                  </Button>
                  <Button onClick={() => setRejecting(false)} disabled={busy} variant="outline">Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
        {decided && (
          <p className="text-center text-sm text-muted-foreground">
            This quotation has been {quotation.status}{quotation.status === "rejected" && quotation.rejected_reason ? `: ${quotation.rejected_reason}` : "."}
          </p>
        )}
      </div>
    </div>
  );
}
