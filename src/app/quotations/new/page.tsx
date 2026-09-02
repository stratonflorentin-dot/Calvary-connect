"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { downloadDocumentPdf, fetchLogoDataUrl, DocumentCompanyInfo } from "@/lib/finance/document-pdf";
import { getRate } from "@/lib/finance/fx";
import { ArrowLeft, FileText, Loader2, Plus, Trash2 } from "lucide-react";

const ITEM_TYPES: { key: string; label: string; timeBased: boolean }[] = [
  { key: "freight_charge", label: "Freight / Transport Charge", timeBased: false },
  { key: "cross_border_fee", label: "Cross-Border / Transit Fees", timeBased: false },
  { key: "clearing_forwarding", label: "Clearing & Forwarding", timeBased: false },
  { key: "fuel_surcharge", label: "Fuel Surcharge / Levy", timeBased: false },
  { key: "overweight_charge", label: "Overweight / Oversize Charge", timeBased: false },
  { key: "loading_offloading", label: "Loading & Offloading", timeBased: false },
  { key: "packaging", label: "Packaging / Palletization", timeBased: false },
  { key: "insurance", label: "Cargo Insurance", timeBased: false },
  { key: "documentation", label: "Documentation & Customs Fees", timeBased: false },
  { key: "handling_fee", label: "Handling Fee", timeBased: false },
  { key: "waiting_time", label: "Waiting Time / Demurrage", timeBased: true },
  { key: "storage", label: "Storage / Warehousing", timeBased: true },
  { key: "other", label: "Other / Miscellaneous", timeBased: false },
];

interface LineItem {
  item_type: string;
  description: string;
  quantity: string;
  duration_days: string;
  unit_price: string;
}

const emptyLine = (): LineItem => ({ item_type: "freight_charge", description: "", quantity: "1", duration_days: "", unit_price: "" });

function lineSubtotal(l: LineItem): number {
  const qty = Number(l.quantity) || 0;
  const price = Number(l.unit_price) || 0;
  const isTimeBased = ITEM_TYPES.find((t) => t.key === l.item_type)?.timeBased;
  const days = isTimeBased ? Number(l.duration_days) || 0 : 1;
  return qty * price * days;
}

