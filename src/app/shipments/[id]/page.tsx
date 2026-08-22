"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { AuditTrailService } from "@/services/audit-trail-service";
import { TripFormDialog } from "@/components/trip/trip-form-dialog";
import {
  ArrowLeft, CheckCircle2, Download, Edit2, FileText, Loader2,
  Package, PlusCircle, Ship, Truck, X, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import { fetchLogoDataUrl } from "@/lib/finance/document-pdf";

const STAGES = ["created", "approved", "active", "delivered", "paid"] as const;
const STAGE_LABEL: Record<string, string> = { created: "Created", approved: "Approved", active: "In Transit", delivered: "Delivered", paid: "Paid" };
// "invoiced" shares the Delivered step visually — the 5-stage tracker in
// the spec doesn't have a 6th slot for it, and it's really "delivered,
// now being billed" rather than a distinct physical stage.
const STAGE_INDEX: Record<string, number> = { created: 0, approved: 1, active: 2, delivered: 3, invoiced: 3, paid: 4, cancelled: -1 };

export default function ShipmentDetailPage() {
  const { role, hasPermission } = useRole();
  const { user } = useSupabase();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [shipment, setShipment] = useState<any | null>(null);
  const [quotation, setQuotation] = useState<any | null>(null);
  const [quotationLines, setQuotationLines] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [waybills, setWaybills] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");

  const [tripDialogOpen, setTripDialogOpen] = useState(false);
  const [waybillOpen, setWaybillOpen] = useState(false);
  const [waybillForm, setWaybillForm] = useState({ cargo_description: "", cargo_weight_kg: "", package_count: "", trip_id: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ origin_city: "", destination_city: "", cargo_description: "", requested_pickup: "", promised_delivery: "" });
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("company_settings").select("logo_url").limit(1).maybeSingle().then(({ data }) => {
      fetchLogoDataUrl((data as any)?.logo_url).then(setCompanyLogo);
    });
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: s } = await supabase.from("shipments").select("*, customer:customer_id(company_name, contact_person, email, phone)").eq("id", id).maybeSingle();
    setShipment(s);
    if (s) {
      const [tripsRes, waybillsRes, invoiceRes, activityRes] = await Promise.all([
        supabase.from("trips").select("*").eq("shipment_id", id).order("created_at", { ascending: false }),
        supabase.from("waybills").select("*").eq("shipment_id", id).order("issued_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("shipment_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("audit_trail").select("*").eq("entity_type", "shipment").eq("entity_id", id).order("timestamp", { ascending: false }).limit(30),
      ]);
      setTrips(tripsRes.data ?? []);
      setWaybills(waybillsRes.data ?? []);
      setInvoice(invoiceRes.data ?? null);
      setActivity(activityRes.data ?? []);
      if (s.quotation_id) {
        const { data: q } = await supabase.from("quotations").select("*").eq("id", s.quotation_id).maybeSingle();
        setQuotation(q);
        if (q) {
          const { data: lines } = await supabase.from("quotation_lines").select("*").eq("quotation_id", q.id).order("line_number");
          setQuotationLines(lines ?? []);
        }
      }
      setEditForm({
        origin_city: s.origin_city ?? "", destination_city: s.destination_city ?? "",
        cargo_description: s.cargo_description ?? "",
        requested_pickup: s.requested_pickup ?? "", promised_delivery: s.promised_delivery ?? "",
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const currentStageIndex = shipment ? STAGE_INDEX[shipment.status] ?? 0 : 0;

  // Real financial data available so far: revenue from the linked invoice
  // (if any) and Actual cost from linked trips. Requested/Committed cost
  // stages from the spec need cash_requests/fuel_requests linked to a
  // shipment, which don't exist yet — shown as "not tracked" rather than
  // fabricated numbers.
  const actualCost = useMemo(() => trips.reduce((sum, t) => sum + (Number(t.actual_cost) || 0), 0), [trips]);
  const revenue = Number(invoice?.total_amount ?? invoice?.amount ?? shipment?.final_amount ?? shipment?.quoted_amount) || 0;
  const grossProfit = revenue - actualCost;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const advanceStage = async (next: string) => {
    if (!shipment) return;
    if (next === "active" && trips.filter((t) => t.vehicle_id || t.truck_id).length === 0) {
      toast({ title: "Assign at least one truck before dispatching", description: "Opening the truck assignment form for you.", variant: "destructive" });
      setTab("trucks");
      setTripDialogOpen(true);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("shipments").update({ status: next }).eq("id", shipment.id);
    setBusy(false);
    if (error) { toast({ title: "Couldn't update status", description: error.message, variant: "destructive" }); return; }
    await AuditTrailService.log({ user_id: user?.id, module: "sales", action: "update", entity_type: "shipment", entity_id: shipment.id, description: `Shipment moved to ${next}` });
    toast({ variant: "success", title: `Shipment marked ${STAGE_LABEL[next] ?? next}` });
    load();
  };

  const cancelShipment = async () => {
    if (!shipment) return;
    const reason = window.prompt("Reason for cancelling this shipment?");
    if (reason === null) return;
    setBusy(true);
    const { error } = await supabase.from("shipments").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason || null }).eq("id", shipment.id);
    setBusy(false);
    if (error) { toast({ title: "Couldn't cancel", description: error.message, variant: "destructive" }); return; }
    await AuditTrailService.log({ user_id: user?.id, module: "sales", action: "update", entity_type: "shipment", entity_id: shipment.id, description: `Shipment cancelled: ${reason || "no reason given"}` });
    toast({ variant: "success", title: "Shipment cancelled" });
    load();
  };

  const saveEdit = async () => {
    if (!shipment) return;
    setBusy(true);
    const { error } = await supabase.from("shipments").update(editForm).eq("id", shipment.id);
    setBusy(false);
    if (error) { toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); return; }
    await AuditTrailService.log({ user_id: user?.id, module: "sales", action: "update", entity_type: "shipment", entity_id: shipment.id, description: "Shipment details edited" });
    toast({ variant: "success", title: "Saved" });
    setEditOpen(false);
    load();
  };

  const issueWaybill = async () => {
    if (!shipment) return;
    setBusy(true);
    try {
      const { data: waybillNumber } = await supabase.rpc("next_doc_number", { p_type: "waybill" });
      const { error } = await supabase.from("waybills").insert({
        waybill_number: waybillNumber || `WB-${Date.now().toString().slice(-6)}`,
        shipment_id: shipment.id,
        trip_id: waybillForm.trip_id || null,
        cargo_description: waybillForm.cargo_description || shipment.cargo_description || null,
        cargo_weight_kg: waybillForm.cargo_weight_kg ? Number(waybillForm.cargo_weight_kg) : (shipment.cargo_weight_kg ?? null),
        package_count: waybillForm.package_count ? Number(waybillForm.package_count) : null,
        issued_by: user?.id ?? null,
      });
      if (error) throw error;
      await AuditTrailService.log({ user_id: user?.id, module: "sales", action: "create", entity_type: "waybill", entity_id: shipment.id, description: "Waybill issued" });
      toast({ variant: "success", title: "Waybill issued" });
      setWaybillOpen(false);
      setWaybillForm({ cargo_description: "", cargo_weight_kg: "", package_count: "", trip_id: "" });
      load();
    } catch (err: any) {
      toast({ title: "Couldn't issue waybill", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const addLetterhead = (doc: jsPDF) => {
    if (!companyLogo) return;
    const format = /data:image\/(\w+);/.exec(companyLogo)?.[1]?.toUpperCase() || "PNG";
    const pageWidth = doc.internal.pageSize.getWidth();
    try { doc.addImage(companyLogo, format, pageWidth - 14 - 26, 8, 26, 16); } catch { /* soft-fail */ }
  };

  const downloadSummary = () => {
    if (!shipment) return;
    const doc = new jsPDF();
    addLetterhead(doc);
    doc.setFontSize(16);
    doc.text(`Shipment Summary — ${shipment.shipment_number}`, 14, 18);
    doc.setFontSize(10);
    let y = 30;
    const row = (label: string, value: string) => { doc.text(`${label}: ${value}`, 14, y); y += 7; };
    row("Customer", shipment.customer?.company_name ?? shipment.customer?.contact_person ?? "—");
    row("Route", `${shipment.origin_city ?? "—"} → ${shipment.destination_city ?? "—"}`);
    row("Status", STAGE_LABEL[shipment.status] ?? shipment.status);
    row("Pickup", shipment.requested_pickup ? new Date(shipment.requested_pickup).toLocaleDateString() : "—");
    row("Delivery", shipment.promised_delivery ? new Date(shipment.promised_delivery).toLocaleDateString() : "—");
    row("Revenue", formatCurrency(revenue, shipment.currency || "TZS"));
    row("Actual Cost", formatCurrency(actualCost, shipment.currency || "TZS"));
    row("Gross Profit", formatCurrency(grossProfit, shipment.currency || "TZS"));
    row("Margin", `${margin.toFixed(1)}%`);
    doc.save(`${shipment.shipment_number}-summary.pdf`);
  };

  // The Transport Agreement Generator (Sales > Contracts) is the real
  // contract tool — richer template (route/rate annexure, full contract
  // details), and where "old contract's terms carry into the new one"
  // actually lives (contract-service.ts's fetchPriorContractTerms). This
  // just hands off with the shipment's id; that page fetches the
  // shipment/quotation/customer and prefills the form itself.
  const canGenerateContract = hasPermission(["CEO", "ADMIN", "SALESMAN"]);
  const openContractGenerator = () => {
    if (!shipment) return;
    if (!shipment.quotation_id) {
      toast({ title: "No linked quotation", description: "This shipment has no quotation to base a contract on.", variant: "destructive" });
      return;
    }
    router.push(`/sales?tab=contracts&shipmentId=${shipment.id}`);
  };

  if (!role) return null;
  if (loading) return <div className="flex min-h-screen bg-background"><Sidebar role={role} /><main className="flex-1 flex items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></main></div>;
  if (!shipment) return <div className="flex min-h-screen bg-background"><Sidebar role={role} /><main className="flex-1 p-8 text-center text-muted-foreground">Shipment not found.</main></div>;

  const nextStage = shipment.status === "cancelled" ? null : STAGES[currentStageIndex + 1];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Link href="/shipments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to Shipments
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-black text-foreground font-mono flex items-center gap-2"><Ship className="size-6 text-primary" /> {shipment.shipment_number}</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadSummary} className="gap-2"><Download className="size-4" /> Summary</Button>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2"><Edit2 className="size-4" /> Edit</Button>
              {canGenerateContract && (
                <Button variant="outline" size="sm" onClick={openContractGenerator} className="gap-2">
                  <FileText className="size-4" /> Contract
                </Button>
              )}
              {shipment.status !== "cancelled" && shipment.status !== "paid" && (
                <Button variant="outline" size="sm" onClick={cancelShipment} disabled={busy} className="gap-2 text-destructive border-destructive/30"><XCircle className="size-4" /> Cancel</Button>
              )}
            </div>
          </div>

          {/* 5-stage tracker */}
          {shipment.status === "cancelled" ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-sm text-destructive">
              Cancelled{shipment.cancellation_reason ? `: ${shipment.cancellation_reason}` : ""}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center">
                {STAGES.map((st, i) => (
                  <div key={st} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center gap-1.5 flex-1">
                      <div className={cn("size-8 rounded-full flex items-center justify-center text-xs font-black border-2",
                        i <= currentStageIndex ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border text-muted-foreground")}>
                        {i < currentStageIndex ? <CheckCircle2 className="size-4" /> : i + 1}
                      </div>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider", i <= currentStageIndex ? "text-foreground" : "text-muted-foreground")}>{STAGE_LABEL[st]}</span>
                    </div>
                    {i < STAGES.length - 1 && <div className={cn("h-0.5 flex-1 -mt-5", i < currentStageIndex ? "bg-primary" : "bg-border")} />}
                  </div>
                ))}
              </div>
              {nextStage && (
                <div className="flex justify-end mt-3">
                  <Button size="sm" onClick={() => advanceStage(nextStage)} disabled={busy} className="gap-2">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null} Mark as {STAGE_LABEL[nextStage]}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="trucks">Trucks & Trips</TabsTrigger>
                  <TabsTrigger value="quotation">Quotation</TabsTrigger>
                  <TabsTrigger value="waybills">Waybills</TabsTrigger>
                  <TabsTrigger value="activity">Activity Log</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="bg-card border border-border rounded-2xl p-5 grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Client</p><p className="font-bold text-foreground">{shipment.customer?.company_name ?? "—"}</p></div>
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Service Type</p><p className="text-foreground">{shipment.cargo_type ?? "—"}</p></div>
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Origin</p><p className="text-foreground">{shipment.origin_city ?? "—"}{shipment.origin_country ? `, ${shipment.origin_country}` : ""}</p></div>
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Destination</p><p className="text-foreground">{shipment.destination_city ?? "—"}{shipment.destination_country ? `, ${shipment.destination_country}` : ""}</p></div>
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Pickup Date</p><p className="text-foreground">{shipment.requested_pickup ? new Date(shipment.requested_pickup).toLocaleDateString() : "—"}</p></div>
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Delivery Date</p><p className="text-foreground">{shipment.promised_delivery ? new Date(shipment.promised_delivery).toLocaleDateString() : "—"}</p></div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                    <h3 className="font-black text-sm text-foreground">Shipment Financial Summary</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-success/10 rounded-xl p-3"><p className="text-[10px] text-success font-bold uppercase">Revenue</p><p className="text-lg font-black text-success">{formatCurrency(revenue, shipment.currency || "TZS")}</p></div>
                      <div className="bg-warning/10 rounded-xl p-3"><p className="text-[10px] text-warning font-bold uppercase">Actual Cost</p><p className="text-lg font-black text-warning">{formatCurrency(actualCost, shipment.currency || "TZS")}</p></div>
                      <div className="bg-primary/10 rounded-xl p-3"><p className="text-[10px] text-primary font-bold uppercase">Gross Profit</p><p className="text-lg font-black text-primary">{formatCurrency(grossProfit, shipment.currency || "TZS")}</p></div>
                      <div className="bg-accent/10 rounded-xl p-3"><p className="text-[10px] text-accent-foreground font-bold uppercase">Margin</p><p className="text-lg font-black text-accent-foreground">{margin.toFixed(1)}%</p></div>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      Requested/Committed cost stages aren't tracked yet — cash requests and fuel requests aren't linked to shipments in this build. Actual cost is the sum of linked trips' recorded cost.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="trucks" className="space-y-4">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => setTripDialogOpen(true)} className="gap-2"><PlusCircle className="size-4" /> Assign Truck / Create Trip Order</Button>
                  </div>
                  {trips.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
                      No vehicle assigned yet — use Assign Truck above, or create a Subcontracted trip if outsourcing.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {trips.map((t) => (
                        <div key={t.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Truck className="size-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-bold text-foreground">{t.trip_number}</p>
                              <p className="text-xs text-muted-foreground">{t.origin} → {t.destination}</p>
                            </div>
                          </div>
                          <Badge variant="outline">{t.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="quotation" className="space-y-4">
                  {!quotation ? (
                    <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">No linked quotation.</div>
                  ) : (
                    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-mono font-black text-foreground">{quotation.quotation_number}</p>
                        <Link href={`/quotations/${quotation.id}`} className="text-xs text-primary hover:underline">View Full Quotation →</Link>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div><p className="text-[10px] text-muted-foreground uppercase">Subtotal</p><p>{formatCurrency(quotation.subtotal, quotation.currency)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">VAT</p><p>{formatCurrency(quotation.vat_amount, quotation.currency)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Total</p><p className="font-bold">{formatCurrency(quotation.total_amount, quotation.currency)}</p></div>
                      </div>
                      <div className="divide-y divide-border border-t border-border pt-2">
                        {quotationLines.map((l) => (
                          <div key={l.id} className="flex justify-between py-1.5 text-xs">
                            <span className="text-muted-foreground">{l.description || l.service_type}</span>
                            <span className="font-mono">{formatCurrency(l.line_total, quotation.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="waybills" className="space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setWaybillOpen(true)} className="gap-2"><PlusCircle className="size-4" /> Issue Waybill</Button>
                  </div>
                  {waybills.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">No waybills issued yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {waybills.map((w) => (
                        <div key={w.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package className="size-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-bold text-foreground font-mono">{w.waybill_number}</p>
                              <p className="text-xs text-muted-foreground">{w.cargo_description || "—"}{w.cargo_weight_kg ? ` · ${w.cargo_weight_kg}kg` : ""}{w.package_count ? ` · ${w.package_count} pkgs` : ""}</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{new Date(w.issued_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="space-y-2">
                  {activity.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">No activity recorded yet.</div>
                  ) : (
                    activity.map((a) => (
                      <div key={a.id} className="bg-card border border-border rounded-xl p-3 text-sm">
                        <p className="text-foreground">{a.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.timestamp).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Right rail */}
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-4 space-y-2 text-sm">
                <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Shipment Info</h3>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline">{STAGE_LABEL[shipment.status] ?? shipment.status}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-mono">{formatCurrency(revenue, shipment.currency || "TZS")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(shipment.created_at).toLocaleDateString()}</span></div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 space-y-2 text-sm">
                <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Invoice</h3>
                {invoice ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline">{invoice.status}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Balance Due</span><span className="font-mono">{formatCurrency(Number(invoice.total_amount ?? invoice.amount ?? 0) - Number(invoice.paid_amount ?? 0), invoice.currency)}</span></div>
                    <Button variant="outline" size="sm" asChild className="w-full mt-1"><Link href="/finance/invoicing/customer-invoices">View Invoice</Link></Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No invoice raised yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <TripFormDialog
        open={tripDialogOpen}
        onOpenChange={setTripDialogOpen}
        shipmentId={shipment.id}
        defaultOrigin={shipment.origin_city ?? ""}
        defaultDestination={shipment.destination_city ?? ""}
        defaultQuotationId={shipment.quotation_id ?? ""}
        onSaved={() => { setTripDialogOpen(false); load(); }}
      />

      {editOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-black text-foreground">Edit Shipment</h3>
              <Button variant="ghost" size="icon" onClick={() => setEditOpen(false)}><X className="size-4" /></Button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Origin</Label><Input value={editForm.origin_city} onChange={(e) => setEditForm((p) => ({ ...p, origin_city: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Destination</Label><Input value={editForm.destination_city} onChange={(e) => setEditForm((p) => ({ ...p, destination_city: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Pickup Date</Label><Input type="date" value={editForm.requested_pickup?.slice(0, 10) ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, requested_pickup: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Delivery Date</Label><Input type="date" value={editForm.promised_delivery?.slice(0, 10) ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, promised_delivery: e.target.value }))} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Cargo Description</Label><Textarea rows={2} value={editForm.cargo_description} onChange={(e) => setEditForm((p) => ({ ...p, cargo_description: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={saveEdit} disabled={busy} className="gap-2">{busy ? <Loader2 className="size-4 animate-spin" /> : null} Save</Button>
            </div>
          </div>
        </div>
      )}

      {waybillOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-black text-foreground">Issue Waybill</h3>
              <Button variant="ghost" size="icon" onClick={() => setWaybillOpen(false)}><X className="size-4" /></Button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1"><Label className="text-xs">Cargo Description</Label><Textarea rows={2} placeholder={shipment.cargo_description || ""} value={waybillForm.cargo_description} onChange={(e) => setWaybillForm((p) => ({ ...p, cargo_description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Weight (kg)</Label><Input type="number" placeholder={String(shipment.cargo_weight_kg ?? "")} value={waybillForm.cargo_weight_kg} onChange={(e) => setWaybillForm((p) => ({ ...p, cargo_weight_kg: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Package Count</Label><Input type="number" value={waybillForm.package_count} onChange={(e) => setWaybillForm((p) => ({ ...p, package_count: e.target.value }))} /></div>
              </div>
              {trips.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Trip (optional)</Label>
                  <select className="w-full h-9 rounded-lg border border-border bg-card px-2 text-sm" value={waybillForm.trip_id} onChange={(e) => setWaybillForm((p) => ({ ...p, trip_id: e.target.value }))}>
                    <option value="">— None —</option>
                    {trips.map((t) => <option key={t.id} value={t.id}>{t.trip_number}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button variant="outline" onClick={() => setWaybillOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={issueWaybill} disabled={busy} className="gap-2">{busy ? <Loader2 className="size-4 animate-spin" /> : null} Issue</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
