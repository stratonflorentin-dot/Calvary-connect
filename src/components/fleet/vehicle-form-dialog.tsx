"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { AuditTrailService } from "@/services/audit-trail-service";
import { uploadToBucket } from "@/lib/storage-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Loader2, Save, Truck } from "lucide-react";

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
  purchase_price: number | "";
  purchase_date: string;
  financed: boolean;
  lender: string;
  down_payment: number | "";
  interest_rate: number | "";
  installment_amount: number | "";
  down_payment_bank_account_id: string;
  fixed_asset_account_code: string;
  loan_payable_account_code: string;
  gps_provider: "" | "cartrack" | "wialon";
  gps_device_id: string;
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
  purchase_price: "",
  purchase_date: "",
  financed: false,
  lender: "",
  down_payment: "",
  interest_rate: "",
  installment_amount: "",
  down_payment_bank_account_id: "",
  fixed_asset_account_code: "",
  loan_payable_account_code: "",
  gps_provider: "",
  gps_device_id: "",
});

/** Fixed-asset / loan-payable account codes for a financed vehicle
 *  acquisition — mirrors the seeded Chart of Accounts split between
 *  Trucks and Trailers (1201/2201) and Motor Vehicles (1202/2202). */
function vehicleLoanAccountCodes(type: FleetType) {
  return type === "ESCORT_CAR"
    ? { fixedAssetCode: "1202", loanPayableCode: "2202" }
    : { fixedAssetCode: "1201", loanPayableCode: "2201" }; // DUMP_TRUCK, TRUCK_HEAD, TRAILER
}

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

/** Typed payload matching the live `vehicles` columns — one write, no
 *  field-stripping retries. A schema mismatch must surface as a real error. */
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
  next_maintenance_due?: string | null;
  insurance_expiry?: string | null;
  registration_expiry?: string | null;
  next_inspection_due?: string | null;
  photo_url?: string | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
  gps_provider?: string | null;
  gps_device_id?: string | null;
  updated_at: string;
  created_at?: string;
}

/** Columns added by migration 026. Until that migration runs, the live table
 *  doesn't have them: sending an empty one would fail the whole save, so empty
 *  values are omitted. A FILLED value is always sent — if the column is
 *  missing, the save fails with an explicit "run migration 026" error rather
 *  than silently discarding what the user typed. */
const MIGRATION_026_DATE_COLUMNS = [
  "next_maintenance_due",
  "registration_expiry",
] as const;

/** purchase_price/purchase_date (from 20240620_vehicle_details.sql) — same
 *  defensive send-only-when-filled treatment as the migration-026 columns
 *  above, since this UI can't confirm live schema state and a save
 *  shouldn't fail outright over an optional financial field. */
const VEHICLE_PURCHASE_COLUMNS = ["purchase_price", "purchase_date"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Populate the form for editing. Omit to add a new vehicle. */
  vehicle?: any | null;
  onSaved?: () => void;
}