export default function NewQuotationPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const router = useRouter();

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ full_name: "", email: "", phone: "", company: "" });

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [currency, setCurrency] = useState("TZS");
  const [zeroRated, setZeroRated] = useState(false);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<{ default_vat_rate: number; quotation_number_prefix: string; quotation_terms_conditions: string | null } & DocumentCompanyInfo>({
    default_vat_rate: 18,
    quotation_number_prefix: "QT-",
    quotation_terms_conditions: null,
  });
  const [fxRate, setFxRate] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("customers").select("id, company_name, contact_person, email, phone, vrn, tax_id").is("deleted_at", null).order("company_name").then(({ data }) => setCustomers(data ?? []));
    supabase.from("company_settings")
      .select("default_vat_rate, quotation_number_prefix, quotation_terms_conditions, company_name, tagline, vat_registration, tax_id, phone, email, address, bank_name, bank_account_name, bank_account_number_tzs, bank_account_number_usd, bank_branch_code, bank_swift_code, logo_url")
      .limit(1).maybeSingle().then(async ({ data }) => {
        if (!data) return;
        setSettings((s) => ({ ...s, ...data }));
        const logoDataUrl = await fetchLogoDataUrl((data as any).logo_url);
        if (logoDataUrl) setSettings((s) => ({ ...s, logoDataUrl }));
      });
  }, []);

  useEffect(() => {
    if (currency === "TZS") { setFxRate(null); return; }
    getRate(currency, "TZS").then(setFxRate).catch(() => setFxRate(null));
  }, [currency]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 20);
    return customers.filter((c) => [c.company_name, c.contact_person, c.email].filter(Boolean).join(" ").toLowerCase().includes(q)).slice(0, 20);
  }, [customers, customerSearch]);

  const updateLine = (idx: number, patch: Partial<LineItem>) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + lineSubtotal(l), 0), [lines]);
  const vatAmount = zeroRated ? 0 : subtotal * (settings.default_vat_rate / 100);
  const total = subtotal + vatAmount;

  const save = async (send: boolean) => {
    if (customerMode === "existing" && !customerId) {
      toast({ title: "Choose a customer", variant: "destructive" });
      return;
    }
    if (customerMode === "new" && (!newCustomer.full_name || !newCustomer.email)) {
      toast({ title: "Customer name and email are required", variant: "destructive" });
      return;
    }
    if (!validUntil) {
      toast({ title: "Valid Until is required", variant: "destructive" });
      return;
    }
    const realLines = lines.filter((l) => l.description.trim() || Number(l.unit_price) > 0);
    if (realLines.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    if (total <= 0 && !window.confirm("This quotation totals to zero — send anyway?")) return;

    setSaving(true);
    try {
      let finalCustomerId = customerId;
      let customerEmail: string | undefined;
      let customerName = "";
      if (customerMode === "new") {
        const { data: created, error: custErr } = await supabase
          .from("customers")
          .insert({ company_name: newCustomer.company || newCustomer.full_name, contact_person: newCustomer.full_name, email: newCustomer.email, phone: newCustomer.phone, created_by: user?.id ?? null })
          .select("id")
          .single();
        if (custErr) throw custErr;
        finalCustomerId = created.id;
        customerEmail = newCustomer.email;
        customerName = newCustomer.company || newCustomer.full_name;
      } else {
        const c = customers.find((x) => x.id === customerId);
        customerEmail = c?.email;
        customerName = c?.company_name ?? c?.contact_person ?? "";
      }

      const { data: quotationNumber } = await supabase.rpc("next_doc_number", { p_type: "quotation" });

      const { data: quotation, error: qErr } = await supabase
        .from("quotations")
        .insert({
          quotation_number: quotationNumber || `${settings.quotation_number_prefix}${Date.now().toString().slice(-6)}`,
          customer_id: finalCustomerId,
          contact_person: customerMode === "new" ? newCustomer.full_name : (customers.find((x) => x.id === customerId)?.contact_person ?? null),
          quotation_date: new Date().toISOString().slice(0, 10),
          expiry_date: validUntil,
          valid_until: validUntil,
          origin: origin || null,
          destination: destination || null,
          subtotal,
          vat_rate: settings.default_vat_rate,
          zero_rated_vat: zeroRated,
          vat_amount: vatAmount,
          total_amount: total,
          amount: total,
          currency,
          payment_terms: paymentTerms || null,
          terms_conditions: settings.quotation_terms_conditions || null,
          internal_notes: internalNotes || null,
          status: "draft",
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (qErr) throw qErr;

      const lineRows = realLines.map((l, i) => ({
        quotation_id: quotation.id,
        line_number: i + 1,
        service_type: l.item_type,
        description: l.description,
        quantity: Number(l.quantity) || 1,
        duration_days: ITEM_TYPES.find((t) => t.key === l.item_type)?.timeBased ? Number(l.duration_days) || 0 : null,
        unit_price: Number(l.unit_price) || 0,
        line_total: lineSubtotal(l),
      }));
      const { error: linesErr } = await supabase.from("quotation_lines").insert(lineRows);
      if (linesErr) throw linesErr;

      if (send) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch(`/api/quotations/${quotation.id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ email: customerEmail, customerName }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast({ title: "Saved, but couldn't send", description: json.error, variant: "destructive" });
          router.push(`/quotations/${quotation.id}`);
          return;
        }
        toast({ variant: "success", title: "Quotation sent", description: `${quotation.quotation_number} emailed to ${customerEmail}` });
      } else {
        toast({ variant: "success", title: "Saved as draft", description: quotation.quotation_number });
      }
      router.push(`/quotations/${quotation.id}`);
    } catch (err: any) {
      toast({ title: "Couldn't save quotation", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const previewPdf = () => {
    const existingCustomer = customers.find((c) => c.id === customerId);
    downloadDocumentPdf({
      kind: "quotation",
      number: "PREVIEW",
      dateIssued: new Date().toISOString(),
      dueOrValidUntil: validUntil,
      status: "draft",
      company: settings,
      customer: {
        name: customerMode === "new" ? (newCustomer.company || newCustomer.full_name) : (existingCustomer?.company_name ?? ""),
        email: customerMode === "new" ? newCustomer.email : existingCustomer?.email,
        phone: customerMode === "new" ? newCustomer.phone : existingCustomer?.phone,
        vrn: existingCustomer?.vrn, tin: existingCustomer?.tax_id,
      },
      paymentTerms, currency, fxRateToTzs: fxRate,
      vatRate: settings.default_vat_rate, zeroRated, subtotal, vatAmount, total,
      lines: lines.map((l) => ({
        description: l.description,
        item_type_label: ITEM_TYPES.find((t) => t.key === l.item_type)?.label ?? l.item_type,
        quantity: Number(l.quantity) || 1,
        duration_days: Number(l.duration_days) || null,
        unit_price: Number(l.unit_price) || 0,
        line_total: lineSubtotal(l),
      })),
      termsConditions: settings.quotation_terms_conditions,
    });
  };

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <Link href="/quotations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="size-4" /> Back to Quotations
            </Link>
            <h1 className="text-2xl md:text-3xl font-headline tracking-tighter flex items-center gap-2">
              <FileText className="size-7 text-primary" /> Create Quotation
            </h1>
            <p className="text-muted-foreground">Build a professional quotation for your customer</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h2 className="font-black text-sm text-foreground">Customer Information</h2>
                <div className="flex gap-2">
                  {(["existing", "new"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setCustomerMode(m)}
                      className={`flex-1 h-9 rounded-xl text-xs font-bold border transition-colors ${customerMode === m ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"}`}>
                      {m === "existing" ? "Existing Client" : "New Customer"}
                    </button>
                  ))}
                </div>
                {customerMode === "existing" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Search Client *</Label>
                    <Input placeholder="Search by name, company, email..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                    <div className="max-h-40 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                      {filteredCustomers.map((c) => (
                        <button key={c.id} type="button" onClick={() => { setCustomerId(c.id); setCustomerSearch(c.company_name ?? c.contact_person ?? ""); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/40 ${customerId === c.id ? "bg-primary/10" : ""}`}>
                          <span className="font-bold">{c.company_name ?? c.contact_person}</span>
                          {c.email && <span className="text-muted-foreground text-xs ml-2">{c.email}</span>}
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No matches. <Link href="/customers" className="text-primary hover:underline">Add a customer</Link>.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Full Name *" value={newCustomer.full_name} onChange={(e) => setNewCustomer((p) => ({ ...p, full_name: e.target.value }))} />
                    <Input placeholder="Email *" value={newCustomer.email} onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))} />
                    <Input placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))} />
                    <Input placeholder="Company" value={newCustomer.company} onChange={(e) => setNewCustomer((p) => ({ ...p, company: e.target.value }))} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Origin (optional)" value={origin} onChange={(e) => setOrigin(e.target.value)} />
                  <Input placeholder="Destination (optional)" value={destination} onChange={(e) => setDestination(e.target.value)} />
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-sm text-foreground">Line Items</h2>
                  <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5"><Plus className="size-3.5" /> Add Item</Button>
                </div>
                <div className="space-y-3">
                  {lines.map((l, idx) => {
                    const timeBased = ITEM_TYPES.find((t) => t.key === l.item_type)?.timeBased;
                    return (
                      <div key={idx} className="border border-border rounded-xl p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={l.item_type} onValueChange={(v) => updateLine(idx, { item_type: v })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>{ITEM_TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input placeholder="Description" value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                        </div>
                        <div className={`grid gap-2 ${timeBased ? "grid-cols-4" : "grid-cols-3"}`}>
                          <Input type="number" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                          {timeBased && <Input type="number" placeholder="Duration (Days)" value={l.duration_days} onChange={(e) => updateLine(idx, { duration_days: e.target.value })} />}
                          <Input type="number" placeholder={`Unit Price (${currency})`} value={l.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} />
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-mono font-bold">{formatCurrency(lineSubtotal(l), currency)}</span>
                            <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} disabled={lines.length === 1}><Trash2 className="size-3.5 text-muted-foreground" /></Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h2 className="font-black text-sm text-foreground">Additional Details</h2>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Terms</Label>
                  <Textarea rows={2} placeholder="e.g., Payment due within 30 days of acceptance" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
                </div>
                <div className="rounded-xl bg-muted/30 border border-border p-3 text-xs text-muted-foreground">
                  Terms & Conditions are managed centrally from Company Settings and applied automatically to every quotation and its PDF.
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Internal Notes (not visible to customer)</Label>
                  <Textarea rows={2} placeholder="Add any internal notes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
                <h2 className="font-black text-sm text-foreground">Pricing Summary</h2>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal, currency)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{zeroRated ? "VAT (zero-rated)" : `VAT (${settings.default_vat_rate}%)`}</span><span>{formatCurrency(vatAmount, currency)}</span></div>
                <div className="flex justify-between font-black text-lg pt-2 border-t border-border text-primary"><span>Total</span><span>{formatCurrency(total, currency)}</span></div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h2 className="font-black text-sm text-foreground">Quotation Settings</h2>
                <div className="space-y-1">
                  <Label className="text-xs">Valid Until *</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Currency *</Label>
                  <div className="flex gap-2">
                    {["TZS", "USD", "EUR", "KES"].map((c) => (
                      <button key={c} type="button" onClick={() => setCurrency(c)}
                        className={`flex-1 h-9 rounded-lg text-xs font-bold border ${currency === c ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between cursor-pointer pt-1">
                  <div>
                    <p className="text-xs font-bold text-foreground">Zero Rated VAT</p>
                    <p className="text-[10px] text-muted-foreground">{zeroRated ? "On — VAT will be 0" : `Off — standard ${settings.default_vat_rate}% VAT`}</p>
                  </div>
                  <input type="checkbox" checked={zeroRated} onChange={(e) => setZeroRated(e.target.checked)} className="size-4" />
                </label>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
                <Button onClick={() => save(true)} disabled={saving} className="w-full gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save & Send to Customer
                </Button>
                <Button onClick={() => save(false)} disabled={saving} variant="outline" className="w-full">Save as Draft</Button>
                <Button onClick={previewPdf} variant="ghost" className="w-full text-xs">Preview PDF</Button>
                <Button asChild variant="ghost" className="w-full text-xs text-muted-foreground"><Link href="/quotations">Cancel</Link></Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
