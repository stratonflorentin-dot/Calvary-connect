"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useToast } from "@/hooks/use-toast";
import { AuditTrailService } from "@/services/audit-trail-service";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Route as RouteIcon, Save } from "lucide-react";

/**
 * Add / edit a trip.
 *
 * Kept intentionally lean: the fields that the trip list, dispatch board,
 * driver dashboard, POD flow and finance auto-invoicing actually read.
 * Anything else can be edited later on the trip detail page.
 */

interface TripFormState {
  trip_number: string;
  origin: string;
  destination: string;
  cargo: string;
  client: string;
  driverId: string;
  truckId: string;
  trailerId: string;
  status: string;
  salesAmount: number | "";
  vatRate: number | "";
  currency: string;
  cargoWeight: number | "";
  estimatedDistance: number | "";
  estimatedDuration: number | "";
  notes: string;
}

const empty = (): TripFormState => ({
  trip_number: "",
  origin: "",
  destination: "",
  cargo: "",
  client: "",
  driverId: "",
  truckId: "",
  trailerId: "",
  status: "pending",
  salesAmount: "",
  vatRate: 18,
  currency: "TZS",
  cargoWeight: "",
  estimatedDistance: "",
  estimatedDuration: "",
  notes: "",
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: any | null;
  onSaved?: () => void;
}

export function TripFormDialog({ open, onOpenChange, trip, onSaved }: Props) {
  const { user } = useSupabase();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [form, setForm] = useState<TripFormState>(empty);
  const isEdit = Boolean(trip?.id);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [d, v] = await Promise.all([
        supabase.from("user_profiles").select("id, uid, name, role").eq("role", "DRIVER").order("name"),
        supabase.from("vehicles").select("id, plate_number, make, model, type, trailer_sub_type, status").order("plate_number"),
      ]);
      setDrivers(d.data ?? []);
      setVehicles(v.data ?? []);
    })();

    if (trip) {
      setForm({
        trip_number: trip.trip_number ?? "",
        origin: trip.origin ?? "",
        destination: trip.destination ?? "",
        cargo: trip.cargo ?? trip.cargoType ?? trip.cargo_type ?? "",
        client: trip.client ?? "",
        driverId: trip.driverId ?? trip.driver_id ?? "",
        truckId: trip.truckId ?? trip.vehicle_id ?? "",
        trailerId: trip.trailerId ?? "",
        status: (trip.status ?? "pending").toString().toLowerCase(),
        salesAmount: trip.salesAmount ?? "",
        vatRate: trip.vatRate ?? 18,
        currency: trip.currency ?? "TZS",
        cargoWeight: trip.cargoWeight ?? "",
        estimatedDistance: trip.estimatedDistance ?? "",
        estimatedDuration: trip.estimatedDuration ?? "",
        notes: trip.notes ?? "",
      });
    } else {
      setForm({
        ...empty(),
        trip_number: `TRP-${Date.now().toString().slice(-6)}`,
      });
    }
  }, [open, trip]);

  const trucks = useMemo(
    () => vehicles.filter((v) => ["DUMP_TRUCK", "TRUCK_HEAD"].includes(v.type)),
    [vehicles],
  );
  const trailers = useMemo(
    () => vehicles.filter((v) => v.type === "TRAILER"),
    [vehicles],
  );

  const patch = (p: Partial<TripFormState>) => setForm((prev) => ({ ...prev, ...p }));

  const totals = useMemo(() => {
    const net = Number(form.salesAmount) || 0;
    const vat = net * ((Number(form.vatRate) || 0) / 100);
    return { net, vat, total: net + vat };
  }, [form.salesAmount, form.vatRate]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.origin.trim() || !form.destination.trim()) {
      toast({ title: "Missing fields", description: "Origin and destination are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        trip_number: form.trip_number || `TRP-${Date.now().toString().slice(-6)}`,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        cargo: form.cargo || null,
        cargo_type: form.cargo || null,
        client: form.client || null,
        driverId: form.driverId || null,
        driver_id: form.driverId || null,
        truckId: form.truckId || null,
        vehicle_id: form.truckId || null,
        trailerId: form.trailerId || null,
        status: form.status,
        salesAmount: form.salesAmount === "" ? null : Number(form.salesAmount),
        vatRate: form.vatRate === "" ? null : Number(form.vatRate),
        vatAmount: totals.vat || null,
        totalAmount: totals.total || null,
        currency: form.currency,
        cargoWeight: form.cargoWeight === "" ? null : Number(form.cargoWeight),
        estimatedDistance: form.estimatedDistance === "" ? null : Number(form.estimatedDistance),
        estimatedDuration: form.estimatedDuration === "" ? null : Number(form.estimatedDuration),
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit) {
        const { error } = await supabase.from("trips").update(payload).eq("id", trip.id);
        if (error) throw error;
        await AuditTrailService.logUpdate("operations", "trip", trip.id, trip, payload, user?.id, `Updated trip ${payload.trip_number}`);
        toast({ title: "Trip updated" });
      } else {
        payload.created_at = new Date().toISOString();
        const { data, error } = await supabase.from("trips").insert(payload).select().maybeSingle();
        if (error) throw error;
        if (data?.id) {
          await AuditTrailService.logCreate("operations", "trip", data.id, data, user?.id, `Created trip ${payload.trip_number}`);
        }
        toast({ title: "Trip created", description: payload.trip_number });
      }

      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      console.error("[trip-form]", err);
      const raw = err?.message ?? String(err);
      const hint =
        raw.includes("permission") || raw.includes("policy") ? "Your role isn't allowed to create trips. Contact an admin." :
        raw.includes("does not exist") ? "The trips table is missing a column. Run the latest migrations." :
        raw;
      toast({ title: isEdit ? "Update failed" : "Create failed", description: hint, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <RouteIcon className="w-4 h-4" />
            </div>
            <DialogTitle>{isEdit ? "Edit trip" : "Create new trip"}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={save} className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Route</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Trip number</Label>
                <Input value={form.trip_number} onChange={(e) => patch({ trip_number: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client / customer</Label>
                <Input value={form.client} onChange={(e) => patch({ client: e.target.value })} placeholder="Company name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origin *</Label>
                <Input value={form.origin} onChange={(e) => patch({ origin: e.target.value })} placeholder="Dar es Salaam" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destination *</Label>
                <Input value={form.destination} onChange={(e) => patch({ destination: e.target.value })} placeholder="Lusaka" required />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cargo / description</Label>
              <Input value={form.cargo} onChange={(e) => patch({ cargo: e.target.value })} placeholder="e.g. Cement 40 tons" />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assignment</legend>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Driver</Label>
                <Select value={form.driverId || "__none"} onValueChange={(v) => patch({ driverId: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {drivers.map((d) => <SelectItem key={d.id ?? d.uid} value={d.id ?? d.uid}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Truck</Label>
                <Select value={form.truckId || "__none"} onValueChange={(v) => patch({ truckId: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {trucks.map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_number} · {v.make} {v.model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Trailer</Label>
                <Select value={form.trailerId || "__none"} onValueChange={(v) => patch({ trailerId: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select trailer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No trailer</SelectItem>
                    {trailers.map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_number} · {v.trailer_sub_type ?? "Trailer"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => patch({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="loading">Loading</SelectItem>
                    <SelectItem value="in_transit">In transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo weight (t)</Label>
                <Input type="number" value={form.cargoWeight} onChange={(e) => patch({ cargoWeight: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estimates &amp; pricing</legend>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Distance (km)</Label>
                <Input type="number" value={form.estimatedDistance} onChange={(e) => patch({ estimatedDistance: e.target.value === "" ? "" : Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Duration (hrs)</Label>
                <Input type="number" value={form.estimatedDuration} onChange={(e) => patch({ estimatedDuration: e.target.value === "" ? "" : Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Freight (net)</Label>
                <Input type="number" value={form.salesAmount} onChange={(e) => patch({ salesAmount: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={form.currency} onValueChange={(v) => patch({ currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TZS">TZS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="KES">KES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">VAT rate (%)</Label>
                <Input type="number" value={form.vatRate} onChange={(e) => patch({ vatRate: e.target.value === "" ? "" : Number(e.target.value) })} />
              </div>
              <div className="col-span-2 rounded-xl bg-muted/40 border border-border p-3 text-xs space-y-0.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{new Intl.NumberFormat().format(totals.net)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span className="font-mono">{new Intl.NumberFormat().format(totals.vat)}</span></div>
                <div className="flex justify-between font-black text-foreground pt-1 border-t border-border"><span>Total</span><span className="font-mono">{new Intl.NumberFormat().format(totals.total)} {form.currency}</span></div>
              </div>
            </div>
          </fieldset>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => patch({ notes: e.target.value })} rows={3} placeholder="Any special instructions" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? "Save trip" : "Create trip"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