export function VehicleFormDialog({ open, onOpenChange, vehicle, onSaved }: Props) {
  const { user } = useSupabase();
  const { role } = useRole();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VehicleFormState>(empty);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [assetAccounts, setAssetAccounts] = useState<{ code: string; name: string }[]>([]);
  const [liabilityAccounts, setLiabilityAccounts] = useState<{ code: string; name: string }[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(vehicle?.id);
  // Purchase price/financing are finance-sensitive fields — hidden entirely
  // for roles other than CEO/ADMIN/ACCOUNTANT. Note RLS on `vehicles` is
  // table-level, not column-level, so this is a UI-only gate; that matches
  // every other table in this app, none of which has column-level RLS.
  const canFinance = role === "CEO" || role === "ADMIN" || role === "ACCOUNTANT";

  const pickPhoto = () => photoInputRef.current?.click();
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  useEffect(() => {
    if (!open || !canFinance) return;
    supabase.from("bank_accounts").select("*").then(({ data }) => setBankAccounts(data ?? []));
    // This chart of accounts has more than one plausible account for a
    // vehicle acquisition (e.g. "Trucks and Trailers" vs "Motor Vehicles"
    // vs "Vehicles" on the asset side; "Truck Loan" vs "Bank Loan" vs
    // "Vehicle Financing" on the liability side) — vehicleLoanAccountCodes()
    // below only picks a sensible default by vehicle type, so both are
    // exposed as pickers rather than silently locked to that default.
    supabase.from("accounts").select("code, name").eq("category", "ASSETS").eq("is_postable", true).order("code")
      .then(({ data }) => setAssetAccounts(data ?? []));
    supabase.from("accounts").select("code, name").eq("category", "LIABILITIES").eq("is_postable", true).order("code")
      .then(({ data }) => setLiabilityAccounts(data ?? []));
  }, [open, canFinance]);

  useEffect(() => {
    if (!open) return;
    setPhotoFile(null);
    setPhotoPreview(vehicle?.photo_url ?? null);
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
        purchase_price: vehicle.purchase_price ?? "",
        purchase_date: (vehicle.purchase_date ?? "").slice(0, 10),
        // Financing is add-only from this dialog — editing a vehicle never
        // shows or touches vehicle_loans, so these always start blank.
        financed: false,
        lender: "",
        down_payment: "",
        interest_rate: "",
        installment_amount: "",
        down_payment_bank_account_id: "",
        fixed_asset_account_code: "",
        loan_payable_account_code: "",
        gps_provider: (vehicle.gps_provider ?? "") as any,
        gps_device_id: vehicle.gps_device_id ?? "",
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
    if (form.gps_provider && !form.gps_device_id.trim()) {
      toast({ title: "Device ID required", description: "Enter the Cartrack/Wialon device ID for this vehicle, or clear the provider.", variant: "destructive" });
      return;
    }
    if (!isEdit && canFinance && form.financed) {
      if (!form.lender.trim()) {
        toast({ title: "Lender required", description: "Enter who financed this vehicle.", variant: "destructive" });
        return;
      }
      const price = form.purchase_price === "" ? 0 : Number(form.purchase_price);
      const down = form.down_payment === "" ? 0 : Number(form.down_payment);
      if (price <= 0) {
        toast({ title: "Purchase price required", description: "Enter a purchase price to record financing.", variant: "destructive" });
        return;
      }
      if (down >= price) {
        toast({ title: "Down payment too large", description: "Down payment must be less than the purchase price.", variant: "destructive" });
        return;
      }
      if (down > 0 && !form.down_payment_bank_account_id) {
        toast({ title: "Bank account required", description: "Select which account the down payment came from.", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      let photoUrl = vehicle?.photo_url ?? null;
      if (photoFile) {
        const uploaded = await uploadToBucket("vehicle-photos", "vehicles", photoFile);
        if (!uploaded) {
          toast({ title: "Photo upload failed", description: "Vehicle was not saved. Please try again.", variant: "destructive" });
          setSaving(false);
          return;
        }
        photoUrl = uploaded;
      }

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
        insurance_expiry: form.insurance_expiry || null,
        next_inspection_due: form.next_inspection_due || null,
        gps_provider: form.gps_provider || null,
        gps_device_id: form.gps_provider ? form.gps_device_id.trim() : null,
        updated_at: new Date().toISOString(),
      };

      // Migration-026 columns: include only when the user provided a value
      // (or is clearing a previously stored one during edit).
      for (const col of MIGRATION_026_DATE_COLUMNS) {
        const value = form[col];
        if (value) {
          payload[col] = value;
        } else if (isEdit && vehicle?.[col]) {
          payload[col] = null; // user cleared an existing date
        }
      }

      // purchase_price/purchase_date — same conditional-send treatment.
      for (const col of VEHICLE_PURCHASE_COLUMNS) {
        const value = form[col];
        if (value !== "" && value != null) {
          payload[col] = value as any;
        } else if (isEdit && vehicle?.[col]) {
          payload[col] = null;
        }
      }

      // `photo_url` (migration 028) is only sent when the user actually
      // uploaded a photo — omitting it otherwise keeps this save working
      // even before that migration has been applied.
      if (photoFile && photoUrl) {
        payload.photo_url = photoUrl;
      }

      if (isEdit) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", vehicle.id);
        if (error) throw error;
        await AuditTrailService.logUpdate("management", "vehicle", vehicle.id, vehicle, payload, user?.id, `Updated vehicle ${payload.plate_number}`);
        toast({ variant: "success", title: "Vehicle updated", description: payload.plate_number });
      } else {
        payload.created_at = new Date().toISOString();
        const { data, error } = await supabase.from("vehicles").insert(payload).select().maybeSingle();
        if (error) throw error;
        if (data?.id) {
          await AuditTrailService.logCreate("management", "vehicle", data.id, data, user?.id, `Added vehicle ${payload.plate_number}`);
        }
        toast({ variant: "success", title: "Vehicle added", description: payload.plate_number });

        if (canFinance && form.financed && data?.id) {
          const price = Number(form.purchase_price) || 0;
          const down = form.down_payment === "" ? 0 : Number(form.down_payment);
          const defaults = vehicleLoanAccountCodes(form.type);
          const fixedAssetCode = form.fixed_asset_account_code || defaults.fixedAssetCode;
          const loanPayableCode = form.loan_payable_account_code || defaults.loanPayableCode;
          const { data: loanRow, error: loanError } = await supabase
            .from("vehicle_loans")
            .insert({
              vehicle_id: data.id,
              lender: form.lender.trim(),
              purchase_price: price,
              down_payment: down,
              principal_amount: price - down,
              outstanding_balance: price - down,
              interest_rate: form.interest_rate === "" ? null : Number(form.interest_rate),
              installment_amount: form.installment_amount === "" ? null : Number(form.installment_amount),
              currency: "TZS",
              down_payment_bank_account_id: down > 0 ? form.down_payment_bank_account_id : null,
              purchase_date: form.purchase_date || new Date().toISOString().slice(0, 10),
              status: "active",
              fixed_asset_account_code: fixedAssetCode,
              loan_payable_account_code: loanPayableCode,
              created_by: user?.id,
            })
            .select()
            .single();

          if (loanError) {
            toast({ title: "Vehicle saved, financing not recorded", description: loanError.message, variant: "destructive" });
          } else {
            await AuditTrailService.logCreate("management", "vehicle_loan", loanRow.id, loanRow, user?.id, `Financed vehicle ${payload.plate_number} via ${form.lender}`);
            const { error: postError } = await supabase.rpc("post_vehicle_acquisition", { p_vehicle_loan_id: loanRow.id });
            if (postError) {
              toast({
                title: "Vehicle and loan saved, but posting to the ledger failed",
                description: `${postError.message} — retry from the Vehicle Loans page.`,
                variant: "destructive",
              });
            } else {
              toast({ title: "Financing posted to the ledger", description: `${form.lender} — ${loanRow.loan_number ?? "loan recorded"}` });
            }
          }
        }
      }

      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      console.error("[vehicle-form]", err);
      const raw = err?.message ?? String(err);
      // Surface the real database error with an actionable hint
      // "permission denied" (no RLS wording) means the request never
      // carried a valid session at all — rejected at the GRANT level
      // before RLS was even evaluated, which happens to any role once
      // the browser's session has gone stale. A real RLS rejection
      // instead says "violates row-level security policy" — genuinely a
      // role problem. These used to show the same "contact an admin"
      // message even for an actual admin hitting a stale session.
      const hint =
        raw.includes("duplicate key") ? "A vehicle with this plate already exists." :
          raw.includes("row-level security policy") ? "Your role isn't allowed to add vehicles. Contact an admin." :
            raw.includes("permission denied") ? "Your session has expired — log out and back in, then try again." :
              raw.includes("does not exist") || raw.includes("schema cache") ? `Database schema is out of date — run migrations 026 and 028 in the Supabase SQL editor, then retry. (${raw})` :
                raw.includes("check constraint") ? `The database rejected a field value — run migration 026 in the Supabase SQL editor, then retry. (${raw})` :
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
          {/* Photo */}
          <div className="flex items-center gap-4">
            <div
              onClick={pickPhoto}
              className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed border-border cursor-pointer hover:border-primary/40 transition-colors shrink-0 bg-muted"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Vehicle preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Truck className="size-6 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Camera className="size-5 text-white" />
              </div>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              className="hidden"
            />
            <div className="space-y-1">
              <Button type="button" variant="outline" size="sm" onClick={pickPhoto}>
                <Camera className="size-4 mr-2" />
                {photoPreview ? "Change photo" : "Add photo"}
              </Button>
              <p className="text-xs text-muted-foreground">Optional. JPG, PNG or WEBP.</p>
            </div>
          </div>

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
                <Select value={form.type} onValueChange={(v) => {
                  const next = v as FleetType;
                  const patchValue: Partial<VehicleFormState> = { type: next, trailer_sub_type: next === "TRAILER" ? form.trailer_sub_type : "" };
                  // Re-default the loan accounts to match the new type —
                  // still fully overridable via the pickers below.
                  if (form.financed) {
                    const defaults = vehicleLoanAccountCodes(next);
                    patchValue.fixed_asset_account_code = defaults.fixedAssetCode;
                    patchValue.loan_payable_account_code = defaults.loanPayableCode;
                  }
                  patch(patchValue);
                }}>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

          {/* GPS tracking — maps this vehicle to its live Cartrack/Wialon
              device so location/fuel-telemetry sync can find it. */}
          <fieldset className="space-y-3">
            <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">GPS tracking</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Provider</Label>
                <Select value={form.gps_provider || "none"} onValueChange={(v) => patch({ gps_provider: v === "none" ? "" : (v as "cartrack" | "wialon") })}>
                  <SelectTrigger><SelectValue placeholder="Not tracked" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not tracked</SelectItem>
                    <SelectItem value="cartrack">Cartrack</SelectItem>
                    <SelectItem value="wialon">Wialon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Device / unit ID</Label>
                <Input
                  value={form.gps_device_id}
                  onChange={(e) => patch({ gps_device_id: e.target.value })}
                  placeholder={form.gps_provider === "wialon" ? "Wialon unit ID" : "Cartrack vehicle registration/ID"}
                  disabled={!form.gps_provider}
                />
              </div>
            </div>
          </fieldset>

          {/* Purchase & financing — finance-sensitive, hidden for other roles */}
          {canFinance && (
            <>
              <fieldset className="space-y-3">
                <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Purchase</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Purchase price</Label>
                    <Input type="number" value={form.purchase_price} onChange={(e) => patch({ purchase_price: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Purchase date</Label>
                    <Input type="date" value={form.purchase_date} onChange={(e) => patch({ purchase_date: e.target.value })} />
                  </div>
                </div>
              </fieldset>

              {!isEdit && (
                <fieldset className="space-y-3">
                  <legend className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Financing</legend>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="financed"
                      checked={form.financed}
                      onCheckedChange={(v) => {
                        const on = !!v;
                        if (on && !form.fixed_asset_account_code) {
                          const defaults = vehicleLoanAccountCodes(form.type);
                          patch({ financed: on, fixed_asset_account_code: defaults.fixedAssetCode, loan_payable_account_code: defaults.loanPayableCode });
                        } else {
                          patch({ financed: on });
                        }
                      }}
                    />
                    <Label htmlFor="financed" className="cursor-pointer text-xs">Financed with a loan</Label>
                  </div>
                  {form.financed && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Lender</Label>
                          <Input value={form.lender} onChange={(e) => patch({ lender: e.target.value })} placeholder="Bank name" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Down payment</Label>
                          <Input type="number" value={form.down_payment} onChange={(e) => patch({ down_payment: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Interest rate % (optional)</Label>
                          <Input type="number" value={form.interest_rate} onChange={(e) => patch({ interest_rate: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Installment amount (optional)</Label>
                          <Input type="number" value={form.installment_amount} onChange={(e) => patch({ installment_amount: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" />
                        </div>
                        {Number(form.down_payment) > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs">Down payment from</Label>
                            <Select value={form.down_payment_bank_account_id} onValueChange={(v) => patch({ down_payment_bank_account_id: v })}>
                              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                              <SelectContent>
                                {bankAccounts.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {b.account_name ?? b.id}{b.bank_name ? ` — ${b.bank_name}` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Fixed asset account</Label>
                          <Select value={form.fixed_asset_account_code} onValueChange={(v) => patch({ fixed_asset_account_code: v })}>
                            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent>
                              {assetAccounts.map((a) => (
                                <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Loan payable account</Label>
                          <Select value={form.loan_payable_account_code} onValueChange={(v) => patch({ loan_payable_account_code: v })}>
                            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent>
                              {liabilityAccounts.map((a) => (
                                <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This chart of accounts has more than one plausible option for each (e.g. "Truck Loan" vs "Bank Loan" vs "Vehicle Financing") — defaulted by vehicle type, but pick the ones that match this specific lender/loan.
                      </p>
                      {form.purchase_price !== "" && (
                        <p className="text-xs text-muted-foreground">
                          Principal financed: {(Number(form.purchase_price) - (form.down_payment === "" ? 0 : Number(form.down_payment))).toLocaleString()}
                        </p>
                      )}
                    </>
                  )}
                </fieldset>
              )}
            </>
          )}

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
