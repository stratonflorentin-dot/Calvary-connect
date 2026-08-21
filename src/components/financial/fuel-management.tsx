"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Fuel, Plus, TrendingDown, TrendingUp, BarChart2,
  Truck, RefreshCw, Download, ChevronRight, Droplets, Gauge, MapPin, CreditCard, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FuelLog {
  id: string;
  vehicle_id: string;
  trip_id?: string;
  fuel_date: string;
  litres: number;
  cost_per_litre: number;
  total_cost: number;
  odometer_before?: number;
  odometer_after?: number;
  distance_km?: number;
  efficiency_km_l?: number;
  fuel_station?: string;
  fuel_card_used: boolean;
  notes?: string;
  vehicles?: { plate_number: string; make: string; model: string };
}

export function FuelManagement() {
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [capturingGps, setCapturingGps] = useState(false);

  // Form state
  const [form, setForm] = useState({
    vehicle_id: "",
    trip_id: "",
    fuel_date: format(new Date(), "yyyy-MM-dd"),
    litres: "",
    cost_per_litre: "",
    odometer_before: "",
    odometer_after: "",
    fuel_station: "",
    fuel_station_id: "",
    fuel_card_id: "",
    fuel_card_used: false,
    receipt_number: "",
    notes: "",
    capture_latitude: null as number | null,
    capture_longitude: null as number | null,
    capture_gps_accuracy_m: null as number | null,
  });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [{ data: logsData }, { data: vehiclesData }, { data: tripsData }, { data: stationsData }, { data: cardsData }] = await Promise.all([
      supabase
        .from("fuel_logs")
        .select("*, vehicles(plate_number, make, model)")
        .order("fuel_date", { ascending: false })
        .limit(200),
      supabase.from("vehicles").select("id, plate_number, make, model").order("plate_number"),
      // A driver fuels up before departure just as often as mid-route —
      // only "in_transit" excluded every trip still in pending/loading,
      // which is exactly when a fill-up commonly happens. Only delivered/
      // cancelled trips are genuinely done and excluded here.
      supabase.from("trips").select("id, trip_number, origin, destination").in("status", ["pending", "loading", "in_transit"]).order("created_at", { ascending: false }).limit(50),
      supabase.from("fuel_stations").select("id, name").eq("is_active", true).order("name"),
      supabase.from("fuel_cards").select("id, card_number, status").eq("status", "active").order("card_number"),
    ]);
    setLogs(logsData || []);
    setVehicles(vehiclesData || []);
    setTrips(tripsData || []);
    setStations(stationsData || []);
    setCards(cardsData || []);
    setLoading(false);
  };

  const addStation = async () => {
    const name = window.prompt("New fuel station name:");
    if (!name?.trim()) return;
    const { data, error } = await supabase.from("fuel_stations").insert({ name: name.trim() }).select().maybeSingle();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setStations((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((p) => ({ ...p, fuel_station: data.name, fuel_station_id: data.id }));
  };

  const addCard = async () => {
    const cardNumber = window.prompt("New fuel card number:");
    if (!cardNumber?.trim()) return;
    const { data, error } = await supabase
      .from("fuel_cards")
      .insert({ card_number: cardNumber.trim(), assigned_vehicle_id: form.vehicle_id || null })
      .select()
      .maybeSingle();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setCards((prev) => [...prev, data]);
    setForm((p) => ({ ...p, fuel_card_id: data.id, fuel_card_used: true }));
  };

  const captureGps = () => {
    if (!navigator.geolocation) {
      toast({ title: "Not supported", description: "This device doesn't support GPS capture.", variant: "destructive" });
      return;
    }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((p) => ({
          ...p,
          capture_latitude: pos.coords.latitude,
          capture_longitude: pos.coords.longitude,
          capture_gps_accuracy_m: pos.coords.accuracy,
        }));
        setCapturingGps(false);
        toast({ title: "GPS captured", description: `Accuracy ±${Math.round(pos.coords.accuracy)}m` });
      },
      (err) => {
        setCapturingGps(false);
        toast({ title: "GPS capture failed", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => { loadData(); }, []);

  const totalCost = logs.reduce((s, l) => s + (l.total_cost || 0), 0);
  const totalLitres = logs.reduce((s, l) => s + (l.litres || 0), 0);
  const totalDistance = logs.reduce((s, l) => s + (l.distance_km || 0), 0);
  const avgEfficiency = logs.filter(l => l.efficiency_km_l).length > 0
    ? logs.reduce((s, l) => s + (l.efficiency_km_l || 0), 0) / logs.filter(l => l.efficiency_km_l).length
    : 0;

  const filteredLogs = filterVehicle === "all"
    ? logs
    : logs.filter(l => l.vehicle_id === filterVehicle);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      vehicle_id: "", trip_id: "", fuel_date: format(new Date(), "yyyy-MM-dd"),
      litres: "", cost_per_litre: "", odometer_before: "", odometer_after: "",
      fuel_station: "", fuel_station_id: "", fuel_card_id: "", fuel_card_used: false,
      receipt_number: "", notes: "",
      capture_latitude: null, capture_longitude: null, capture_gps_accuracy_m: null,
    });
  };

  const openEdit = (log: FuelLog) => {
    setEditingId(log.id);
    setForm({
      vehicle_id: log.vehicle_id,
      trip_id: log.trip_id || "",
      fuel_date: log.fuel_date,
      litres: String(log.litres ?? ""),
      cost_per_litre: String(log.cost_per_litre ?? ""),
      odometer_before: log.odometer_before != null ? String(log.odometer_before) : "",
      odometer_after: log.odometer_after != null ? String(log.odometer_after) : "",
      fuel_station: log.fuel_station || "",
      fuel_station_id: (log as any).fuel_station_id || "",
      fuel_card_id: (log as any).fuel_card_id || "",
      fuel_card_used: log.fuel_card_used || false,
      receipt_number: (log as any).receipt_number || "",
      notes: log.notes || "",
      capture_latitude: (log as any).capture_latitude ?? null,
      capture_longitude: (log as any).capture_longitude ?? null,
      capture_gps_accuracy_m: (log as any).capture_gps_accuracy_m ?? null,
    });
    setAddOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.litres || !form.cost_per_litre) {
      toast({ title: "Missing Fields", description: "Vehicle, litres, and cost are required.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const litres = parseFloat(form.litres);
      const costPerLitre = parseFloat(form.cost_per_litre);
      const totalCost = litres * costPerLitre;
      const odoBefore = form.odometer_before ? parseFloat(form.odometer_before) : null;
      const odoAfter = form.odometer_after ? parseFloat(form.odometer_after) : null;

      const payload = {
        vehicle_id: form.vehicle_id,
        trip_id: form.trip_id || null,
        fuel_date: form.fuel_date,
        litres,
        cost_per_litre: costPerLitre,
        total_cost: totalCost,
        odometer_before: odoBefore,
        odometer_after: odoAfter,
        fuel_station: form.fuel_station,
        fuel_station_id: form.fuel_station_id || null,
        fuel_card_id: form.fuel_card_id || null,
        fuel_card_used: form.fuel_card_used,
        receipt_number: form.receipt_number || null,
        capture_latitude: form.capture_latitude,
        capture_longitude: form.capture_longitude,
        capture_gps_accuracy_m: form.capture_gps_accuracy_m,
        notes: form.notes,
      };

      const { error } = editingId
        ? await supabase.from("fuel_logs").update(payload).eq("id", editingId)
        : await supabase.from("fuel_logs").insert(payload);

      if (error) throw error;

      toast({
        title: editingId ? "✅ Fuel Log Updated" : "✅ Fuel Log Saved",
        description: `${litres}L recorded for ${vehicles.find(v => v.id === form.vehicle_id)?.plate_number}`,
      });

      // Fire-and-forget fraud scan for this vehicle so anomalies (impossible
      // volume, efficiency outlier, too-frequent refuel, price outlier) are
      // flagged right away rather than waiting for a manual scan. Errors here
      // shouldn't block the fuel log the user just successfully saved.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        fetch("/api/fuel/detect-anomalies", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ vehicle_id: form.vehicle_id }),
        }).catch((err) => console.warn("[fuel anomaly scan]", err));
      });

      setAddOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Per-vehicle efficiency summary
  const vehicleSummary = vehicles.map(v => {
    const vLogs = logs.filter(l => l.vehicle_id === v.id);
    const litres = vLogs.reduce((s, l) => s + l.litres, 0);
    const cost = vLogs.reduce((s, l) => s + l.total_cost, 0);
    const distance = vLogs.reduce((s, l) => s + (l.distance_km || 0), 0);
    const efficiency = litres > 0 && distance > 0 ? distance / litres : 0;
    return { ...v, litres, cost, distance, efficiency, fills: vLogs.length };
  }).filter(v => v.fills > 0).sort((a, b) => b.cost - a.cost);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Fuel className="size-7 text-primary" />
            Fuel Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Track fuel consumption, costs, and efficiency per vehicle</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />Refresh
          </Button>
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="size-4 mr-2" />Log Fuel Fill
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Fuel className="size-5 text-primary" />
                  {editingId ? "Edit Fuel Log" : "Record Fuel Fill-Up"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label>Vehicle *</Label>
                  <Select value={form.vehicle_id} onValueChange={v => setForm(p => ({ ...p, vehicle_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                    <SelectContent>
                      {vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Fuel Date *</Label>
                    <Input type="date" value={form.fuel_date} onChange={e => setForm(p => ({ ...p, fuel_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Link to Trip</Label>
                    <Select value={form.trip_id === "" ? "none" : form.trip_id} onValueChange={v => setForm(p => ({ ...p, trip_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {trips.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.trip_number || t.tripNumber || t.id.slice(0,8)} — {t.origin}→{t.destination}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Litres *</Label>
                    <Input type="number" step="0.1" value={form.litres} onChange={e => setForm(p => ({ ...p, litres: e.target.value }))} placeholder="e.g. 150" />
                  </div>
                  <div className="space-y-1">
                    <Label>Cost/Litre (TZS) *</Label>
                    <Input type="number" value={form.cost_per_litre} onChange={e => setForm(p => ({ ...p, cost_per_litre: e.target.value }))} placeholder="e.g. 3200" />
                  </div>
                </div>

                {/* Show estimated total */}
                {form.litres && form.cost_per_litre && (
                  <div className="bg-[hsl(var(--primary-soft))] rounded-lg p-2 text-sm text-primary font-medium text-center">
                    Total: TZS {(parseFloat(form.litres) * parseFloat(form.cost_per_litre)).toLocaleString()}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Odometer Before (km)</Label>
                    <Input type="number" value={form.odometer_before} onChange={e => setForm(p => ({ ...p, odometer_before: e.target.value }))} placeholder="e.g. 125000" />
                  </div>
                  <div className="space-y-1">
                    <Label>Odometer After (km)</Label>
                    <Input type="number" value={form.odometer_after} onChange={e => setForm(p => ({ ...p, odometer_after: e.target.value }))} placeholder="e.g. 125200" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Fuel Station</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.fuel_station_id || "none"}
                      onValueChange={v => {
                        if (v === "none") { setForm(p => ({ ...p, fuel_station_id: "", fuel_station: "" })); return; }
                        const station = stations.find(s => s.id === v);
                        setForm(p => ({ ...p, fuel_station_id: v, fuel_station: station?.name ?? p.fuel_station }));
                      }}
                    >
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select known station" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not listed / type below</SelectItem>
                        {stations.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={addStation} title="Add new station">
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <Input
                    className="mt-1"
                    value={form.fuel_station}
                    onChange={e => setForm(p => ({ ...p, fuel_station: e.target.value, fuel_station_id: p.fuel_station_id && stations.find(s => s.id === p.fuel_station_id)?.name === e.target.value ? p.fuel_station_id : "" }))}
                    placeholder="Station name (e.g. Oryx Ubungo) — linking a known station above enables GPS/off-route checks"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Fuel Card</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.fuel_card_id || "none"}
                      onValueChange={v => setForm(p => ({ ...p, fuel_card_id: v === "none" ? "" : v, fuel_card_used: v !== "none" || p.fuel_card_used }))}
                    >
                      <SelectTrigger className="flex-1"><SelectValue placeholder="No card / select card" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No card used</SelectItem>
                        {cards.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.card_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={addCard} title="Register new card">
                      <CreditCard className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Receipt Number</Label>
                    <Input value={form.receipt_number} onChange={e => setForm(p => ({ ...p, receipt_number: e.target.value }))} placeholder="e.g. FT-45892" />
                  </div>
                  <div className="space-y-1">
                    <Label>GPS at fill-up</Label>
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={captureGps} disabled={capturingGps}>
                      <MapPin className={cn("size-3.5 mr-1.5", capturingGps && "animate-pulse")} />
                      {form.capture_latitude != null ? "Captured ✓" : capturingGps ? "Locating…" : "Capture"}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setAddOpen(false); resetForm(); }} disabled={saving}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? <RefreshCw className="size-4 mr-2 animate-spin" /> : <Fuel className="size-4 mr-2" />}
                    {editingId ? "Update Log" : "Save Log"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Fuel Cost", value: `TZS ${totalCost.toLocaleString()}`, icon: <Fuel className="size-5 text-primary" /> },
          { label: "Total Litres", value: `${totalLitres.toLocaleString()} L`, icon: <Droplets className="size-5 text-primary" /> },
          { label: "Total Distance", value: `${totalDistance.toLocaleString()} km`, icon: <Truck className="size-5 text-primary" /> },
          { label: "Avg Efficiency", value: avgEfficiency > 0 ? `${avgEfficiency.toFixed(2)} km/L` : "—", icon: <Gauge className="size-5 text-primary" /> },
        ].map(stat => (
          <Card key={stat.label} className="border border-border bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                <p className="text-xl font-black text-foreground mt-0.5">{stat.value}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[hsl(var(--primary-soft))] flex items-center justify-center shrink-0">
                {stat.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-Vehicle Efficiency */}
      {vehicleSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart2 className="size-5 text-primary" />Vehicle Fuel Efficiency Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vehicleSummary.slice(0, 8).map((v, i) => {
                const maxCost = vehicleSummary[0].cost;
                const pct = maxCost > 0 ? (v.cost / maxCost) * 100 : 0;
                return (
                  <div key={v.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-foreground">{v.plate_number} <span className="text-muted-foreground text-xs">({v.make})</span></span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-foreground font-bold">TZS {v.cost.toLocaleString()}</span>
                        <span className="text-muted-foreground">{v.litres.toFixed(0)}L</span>
                        {v.efficiency > 0 && <span className="text-primary font-medium">{v.efficiency.toFixed(2)} km/L</span>}
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Fuel className="size-5 text-primary" />Fuel Fill-Up Logs
            </CardTitle>
            <Select value={filterVehicle} onValueChange={setFilterVehicle}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue placeholder="All Vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.plate_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead className="text-right">Litres</TableHead>
                  <TableHead className="text-right">TZS/L</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">km/L</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">{format(new Date(log.fuel_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <span className="font-medium">{log.vehicles?.plate_number || "—"}</span>
                      {log.fuel_card_used && <Badge variant="outline" className="ml-1 text-[9px] py-0">Card</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{log.fuel_station || "—"}</TableCell>
                    <TableCell className="text-right font-medium text-foreground">{log.litres} L</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">{log.cost_per_litre?.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      TZS {log.total_cost?.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">
                      {log.distance_km ? `${log.distance_km} km` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.efficiency_km_l ? (
                        <span className={cn(
                          "font-bold text-xs rounded-full px-2 py-0.5",
                          log.efficiency_km_l >= 4 ? "bg-success/10 text-success" :
                          log.efficiency_km_l >= 2.5 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                        )}>
                          {log.efficiency_km_l.toFixed(2)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEdit(log)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      <Fuel className="size-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No fuel logs yet. Click "Log Fuel Fill" to start tracking.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
