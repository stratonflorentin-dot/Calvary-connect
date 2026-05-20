"use client";

import { useEffect, useRef, useState } from "react";
import { DriverShell } from "@/components/driver/driver-shell";
import { useDriverData } from "@/hooks/use-driver-data";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Truck, Pencil, Save, X, Phone, Mail, CreditCard } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function DriverProfilePage() {
  const { user, refreshUser } = useSupabase();
  const { profile, trips, assignedVehicle, loading } = useDriverData();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    license_number: "",
    license_expiry: "",
  });

  useEffect(() => {
    if (profile || user) {
      setForm({
        name: String(profile?.name || user?.name || ""),
        phone: String(profile?.phone || user?.phone || ""),
        license_number: String(profile?.license_number || profile?.licenseNumber || ""),
        license_expiry: String(profile?.license_expiry || profile?.licenseExpiry || "").slice(0, 10),
      });
    }
  }, [profile, user]);

  const completedTrips = trips.filter((t) =>
    ["delivered", "completed"].includes(String(t.status || "").toLowerCase()),
  ).length;

  const plate =
    (assignedVehicle?.plate_number as string) ||
    (assignedVehicle?.plateNumber as string) ||
    "Not assigned";

  const rating = Number(profile?.performance_rating || profile?.rating || 4.5);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {
        name: form.name,
        phone: form.phone,
        updated_at: new Date().toISOString(),
      };
      if (form.license_number) payload.license_number = form.license_number;
      if (form.license_expiry) payload.license_expiry = form.license_expiry;

      const { error } = await supabase
        .from("user_profiles")
        .update(payload)
        .eq("id", user.id);

      if (error) {
        const { error: minimalErr } = await supabase
          .from("user_profiles")
          .update({ name: form.name, phone: form.phone, updated_at: payload.updated_at })
          .eq("id", user.id);
        if (minimalErr) throw minimalErr;
      }
      await refreshUser();
      toast({ title: "Profile updated" });
      setEditing(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Update failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DriverShell title="Driver Profile" description="View and update your driver information.">
      {loading ? (
        <p className="text-center py-12 text-muted-foreground">Loading profile…</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Avatar className="size-24 border-4 border-primary/20">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="text-2xl">
                  {form.name?.charAt(0) || "D"}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={() => toast({ title: "Photo", description: "Use main profile to change avatar." })}
              />
              <h2 className="mt-4 text-xl font-bold">{form.name || "Driver"}</h2>
              <Badge variant="secondary" className="mt-1">
                DRIVER
              </Badge>
              <div className="flex items-center gap-1 mt-2 text-amber-600">
                <Star className="size-4 fill-amber-400" />
                <span className="font-semibold">{rating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">performance</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">Contact & license</CardTitle>
              {!editing ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-4 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
                    <X className="size-4" />
                  </Button>
                  <Button size="icon" onClick={handleSave} disabled={saving}>
                    <Save className="size-4" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {editing ? (
                <>
                  <div>
                    <Label>Full name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>License number</Label>
                    <Input
                      value={form.license_number}
                      onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>License expiry</Label>
                    <Input
                      type="date"
                      value={form.license_expiry}
                      onChange={(e) => setForm({ ...form, license_expiry: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    {user?.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    {form.phone || "—"}
                  </p>
                  <p className="flex items-center gap-2">
                    <CreditCard className="size-4 text-muted-foreground" />
                    {form.license_number || "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    License expires: {form.license_expiry || "—"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="size-4" />
                Assigned vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-semibold">{plate}</p>
              <p className="text-muted-foreground text-xs mt-1 capitalize">
                {(assignedVehicle?.type as string)?.replace(/_/g, " ") || "—"}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{completedTrips}</p>
                <p className="text-xs text-muted-foreground">Completed trips</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{trips.length}</p>
                <p className="text-xs text-muted-foreground">Total assigned</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Driving history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-48 overflow-y-auto">
              {trips.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trip history yet.</p>
              ) : (
                trips.slice(0, 8).map((t) => (
                  <div
                    key={String(t.id)}
                    className="text-xs border-b pb-2 last:border-0 flex justify-between"
                  >
                    <span>
                      {String(t.origin)} → {String(t.destination)}
                    </span>
                    <span className="text-muted-foreground capitalize">
                      {String(t.status).replace(/_/g, " ")}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DriverShell>
  );
}
