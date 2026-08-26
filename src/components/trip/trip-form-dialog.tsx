"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useToast } from "@/hooks/use-toast";
import { AuditTrailService } from "@/services/audit-trail-service";
import { createNotification } from "@/services/notification-service";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlaceAutocomplete } from "@/components/ui/place-autocomplete";
import { Loader2, Plus, Route as RouteIcon, Save, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";

interface DispatchSuggestion {
  driverId: string;
  vehicleId: string;
  trailerId?: string;
  score: number;
  reasoning: string;
}

/** An additional truck+driver(+trailer) on the same trip, beyond the primary assignment above. */
interface ExtraAssignment {
  id?: string;
  driverId: string;
  truckId: string;
  trailerId: string;
}
const emptyAssignment = (): ExtraAssignment => ({ driverId: "", truckId: "", trailerId: "" });

const RoutePreviewMap = dynamic(
  () => import("@/components/trip/route-preview-map").then((m) => m.RoutePreviewMap),
  { ssr: false },
);

/**
 * Add / edit a trip.
 *
 * Kept intentionally lean: the fields that the trip list, dispatch board,
 * driver dashboard, POD flow and finance auto-invoicing actually read.
 * Anything else can be edited later on the trip detail page.
 */

interface TripFormState {
  trip_number: string;
  quotationId: string;
  origin: string;
  destination: string;
  cargo: string;
  client: string;
  driverId: string;
  truckId: string;
  trailerId: string;
  status: string;
  tripType: "local" | "transit";
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
  quotationId: "",
  origin: "",
  destination: "",
  cargo: "",
  client: "",
  driverId: "",
  truckId: "",
  trailerId: "",
  status: "pending",
  tripType: "local",
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
  /** Set when opened from a Shipment's "Assign Truck" / "Create Trip Order" action. */
  shipmentId?: string;
  defaultOrigin?: string;
  defaultDestination?: string;
  /** Set when opened from a Shipment — that shipment's own quotation, prefilled. */
  defaultQuotationId?: string;
}

export function TripFormDialog({ open, onOpenChange, trip, onSaved, shipmentId, defaultOrigin, defaultDestination, defaultQuotationId }: Props) {
  const { user } = useSupabase();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [form, setForm] = useState<TripFormState>(empty);
  const [extraAssignments, setExtraAssignments] = useState<ExtraAssignment[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<DispatchSuggestion[]>([]);
  const [suggestionCaveats, setSuggestionCaveats] = useState<string[]>([]);
  const isEdit = Boolean(trip?.id);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [d, v, q] = await Promise.all([
        supabase.from("user_profiles").select("id, name, role").eq("role", "DRIVER").order("name"),
        supabase.from("vehicles").select("id, plate_number, make, model, type, trailer_sub_type, status").order("plate_number"),
        supabase.from("quotations").select("id, quotation_number, origin, destination, subtotal, vat_rate, currency").order("created_at", { ascending: false }).limit(200),
      ]);
      // user_profiles has no "uid" column — selecting it made this query
      // fail outright, and the error was silently swallowed by `?? []`,
      // so the Driver dropdown looked "empty" even with real drivers on
      // file. Kept `d.id ?? d.uid` elsewhere as a no-op fallback since
      // `.id` is what actually exists.
      if (d.error) console.error("Failed to load drivers:", d.error);
      if (v.error) console.error("Failed to load vehicles:", v.error);
      if (q.error) console.error("Failed to load quotations:", q.error);
      setDrivers(d.data ?? []);
      setVehicles(v.data ?? []);
      setQuotations(q.data ?? []);
    })();

    if (trip?.id) {
      supabase
        .from("trip_assignments")
        .select("id, driver_id, truck_id, trailer_id")
        .eq("trip_id", trip.id)
        .order("created_at", { ascending: true })
        .then(({ data, error }) => {
          if (error) { console.error("Failed to load trip assignments:", error); return; }
          setExtraAssignments(
            (data ?? []).map((a) => ({ id: a.id, driverId: a.driver_id ?? "", truckId: a.truck_id ?? "", trailerId: a.trailer_id ?? "" })),
          );
        });
    } else {
      setExtraAssignments([]);
    }

    if (trip) {
      setForm({
        trip_number: trip.trip_number ?? "",
        quotationId: trip.quotation_id ?? defaultQuotationId ?? "",
        origin: trip.origin ?? "",
        destination: trip.destination ?? "",
        cargo: trip.cargo_type ?? trip.cargo ?? "",
        client: trip.client ?? "",
        driverId: trip.driver_id ?? trip.driverId ?? "",
        truckId: trip.truck_id ?? trip.truckId ?? trip.vehicle_id ?? "",
        trailerId: trip.trailer_id ?? trip.trailerId ?? "",
        status: (trip.status ?? "pending").toString().toLowerCase(),
        tripType: (trip.trip_type ?? "local") === "transit" ? "transit" : "local",
        salesAmount: trip.sales_amount ?? trip.salesAmount ?? "",
        vatRate: trip.vat_rate ?? trip.vatRate ?? 18,
        currency: trip.currency ?? "TZS",
        cargoWeight: trip.cargo_weight ?? trip.cargoWeight ?? "",
        estimatedDistance: trip.estimated_distance ?? trip.estimatedDistance ?? "",
        estimatedDuration: trip.estimated_duration ?? trip.estimatedDuration ?? "",
        notes: trip.notes ?? "",
      });
    } else {
      setForm({
        ...empty(),
        trip_number: `TRP-${Date.now().toString().slice(-6)}`,
        quotationId: defaultQuotationId ?? "",
        origin: defaultOrigin ?? "",
        destination: defaultDestination ?? "",
      });
    }
    setSuggestions([]);
    setSuggestionCaveats([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trip]);

  const fetchSuggestions = async () => {
    setSuggesting(true);
    setSuggestions([]);
    setSuggestionCaveats([]);
    try {
      const res = await fetch("/api/ai/dispatch-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: form.origin,
          destination: form.destination,
          cargoDescription: form.cargo,
          cargoWeightTons: form.cargoWeight === "" ? undefined : form.cargoWeight,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Suggestion request failed");
      setSuggestions(json.suggestions ?? []);
      setSuggestionCaveats(json.caveats ?? []);
      if ((json.suggestions ?? []).length === 0) {
        toast({ title: "No suggestions", description: json.caveats?.[0] ?? "No available drivers/vehicles matched." });
      }
    } catch (err: any) {
      toast({ title: "Suggestion failed", description: err.message, variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = (s: DispatchSuggestion) => {
    const vehicle = vehicles.find((v) => v.id === s.vehicleId);
    const isTrailer = vehicle?.type === "TRAILER";
    patch({
      driverId: s.driverId,
      truckId: isTrailer ? form.truckId : s.vehicleId,
      trailerId: s.trailerId ?? (isTrailer ? s.vehicleId : form.trailerId),
    });
    setSuggestions([]);
  };

  const trucks = useMemo(
    () => vehicles.filter((v) => ["DUMP_TRUCK", "TRUCK_HEAD"].includes(v.type)),
    [vehicles],
  );
  const trailers = useMemo(
    () => vehicles.filter((v) => v.type === "TRAILER"),
    [vehicles],
  );

  const patch = (p: Partial<TripFormState>) => setForm((prev) => ({ ...prev, ...p }));

  const addExtraAssignment = () => setExtraAssignments((prev) => [...prev, emptyAssignment()]);
  const patchExtraAssignment = (index: number, p: Partial<ExtraAssignment>) =>
    setExtraAssignments((prev) => prev.map((a, i) => (i === index ? { ...a, ...p } : a)));
  const removeExtraAssignment = (index: number) => setExtraAssignments((prev) => prev.filter((_, i) => i !== index));

  // Transit (cross-border) trips are VAT-exempt; local trips carry VAT.
  const effectiveVatRate = form.tripType === "transit" ? 0 : Number(form.vatRate) || 0;

  const totals = useMemo(() => {
    const net = Number(form.salesAmount) || 0;
    const vat = net * (effectiveVatRate / 100);
    return { net, vat, total: net + vat };
  }, [form.salesAmount, effectiveVatRate]);

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
        quotation_id: form.quotationId || null,
        shipment_id: shipmentId || trip?.shipment_id || null,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        cargo_type: form.cargo || null,
        client: form.client || null,
        driver_id: form.driverId || null,
        truck_id: form.truckId || null,
        trailer_id: form.trailerId || null,
        status: form.status,
        trip_type: form.tripType,
        is_cross_border: form.tripType === "transit",
        sales_amount: form.salesAmount === "" ? null : Number(form.salesAmount),
        vat_rate: effectiveVatRate,
        vat_amount: totals.vat || 0,
        total_amount: totals.total || null,
        currency: form.currency,
        cargo_weight: form.cargoWeight === "" ? null : Number(form.cargoWeight),
        estimated_distance: form.estimatedDistance === "" ? null : Number(form.estimatedDistance),
        estimated_duration: form.estimatedDuration === "" ? null : Number(form.estimatedDuration),
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };

      let tripId: string;

      if (isEdit) {
        const { error } = await supabase.from("trips").update(payload).eq("id", trip.id);
        if (error) throw error;
        await AuditTrailService.logUpdate("operations", "trip", trip.id, trip, payload, user?.id, `Updated trip ${payload.trip_number}`);
        toast({ title: "Trip updated" });
        tripId = trip.id;
      } else {
        payload.created_at = new Date().toISOString();
        const { data, error } = await supabase.from("trips").insert(payload).select().maybeSingle();
        if (error) throw error;
        tripId = data!.id;
        if (data?.id) {
          await AuditTrailService.logCreate("operations", "trip", data.id, data, user?.id, `Created trip ${payload.trip_number}`);
        }
        toast({ variant: "success", title: "Trip created", description: payload.trip_number });

        // Let the salesman who closed this deal know dispatch is moving on
        // it — otherwise a trip gets created and assigned with nobody who
        // actually owns the customer relationship aware it happened.
        if (payload.shipment_id) {
          const { data: shipmentRow } = await supabase.from("shipments").select("quotation_id, shipment_number").eq("id", payload.shipment_id).maybeSingle();
          if (shipmentRow?.quotation_id) {
            const { data: quotationRow } = await supabase.from("quotations").select("created_by, quotation_number").eq("id", shipmentRow.quotation_id).maybeSingle();
            if (quotationRow?.created_by && quotationRow.created_by !== user?.id) {
              await createNotification({
                userId: quotationRow.created_by,
                title: "Trip created for your shipment",
                message: `${payload.trip_number} was created for ${shipmentRow.shipment_number} (from ${quotationRow.quotation_number}).`,
                type: "info",
                module: "sales",
                entityType: "trip",
                entityId: data?.id,
                actionUrl: `/shipments/${payload.shipment_id}`,
              });
            }
          }
        }
      }

      // Replace this trip's additional assignments wholesale — simpler and
      // safer than diffing adds/edits/removes, and this table has no other
      // consumers yet to worry about disturbing.
      await supabase.from("trip_assignments").delete().eq("trip_id", tripId);
      const rowsToInsert = extraAssignments
        .filter((a) => a.driverId || a.truckId || a.trailerId)
        .map((a) => ({
          trip_id: tripId,
          driver_id: a.driverId || null,
          truck_id: a.truckId || null,
          trailer_id: a.trailerId || null,
          created_by: user?.id || null,
        }));
      if (rowsToInsert.length > 0) {
        const { error: assignError } = await supabase.from("trip_assignments").insert(rowsToInsert);
        if (assignError) throw assignError;
      }

      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      console.error("[trip-form]", err);
      const raw = err?.message ?? String(err);
      // "permission denied" (no RLS wording) means the request never
      // carried a valid session at all — Postgres rejected it at the
      // GRANT level before RLS was even evaluated, which happens to any
      // role, admin included, once the browser's session has gone stale.
      // A real RLS rejection instead says "violates row-level security
      // policy" — genuinely a role problem. These used to show the same
      // "contact an admin" message, which is wrong (and confusing) for
      // an actual admin hitting a stale session.
      const hint =
        raw.includes("row-level security policy") ? `Your role isn't allowed to create trips. Contact an admin. (${raw})` :
        raw.includes("permission denied") ? `Permission error — likely a missing grant, not your login. (${raw})` :
        raw.includes("does not exist") ? "The trips table is missing a column. Run the latest migrations." :
        raw;
      toast({ title: isEdit ? "Update failed" : "Create failed", description: hint, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] p-0 sm:p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 sm:p-6 pb-0 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <RouteIcon className="w-4 h-4" />
            </div>
            <DialogTitle>{isEdit ? "Edit trip" : "Create new trip"}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
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
            <div className="space-y-1">
              <Label className="text-xs">Quotation Ref No</Label>
              <Select
                value={form.quotationId || "__none"}
                onValueChange={(v) => {
                  if (v === "__none") { patch({ quotationId: "" }); return; }
                  const q = quotations.find((x) => x.id === v);
                  // The price was already agreed in the quotation — pull it
                  // in rather than making someone re-key it for the trip.
                  patch({
                    quotationId: v,
                    ...(q ? {
                      salesAmount: Number(q.subtotal) || 0,
                      vatRate: Number(q.vat_rate) || 0,
                      currency: q.currency || form.currency,
                      origin: form.origin || q.origin || "",
                      destination: form.destination || q.destination || "",
                    } : {}),
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Not tied to a quotation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— No quotation —</SelectItem>
                  {quotations.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.quotation_number} · {q.origin} → {q.destination}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Multiple trips (trucks) can share one quotation ref for the same job — selecting one fills in its agreed price.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origin *</Label>
                <PlaceAutocomplete value={form.origin} onChange={(v) => patch({ origin: v })} placeholder="Dar es Salaam" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destination *</Label>
                <PlaceAutocomplete value={form.destination} onChange={(v) => patch({ destination: v })} placeholder="Lusaka" required />
              </div>
            </div>
            <RoutePreviewMap
              origin={form.origin}
              destination={form.destination}
              onRoute={({ distanceKm, durationHrs }) =>
                // Only auto-fill when empty — a value already present means
                // it came from a prefill (e.g. the Route Optimizer's
                // multi-stop distance, which this point-to-point preview
                // can't reproduce) or the user already edited it, and
                // either way it shouldn't be silently clobbered.
                setForm((prev) =>
                  prev.estimatedDistance !== ""
                    ? prev
                    : {
                        ...prev,
                        estimatedDistance: Math.round(distanceKm),
                        estimatedDuration: Math.round(durationHrs * 10) / 10,
                      },
                )
              }
            />
            <div className="space-y-1">
              <Label className="text-xs">Cargo / description</Label>
              <Input value={form.cargo} onChange={(e) => patch({ cargo: e.target.value })} placeholder="e.g. Cement 40 tons" />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assignment</legend>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={!form.origin.trim() || !form.destination.trim() || suggesting}
                onClick={fetchSuggestions}
              >
                {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Suggest driver/vehicle
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                {suggestions.map((s, i) => {
                  const driver = drivers.find((d) => (d.id ?? d.uid) === s.driverId);
                  const vehicle = vehicles.find((v) => v.id === s.vehicleId);
                  return (
                    <div key={i} className="flex items-start justify-between gap-3 rounded-lg bg-background border border-border p-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">
                          {driver?.name ?? "Unknown driver"} · {vehicle?.plate_number ?? "Unknown vehicle"}
                          <span className="ml-1.5 text-muted-foreground font-normal">({s.score}/100)</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.reasoning}</p>
                      </div>
                      <Button type="button" size="sm" className="h-7 shrink-0 text-xs" onClick={() => applySuggestion(s)}>
                        Use this
                      </Button>
                    </div>
                  );
                })}
                {suggestionCaveats.length > 0 && (
                  <p className="text-[10px] text-muted-foreground italic">{suggestionCaveats.join(" · ")}</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            {extraAssignments.length > 0 && (
              <div className="space-y-2">
                {extraAssignments.map((a, i) => (
                  <div key={a.id ?? i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end rounded-xl border border-border p-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Driver {i + 2}</Label>
                      <Select value={a.driverId || "__none"} onValueChange={(v) => patchExtraAssignment(i, { driverId: v === "__none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Unassigned</SelectItem>
                          {drivers.map((d) => <SelectItem key={d.id ?? d.uid} value={d.id ?? d.uid}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Truck {i + 2}</Label>
                      <Select value={a.truckId || "__none"} onValueChange={(v) => patchExtraAssignment(i, { truckId: v === "__none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Unassigned</SelectItem>
                          {trucks.map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_number} · {v.make} {v.model}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Trailer {i + 2}</Label>
                      <Select value={a.trailerId || "__none"} onValueChange={(v) => patchExtraAssignment(i, { trailerId: v === "__none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="No trailer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">No trailer</SelectItem>
                          {trailers.map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_number} · {v.trailer_sub_type ?? "Trailer"}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeExtraAssignment(i)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={addExtraAssignment}>
              <Plus className="w-3.5 h-3.5" />
              Add another truck / driver
            </Button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Trip type</Label>
                <Select value={form.tripType} onValueChange={(v) => patch({ tripType: v as "local" | "transit" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local (VAT applies)</SelectItem>
                    <SelectItem value="transit">Transit (VAT exempt)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">VAT rate (%)</Label>
                {form.tripType === "transit" ? (
                  <div className="h-10 flex items-center px-3 rounded-md border border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                    Exempt (transit)
                  </div>
                ) : (
                  <Input type="number" value={form.vatRate} onChange={(e) => patch({ vatRate: e.target.value === "" ? "" : Number(e.target.value) })} />
                )}
              </div>
              <div className="col-span-2 rounded-xl bg-muted/40 border border-border p-3 text-xs space-y-0.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{new Intl.NumberFormat().format(totals.net)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT{form.tripType === "transit" ? " (exempt — transit)" : ` (${effectiveVatRate}%)`}</span>
                  <span className="font-mono">{new Intl.NumberFormat().format(totals.vat)}</span>
                </div>
                <div className="flex justify-between font-black text-foreground pt-1 border-t border-border"><span>Total</span><span className="font-mono">{new Intl.NumberFormat().format(totals.total)} {form.currency}</span></div>
              </div>
            </div>
          </fieldset>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => patch({ notes: e.target.value })} rows={3} placeholder="Any special instructions" />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 sm:p-6 pt-3 border-t border-border shrink-0 bg-card">
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
