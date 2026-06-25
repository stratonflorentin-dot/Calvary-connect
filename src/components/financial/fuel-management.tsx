"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Fuel, Plus, TrendingDown, TrendingUp, BarChart2,
  Truck, RefreshCw, Download, ChevronRight, Droplets, Gauge
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
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [filterVehicle, setFilterVehicle] = useState("all");

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
    fuel_card_used: false,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [{ data: logsData }, { data: vehiclesData }, { data: tripsData }] = await Promise.all([
      supabase
        .from("fuel_logs")
        .select("*, vehicles(plate_number, make, model)")
        .order("fuel_date", { ascending: false })
        .limit(200),
      supabase.from("vehicles").select("id, plate_number, make, model").order("plate_number"),
      supabase.from("trips").select("id, trip_number, tripNumber, origin, destination").eq("status", "in_transit").limit(50),
    ]);
    setLogs(logsData || []);
    setVehicles(vehiclesData || []);
    setTrips(tripsData || []);
    setLoading(false);
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

      const { error } = await supabase.from("fuel_logs").insert({
        vehicle_id: form.vehicle_id,
        trip_id: form.trip_id || null,
        fuel_date: form.fuel_date,
        litres,
        cost_per_litre: costPerLitre,
        total_cost: totalCost,
        odometer_before: odoBefore,
        odometer_after: odoAfter,
        fuel_station: form.fuel_station,
        fuel_card_used: form.fuel_card_used,
        notes: form.notes,
      });

      if (error) throw error;

      toast({ title: "✅ Fuel Log Saved", description: `${litres}L recorded for ${vehicles.find(v => v.id === form.vehicle_id)?.plate_number}` });
      setAddOpen(false);
      setForm({
        vehicle_id: "", trip_id: "", fuel_date: format(new Date(), "yyyy-MM-dd"),
        litres: "", cost_per_litre: "", odometer_before: "", odometer_after: "",
        fuel_station: "", fuel_card_used: false, notes: "",
      });
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
            <Fuel className="size-7 text-amber-500" />
            Fuel Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Track fuel consumption, costs, and efficiency per vehicle</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />Refresh
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600">
                <Plus className="size-4 mr-2" />Log Fuel Fill
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Fuel className="size-5 text-amber-500" />
                  Record Fuel Fill-Up
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
                  <div className="bg-amber-50 rounded-lg p-2 text-sm text-amber-700 font-medium text-center">
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
                  <Input value={form.fuel_station} onChange={e => setForm(p => ({ ...p, fuel_station: e.target.value }))} placeholder="e.g. Oryx Ubungo" />
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.fuel_card_used}
                    onChange={e => setForm(p => ({ ...p, fuel_card_used: e.target.checked }))}
                    className="rounded"
                  />
                  Fuel Card Used
                </label>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
                  <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600" disabled={saving}>
                    {saving ? <RefreshCw className="size-4 mr-2 animate-spin" /> : <Fuel className="size-4 mr-2" />}
                    Save Log
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
          { label: "Total Fuel Cost", value: `TZS ${totalCost.toLocaleString()}`, icon: <Fuel className="size-5 text-amber-500" />, bg: "bg-amber-50 border-amber-200" },
          { label: "Total Litres", value: `${totalLitres.toLocaleString()} L`, icon: <Droplets className="size-5 text-blue-500" />, bg: "bg-blue-50 border-blue-200" },
          { label: "Total Distance", value: `${totalDistance.toLocaleString()} km`, icon: <Truck className="size-5 text-green-500" />, bg: "bg-green-50 border-green-200" },
          { label: "Avg Efficiency", value: avgEfficiency > 0 ? `${avgEfficiency.toFixed(2)} km/L` : "—", icon: <Gauge className="size-5 text-purple-500" />, bg: "bg-purple-50 border-purple-200" },
        ].map(stat => (
          <Card key={stat.label} className={cn("border", stat.bg)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                <p className="text-xl font-black text-slate-800 mt-0.5">{stat.value}</p>
              </div>
              {stat.icon}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-Vehicle Efficiency */}
      {vehicleSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart2 className="size-5 text-purple-600" />Vehicle Fuel Efficiency Ranking
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
                      <span className="font-medium text-slate-700">{v.plate_number} <span className="text-slate-400 text-xs">({v.make})</span></span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-amber-600 font-bold">TZS {v.cost.toLocaleString()}</span>
                        <span className="text-slate-500">{v.litres.toFixed(0)}L</span>
                        {v.efficiency > 0 && <span className="text-purple-600 font-medium">{v.efficiency.toFixed(2)} km/L</span>}
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
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
              <Fuel className="size-5 text-amber-500" />Fuel Fill-Up Logs
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
                    <TableCell className="text-slate-500 text-xs">{log.fuel_station || "—"}</TableCell>
                    <TableCell className="text-right font-medium text-blue-600">{log.litres} L</TableCell>
                    <TableCell className="text-right text-slate-500 text-xs">{log.cost_per_litre?.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-amber-600">
                      TZS {log.total_cost?.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-slate-500 text-xs">
                      {log.distance_km ? `${log.distance_km} km` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.efficiency_km_l ? (
                        <span className={cn(
                          "font-bold text-xs",
                          log.efficiency_km_l >= 4 ? "text-green-600" :
                          log.efficiency_km_l >= 2.5 ? "text-amber-600" : "text-red-600"
                        )}>
                          {log.efficiency_km_l.toFixed(2)}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-slate-400">
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
