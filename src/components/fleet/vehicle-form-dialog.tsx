"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useToast } from "@/hooks/use-toast";
import { AuditTrailService } from "@/services/audit-trail-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save, Truck } from "lucide-react";

/**
 * Add / edit a vehicle.
 *
 * Field set intentionally matches every column the fleet page and
 * compliance report read — plate, make, model, year, type, status,
 * mileage, fuel capacity, service due date, insurance / registration
 * expiry. That way a new vehicle immediately appears with correct
 * expiry chips and utilization math.
 *
 * On success the parent's `onSaved` runs, so it can refresh its list
 * without a hard reload.
 */

type FleetType = "DUMP_TRUCK" | "TRUCK_HEAD" | "TRAILER" | "ESCORT_CAR";
type Status = "available" | "in_use" | "maintenance" | "out_of_service";

interface VehicleFormState {
  plate_number: string;
  make: string;
  model: string;
  year: number;
  type: FleetType;
  trailer_sub_type: "LOWBED" | "FLATBED" | "";
  status: Status;
  mileage: number | "";
  fuel_capacity: number | "";
  service_interval_km: number | "";
  next_maintenance_due: string;
  insurance_expiry: string;
  registration_expiry: string;
  next_inspection_due: string;
}

const empty = (): VehicleFormState => ({
  plate_number: "",
  make: "",
  model: "",
  year: new Date().getFullYear(),
  type: "DUMP_TRUCK",
  trailer_sub_type: "",
  status: "available",
  mileage: "",
  fuel_capacity: "",
  service_interval_km: "",
  next_maintenance_due: "",
  insurance_expiry: "",
  registration_expiry: "",
  next_inspection_due: "",
});

/** Rows written before the status vocabulary was unified may carry legacy
 *  values; normalize them for display when editing. Writes always use the
 *  canonical app vocabulary (migration 026 makes the CHECK accept it). */
const fromLegacyStatus = (status: string | null | undefined): Status => {
  switch (status) {
    case "available":
    case "in_use":
    case "maintenance":
    case "out_of_service":
      return status;
    case "active":
      return "available";
    case "sold":
    case "decommissioned":
      return "out_of_service";
    default:
      return "available";
  }
};

/** Typed payload matching the live `vehicles` columns exactly — one insert,
 *  no field-stripping retries. A schema mismatch must surface as a real error. */
interface VehicleWritePayload {
  plate_number: string;
  make: string;
  model: string;
  year: number;
  type: FleetType;
  trailer_sub_type: string | null;
  status: Status;
  mileage: number | null;
  fuel_capacity: number | null;
  service_interval_km: number | null;
  next_maintenance_due: string | null;
  insurance_expiry: string | null;
  registration_expiry: string | null;
  next_inspection_due: string | null;
  updated_at: string;
  created_at?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Populate the form for editing. Omit to add a new vehicle. */
  vehicle?: any | null;
  onSaved?: () => void;
}

