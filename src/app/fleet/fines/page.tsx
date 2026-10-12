"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { useCurrency } from "@/hooks/use-currency";
import { PageHeader, PageShell, SectionCard } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";

type Fine = Record<string, any>;
type Vehicle = { id: string; plate_number: string };
type Driver = { id: string; name?: string | null; email?: string | null };
type Trip = { id: string; trip_number?: string | null; origin?: string | null; destination?: string | null; vehicle_id?: string | null; truck_id?: string | null; driver_id?: string | null };
const today = () => new Date().toISOString().slice(0, 10);

export default function FleetFinesPage() {
  const { user } = useSupabase();
  const { role } = useRole();
  const { format } = useCurrency();
  const { toast } = useToast();
  const [fines, setFines] = useState<Fine[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [tripId, setTripId] = useState("none");
  const [currency, setCurrency] = useState("TZS");
  const [statusFilter, setStatusFilter] = useState("all");
  const canManage = ["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT", "HR"].includes(String(role).toUpperCase());

  const load = useCallback(async () => {
    setLoading(true);
    const [f, v, d, t] = await Promise.all([
      supabase.from("traffic_fines").select("*").order("fine_date", { ascending: false }),
      supabase.from("vehicles").select("id, plate_number").order("plate_number"),
      supabase.from("user_profiles").select("id, name, email").eq("role", "DRIVER").order("name"),
      supabase.from("trips").select("id, trip_number, origin, destination, vehicle_id, truck_id, driver_id").order("created_at", { ascending: false }).limit(250),
    ]);
    if (f.error) toast({ title: "Could not load fines", description: f.error.message, variant: "destructive" });
    setFines(f.data ?? []); setVehicles(v.data ?? []); setDrivers(d.data ?? []); setTrips(t.data ?? []); setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);
  const vehicleName = (id: string) => vehicles.find((v) => v.id === id)?.plate_number ?? "Unknown truck";
  const driverName = (id: string) => { const d = drivers.find((x) => x.id === id); return d?.name || d?.email || "Unknown driver"; };
  const filtered = statusFilter === "all" ? fines : fines.filter((f) => f.status === statusFilter);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !vehicleId || !driverId) return;
    const form = new FormData(e.currentTarget);
    const linkedTrip = tripId === "none" ? null : trips.find((trip) => trip.id === tripId);
    const actualVehicleId = linkedTrip?.vehicle_id || linkedTrip?.truck_id || vehicleId;
    const actualDriverId = linkedTrip?.driver_id || driverId;
    setSaving(true);
    const { error } = await supabase.from("traffic_fines").insert({
      vehicle_id: actualVehicleId, driver_id: actualDriverId, trip_id: tripId === "none" ? null : tripId,
      fine_date: String(form.get("fine_date")), location: String(form.get("location") || "") || null,
      issuing_authority: String(form.get("authority") || "Traffic Police"), notice_number: String(form.get("notice_number") || "") || null,
      offence: String(form.get("offence") || ""), amount: Number(form.get("amount")), currency,
      status: "unpaid", notes: String(form.get("notes") || "") || null, created_by: user.id,
    });
    setSaving(false);
    if (error) { toast({ title: "Could not save fine", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Traffic fine recorded" }); setOpen(false); setVehicleId(""); setDriverId(""); setTripId("none"); setCurrency("TZS"); void load();
  }

  async function updateStatus(fine: Fine, status: string) {
    const { error } = await supabase.from("traffic_fines").update({ status, paid_date: status === "paid" ? today() : null, updated_at: new Date().toISOString() }).eq("id", fine.id);
    if (error) toast({ title: "Could not update fine", description: error.message, variant: "destructive" }); else void load();
  }

  return <PageShell>
    <PageHeader title="Traffic fines" subtitle="Record each traffic fine against the truck, responsible driver, and trip." actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 size-4"/>Refresh</Button>{canManage && <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 size-4"/>Record fine</Button>}</div>} />
    <div className="grid gap-3 sm:grid-cols-3 mb-5">
      <SectionCard title="Fines recorded"><p className="text-2xl font-bold">{fines.length}</p></SectionCard>
      <SectionCard title="Unpaid"><p className="text-2xl font-bold">{fines.filter((f) => f.status === "unpaid").length}</p></SectionCard>
      <SectionCard title="Unpaid value"><div>{[...new Set(fines.filter((f) => f.status === "unpaid").map((f) => f.currency || "TZS"))].map((c) => <p key={c} className="text-2xl font-bold">{format(fines.filter((f) => f.status === "unpaid" && (f.currency || "TZS") === c).reduce((sum, f) => sum + Number(f.amount || 0), 0), c)}</p>)}</div></SectionCard>
    </div>
    <SectionCard title="Fine register" subtitle="Filter by payment status. Each record retains the driver and vehicle history.">
      <div className="mb-4 max-w-xs"><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="disputed">Disputed</SelectItem><SelectItem value="waived">Waived</SelectItem></SelectContent></Select></div>
      {loading ? <p className="py-8 text-center text-muted-foreground">Loading fines…</p> : filtered.length === 0 ? <div className="py-10 text-center text-muted-foreground"><AlertTriangle className="mx-auto mb-2 size-8"/><p>No fines recorded.</p></div> : <div className="space-y-3">{filtered.map((fine) => <article key={fine.id} className="rounded-lg border p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><strong>{fine.offence}</strong><Badge variant={fine.status === "unpaid" ? "destructive" : "secondary"}>{fine.status}</Badge></div>
          <p className="text-sm text-muted-foreground">{vehicleName(fine.vehicle_id)} · Driver: {driverName(fine.driver_id)}{fine.trip_id ? ` · Trip ${trips.find((t) => t.id === fine.trip_id)?.trip_number || fine.trip_id.slice(0, 8)}` : ""}</p>
          <p className="text-xs text-muted-foreground">{fine.fine_date}{fine.location ? ` · ${fine.location}` : ""}{fine.notice_number ? ` · Notice ${fine.notice_number}` : ""}{fine.issuing_authority ? ` · ${fine.issuing_authority}` : ""}</p>
          {fine.notes && <p className="text-sm">{fine.notes}</p>}
        </div><div className="sm:text-right"><p className="font-bold">{format(Number(fine.amount), fine.currency || "TZS")}</p>{canManage && <div className="mt-2 flex gap-2 sm:justify-end">{fine.status !== "paid" && <Button size="sm" variant="outline" onClick={() => void updateStatus(fine, "paid")}>Mark paid</Button>}{fine.status !== "disputed" && fine.status === "unpaid" && <Button size="sm" variant="ghost" onClick={() => void updateStatus(fine, "disputed")}>Dispute</Button>}</div>}</div>
      </article>)}</div>}
    </SectionCard>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Record a traffic fine</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div><Label>Truck *</Label><Select value={vehicleId} onValueChange={setVehicleId} required><SelectTrigger><SelectValue placeholder="Select truck"/></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_number}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Responsible driver *</Label><Select value={driverId} onValueChange={(id) => { setDriverId(id); const assigned = trips.find((trip) => trip.driver_id === id); if (assigned) { setTripId(assigned.id); setVehicleId(assigned.vehicle_id || assigned.truck_id || ""); } }} required><SelectTrigger><SelectValue placeholder="Select driver"/></SelectTrigger><SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name || d.email || d.id}</SelectItem>)}</SelectContent></Select></div>
        <div className="sm:col-span-2"><Label>Related trip (optional)</Label><Select value={tripId} onValueChange={(id) => { setTripId(id); const t = trips.find((trip) => trip.id === id); if (t) { setVehicleId(t.vehicle_id || t.truck_id || vehicleId); setDriverId(t.driver_id || driverId); } }}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">No trip selected</SelectItem>{trips.map((t) => <SelectItem key={t.id} value={t.id}>{t.trip_number || t.id.slice(0, 8)} · {t.origin || ""} → {t.destination || ""}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Date *</Label><Input name="fine_date" type="date" defaultValue={today()} required/></div><div><Label>Fine amount *</Label><Input name="amount" type="number" min="0.01" step="0.01" required/></div>
        <div><Label>Currency</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["TZS","KES","USD","UGX","ZMW","CDF"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Offence *</Label><Input name="offence" placeholder="e.g. speeding, overload" required/></div>
        <div><Label>Notice number</Label><Input name="notice_number"/></div><div><Label>Issuing authority</Label><Input name="authority" defaultValue="Traffic Police"/></div>
        <div className="sm:col-span-2"><Label>Location</Label><Input name="location" placeholder="Town, road or checkpoint"/></div><div className="sm:col-span-2"><Label>Notes</Label><Textarea name="notes"/></div>
        <Button className="sm:col-span-2" type="submit" disabled={saving || !vehicleId || !driverId}>{saving ? "Saving…" : "Save fine"}</Button>
      </form>
    </DialogContent></Dialog>
  </PageShell>;
}
