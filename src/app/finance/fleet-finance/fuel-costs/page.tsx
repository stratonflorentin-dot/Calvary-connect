"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Fuel, ArrowLeft, RefreshCw, Plus, Trash2, Edit2, TrendingUp, TrendingDown, Truck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

type Vehicle = {
  id: string;
  plate_number: string;
  make: string;
  model: string;
};

type FuelCost = {
  id?: string;
  vehicle_id: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  liters?: number;
  price_per_liter?: number;
  trip_id?: string;
  odometer_reading?: number;
};

export default function FuelCostsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fuelCosts, setFuelCosts] = useState<FuelCost[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");
  const [modal, setModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [fuelForm, setFuelForm] = useState({
    vehicle_id: "",
    amount: "",
    currency: "TZS",
    date: "",
    description: "",
    liters: "",
    price_per_liter: "",
    odometer_reading: "",
  });

  const [editingFuel, setEditingFuel] = useState<FuelCost | null>(null);

  const loadFuelCosts = async () => {
    setLoading(true);
    try {
      const [costsData, vehiclesData] = await Promise.all([
        supabase.from("vehicle_costs").select("*").eq("cost_type", "fuel").order("date", { ascending: false }),
        supabase.from("vehicles").select("*"),
      ]);

      setFuelCosts(costsData.data || []);
      setVehicles(vehiclesData.data || []);
    } catch (err) {
      console.error("Error loading fuel costs:", err);
      toast({ title: "Error", description: "Failed to load fuel costs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFuelCosts();
  }, []);

  const filteredCosts = selectedVehicleId === "all"
    ? fuelCosts
    : fuelCosts.filter((c) => c.vehicle_id === selectedVehicleId);

  const saveFuelCost = async () => {
    if (!fuelForm.vehicle_id || !fuelForm.amount || !fuelForm.date) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const costData: FuelCost = {
        vehicle_id: fuelForm.vehicle_id,
        amount: parseFloat(fuelForm.amount),
        currency: fuelForm.currency,
        date: fuelForm.date,
        description: fuelForm.description,
        liters: fuelForm.liters ? parseFloat(fuelForm.liters) : undefined,
        price_per_liter: fuelForm.price_per_liter ? parseFloat(fuelForm.price_per_liter) : undefined,
        odometer_reading: fuelForm.odometer_reading ? parseFloat(fuelForm.odometer_reading) : undefined,
      };

      let error;
      if (editingFuel?.id) {
        error = (await supabase.from("vehicle_costs").update({ ...costData, cost_type: "fuel" }).eq("id", editingFuel.id)).error;
      } else {
        error = (await supabase.from("vehicle_costs").insert({ ...costData, cost_type: "fuel" })).error;
      }

      if (error) throw error;

      await loadFuelCosts();
      setModal(null);
      setFuelForm({
        vehicle_id: "",
        amount: "",
        currency: "TZS",
        date: "",
        description: "",
        liters: "",
        price_per_liter: "",
        odometer_reading: "",
      });
      setEditingFuel(null);
      toast({ title: "Success", description: editingFuel ? "Fuel cost updated" : "Fuel cost recorded" });
    } catch (err) {
      console.error("Error saving fuel cost:", err);
      toast({ title: "Error", description: "Failed to save fuel cost", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteFuelCost = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fuel cost?")) return;

    try {
      const { error } = await supabase.from("vehicle_costs").delete().eq("id", id);
      if (error) throw error;
      await loadFuelCosts();
      toast({ title: "Success", description: "Fuel cost deleted" });
    } catch (err) {
      console.error("Error deleting fuel cost:", err);
      toast({ title: "Error", description: "Failed to delete fuel cost", variant: "destructive" });
    }
  };

  const editFuelCost = (cost: FuelCost) => {
    setEditingFuel(cost);
    setFuelForm({
      vehicle_id: cost.vehicle_id,
      amount: String(cost.amount),
      currency: cost.currency,
      date: cost.date,
      description: cost.description,
      liters: cost.liters ? String(cost.liters) : "",
      price_per_liter: cost.price_per_liter ? String(cost.price_per_liter) : "",
      odometer_reading: cost.odometer_reading ? String(cost.odometer_reading) : "",
    });
    setModal("fuel");
  };

  const chartData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    filteredCosts.forEach((cost) => {
      const month = new Date(cost.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + cost.amount;
    });
    return Object.entries(monthlyData).map(([month, amount]) => ({ month, amount }));
  }, [filteredCosts]);

  const vehicleFuelData = useMemo(() => {
    return vehicles.map((vehicle) => {
      const vehicleCosts = filteredCosts.filter((c) => c.vehicle_id === vehicle.id);
      const totalCost = vehicleCosts.reduce((sum, c) => sum + c.amount, 0);
      const totalLiters = vehicleCosts.reduce((sum, c) => sum + (c.liters || 0), 0);
      return {
        name: vehicle.plate_number,
        cost: totalCost,
        liters: totalLiters,
      };
    });
  }, [vehicles, filteredCosts]);

  const totalFuelCost = filteredCosts.reduce((sum, c) => sum + c.amount, 0);
  const totalLiters = filteredCosts.reduce((sum, c) => sum + (c.liters || 0), 0);
  const avgPricePerLiter = totalLiters > 0 ? totalFuelCost / totalLiters : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <Button onClick={loadFuelCosts} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Fuel Costs</h1>
        <p className="text-muted-foreground">Track fuel expenses and consumption across your fleet</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <Label>Filter by Vehicle</Label>
          <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate_number} - {vehicle.make} {vehicle.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={modal === "fuel"} onOpenChange={(open) => setModal(open ? "fuel" : null)}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> Add Fuel Cost
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingFuel ? "Edit Fuel Cost" : "Add Fuel Cost"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Vehicle</Label>
                <Select value={fuelForm.vehicle_id} onValueChange={(value) => setFuelForm({ ...fuelForm, vehicle_id: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate_number} - {vehicle.make} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={fuelForm.amount} onChange={(e) => setFuelForm({ ...fuelForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={fuelForm.date} onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Liters (Optional)</Label>
                  <Input type="number" value={fuelForm.liters} onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Price/Liter (Optional)</Label>
                  <Input type="number" value={fuelForm.price_per_liter} onChange={(e) => setFuelForm({ ...fuelForm, price_per_liter: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Odometer Reading (Optional)</Label>
                <Input type="number" value={fuelForm.odometer_reading} onChange={(e) => setFuelForm({ ...fuelForm, odometer_reading: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={fuelForm.description} onChange={(e) => setFuelForm({ ...fuelForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setModal(null); setEditingFuel(null); }}>Cancel</Button>
                <Button onClick={saveFuelCost} disabled={submitting}>
                  {submitting ? "Saving..." : editingFuel ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="size-4 text-destructive" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Fuel Cost</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatAmount(totalFuelCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Fuel className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Liters</p>
            </div>
            <p className="text-2xl font-bold text-primary">{totalLiters.toLocaleString()} L</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Avg Price/Liter</p>
            </div>
            <p className="text-2xl font-bold text-warning">{formatAmount(avgPricePerLiter)}</p>
          </CardContent>
        </Card>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Fuel Costs</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fuel Costs by Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={vehicleFuelData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="cost" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="size-5" /> Fuel Cost Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Liters</TableHead>
                  <TableHead>Price/Liter</TableHead>
                  <TableHead>Odometer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No fuel costs recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCosts.map((cost) => {
                    const vehicle = vehicles.find((v) => v.id === cost.vehicle_id);
                    return (
                      <TableRow key={cost.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Truck className="size-4 text-muted-foreground" />
                            <span className="font-medium">{vehicle?.plate_number || "Unknown"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(cost.date)}</TableCell>
                        <TableCell>{cost.description}</TableCell>
                        <TableCell>{cost.liters ? cost.liters.toLocaleString() : "-"}</TableCell>
                        <TableCell>{cost.price_per_liter ? formatAmount(cost.price_per_liter) : "-"}</TableCell>
                        <TableCell>{cost.odometer_reading ? cost.odometer_reading.toLocaleString() : "-"}</TableCell>
                        <TableCell className="font-medium text-destructive">{formatAmount(cost.amount)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => editFuelCost(cost)}>
                              <Edit2 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteFuelCost(cost.id!)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