export function VehicleFormDialog({ open, onOpenChange, vehicle, onSaved }: Props) {
  const { user } = useSupabase();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VehicleFormState>(empty);
  const isEdit = Boolean(vehicle?.id);

  useEffect(() => {
    if (!open) return;
    if (vehicle) {
      setForm({
        plate_number: vehicle.plate_number ?? vehicle.plateNumber ?? "",
        make: vehicle.make ?? "",
        model: vehicle.model ?? "",
        year: Number(vehicle.year ?? new Date().getFullYear()),
        type: (vehicle.type ?? "DUMP_TRUCK") as FleetType,
        trailer_sub_type: (vehicle.trailer_sub_type ?? vehicle.trailerSubType ?? "") as any,
        status: fromLegacyStatus(vehicle.status),
        mileage: vehicle.mileage ?? "",
        fuel_capacity: vehicle.fuel_capacity ?? vehicle.fuelCapacity ?? "",
        service_interval_km: vehicle.service_interval_km ?? "",
        next_maintenance_due: (vehicle.next_maintenance_due ?? "").slice(0, 10),
        insurance_expiry: (vehicle.insurance_expiry ?? vehicle.insuranceExpiry ?? "").slice(0, 10),
        registration_expiry: (vehicle.registration_expiry ?? vehicle.registrationExpiry ?? "").slice(0, 10),
        next_inspection_due: (vehicle.next_inspection_due ?? "").slice(0, 10),
      });
    } else {
      setForm(empty());
    }
  }, [open, vehicle]);

  const patch = (p: Partial<VehicleFormState>) => setForm((prev) => ({ ...prev, ...p }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plate_number.trim() || !form.make.trim() || !form.model.trim()) {
      toast({ title: "Missing fields", description: "Plate, make and model are required.", variant: "destructive" });
      return;
    }
    if (form.type === "TRAILER" && !form.trailer_sub_type) {
      toast({ title: "Trailer sub-type required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: VehicleWritePayload = {
        plate_number: form.plate_number.trim().toUpperCase(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year) || new Date().getFullYear(),
        type: form.type,
        trailer_sub_type: form.type === "TRAILER" ? form.trailer_sub_type : null,
        status: form.status,
        mileage: form.mileage === "" ? null : Number(form.mileage),
        fuel_capacity: form.fuel_capacity === "" ? null : Number(form.fuel_capacity),
        service_interval_km: form.service_interval_km === "" ? null : Number(form.service_interval_km),
        next_maintenance_due: form.next_maintenance_due || null,
        insurance_expiry: form.insurance_expiry || null,
        registration_expiry: form.registration_expiry || null,
        next_inspection_due: form.next_inspection_due || null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", vehicle.id);
        if (error) throw error;
        await AuditTrailService.logUpdate("management", "vehicle", vehicle.id, vehicle, payload, user?.id, `Updated vehicle ${payload.plate_number}`);
        toast({ title: "Vehicle updated", description: payload.plate_number });
      } else {
        payload.created_at = new Date().toISOString();
        const { data, error } = await supabase.from("vehicles").insert(payload).select().maybeSingle();
        if (error) throw error;
        if (data?.id) {
          await AuditTrailService.logCreate("management", "vehicle", data.id, data, user?.id, `Added vehicle ${payload.plate_number}`);
        }
        toast({ title: "Vehicle added", description: payload.plate_number });
      }

      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      console.error("[vehicle-form]", err);
      const raw = err?.message ?? String(err);
      // Surface the real database error with an actionable hint
      const hint =
        raw.includes("duplicate key") ? "A vehicle with this plate already exists." :
          raw.includes("permission") || raw.includes("policy") ? "Your role isn't allowed to add vehicles. Contact an admin." :
            raw.includes("does not exist") ? `Database schema is out of date — run migration 026 in Supabase. (${raw})` :
              raw.includes("check constraint") ? `The database rejected a field value — run migration 026 in Supabase. (${raw})` :
                raw;
      toast({ title: isEdit ? "Update failed" : "Add failed", description: hint, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <DialogTitle>{isEdit ? "Edit vehicle" : "Add vehicle to fleet"}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={save} className="space-y-5">
          {/* Identity */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Identity</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Plate number *</Label>
                <Input value={form.plate_number} onChange={(e) => patch({ plate_number: e.target.value })} placeholder="T 123 ABC" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Year *</Label>
                <Input type="number" value={form.year} min={2000} max={new Date().getFullYear() + 1} onChange={(e) => patch({ year: parseInt(e.target.value) || new Date().getFullYear() })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Make *</Label>
                <Input value={form.make} onChange={(e) => patch({ make: e.target.value })} placeholder="Volvo" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Model *</Label>
                <Input value={form.model} onChange={(e) => patch({ model: e.target.value })} placeholder="FH16" required />
              </div>
            </div>
          </fieldset>

          {/* Classification */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Classification</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type *</Label>
                <Select value={form.type} onValueChange={(v) => patch({ type: v as FleetType, trailer_sub_type: v === "TRAILER" ? form.trailer_sub_type : "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DUMP_TRUCK">Dump truck</SelectItem>
                    <SelectItem value="TRUCK_HEAD">Truck head (prime mover)</SelectItem>
                    <SelectItem value="TRAILER">Trailer</SelectItem>
                    <SelectItem value="ESCORT_CAR">Escort car</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.type === "TRAILER" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Trailer type *</Label>
                  <Select value={form.trailer_sub_type} onValueChange={(v) => patch({ trailer_sub_type: v as any })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOWBED">Lowbed</SelectItem>
                      <SelectItem value="FLATBED">Flatbed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => patch({ status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="in_use">In use</SelectItem>
                      <SelectItem value="maintenance">In maintenance</SelectItem>
                      <SelectItem value="out_of_service">Out of service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {form.type === "TRAILER" && (
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => patch({ status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="in_use">In use</SelectItem>
                    <SelectItem value="maintenance">In maintenance</SelectItem>
                    <SelectItem value="out_of_service">Out of service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </fieldset>

          {/* Odometer & fuel */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Odometer &amp; fuel</legend>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Mileage (km)</Label>
                <Input type="number" value={form.mileage} onChange={(e) => patch({ mileage: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fuel capacity (L)</Label>
                <Input type="number" value={form.fuel_capacity} onChange={(e) => patch({ fuel_capacity: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="300" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Service every (km)</Label>
                <Input type="number" value={form.service_interval_km} onChange={(e) => patch({ service_interval_km: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="10000" />
              </div>
            </div>
          </fieldset>

          {/* Compliance dates */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Compliance &amp; scheduling</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Insurance expires</Label>
                <Input type="date" value={form.insurance_expiry} onChange={(e) => patch({ insurance_expiry: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Registration expires</Label>
                <Input type="date" value={form.registration_expiry} onChange={(e) => patch({ registration_expiry: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Next inspection</Label>
                <Input type="date" value={form.next_inspection_due} onChange={(e) => patch({ next_inspection_due: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Next service due</Label>
                <Input type="date" value={form.next_maintenance_due} onChange={(e) => patch({ next_maintenance_due: e.target.value })} />
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? "Save changes" : "Add vehicle"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
