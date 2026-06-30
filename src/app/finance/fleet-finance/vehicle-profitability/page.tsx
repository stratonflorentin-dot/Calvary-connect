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
import { Truck, ArrowLeft, RefreshCw, TrendingUp, TrendingDown, DollarSign, Route, Fuel, Wrench, Calendar } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

type Vehicle = {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  status: string;
};

type VehicleCost = {
  id: string;
  vehicle_id: string;
  cost_type: "fuel" | "maintenance" | "tyre" | "insurance" | "other";
  amount: number;
  currency: string;
  date: string;
  description: string;
  trip_id?: string;
};

type TripRevenue = {
  id: string;
  trip_id: string;
  amount: number;
  currency: string;
  date: string;
  customer_name: string;
};

type Trip = {
  id: string;
  vehicle_id: string;
  origin: string;
  destination: string;
  distance_km: number;
  start_date: string;
  end_date: string;
  status: string;
  fare_amount?: number;
};

type VehicleProfitability = {
  vehicle: Vehicle;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  totalDistance: number;
  costPerKm: number;
  revenuePerKm: number;
  fuelCost: number;
  maintenanceCost: number;
  tyreCost: number;
  insuranceCost: number;
  otherCost: number;
  tripCount: number;
};

export default function VehicleProfitabilityPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [costs, setCosts] = useState<VehicleCost[]>([]);
  const [revenues, setRevenues] = useState<TripRevenue[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const loadVehicleData = async () => {
    setLoading(true);
    try {
      const [vehiclesData, costsData, revenuesData, tripsData] = await Promise.all([
        supabase.from("vehicles").select("*"),
        supabase.from("vehicle_costs").select("*"),
        supabase.from("trip_revenue").select("*"),
        supabase.from("trips").select("*"),
      ]);

      setVehicles(vehiclesData.data || []);
      setCosts(costsData.data || []);
      setRevenues(revenuesData.data || []);
      setTrips(tripsData.data || []);
    } catch (err) {
      console.error("Error loading vehicle data:", err);
      toast({ title: "Error", description: "Failed to load vehicle data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicleData();
  }, []);

  const calculateProfitability = useMemo(() => {
    return vehicles.map((vehicle) => {
      const vehicleCosts = costs.filter((c) => c.vehicle_id === vehicle.id);
      const vehicleRevenues = revenues.filter((r) => {
        const relatedTrip = trips.find((t) => t.id === r.trip_id);
        return relatedTrip?.vehicle_id === vehicle.id;
      });
      const vehicleTrips = trips.filter((t) => t.vehicle_id === vehicle.id);

      const totalCosts = vehicleCosts.reduce((sum, c) => sum + c.amount, 0);
      const totalRevenue = vehicleRevenues.reduce((sum, r) => sum + r.amount, 0);
      const netProfit = totalRevenue - totalCosts;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      const totalDistance = vehicleTrips.reduce((sum, t) => sum + (t.distance_km || 0), 0);
      const costPerKm = totalDistance > 0 ? totalCosts / totalDistance : 0;
      const revenuePerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;

      const fuelCost = vehicleCosts.filter((c) => c.cost_type === "fuel").reduce((sum, c) => sum + c.amount, 0);
      const maintenanceCost = vehicleCosts.filter((c) => c.cost_type === "maintenance").reduce((sum, c) => sum + c.amount, 0);
      const tyreCost = vehicleCosts.filter((c) => c.cost_type === "tyre").reduce((sum, c) => sum + c.amount, 0);
      const insuranceCost = vehicleCosts.filter((c) => c.cost_type === "insurance").reduce((sum, c) => sum + c.amount, 0);
      const otherCost = vehicleCosts.filter((c) => c.cost_type === "other").reduce((sum, c) => sum + c.amount, 0);

      return {
        vehicle,
        totalRevenue,
        totalCosts,
        netProfit,
        profitMargin,
        totalDistance,
        costPerKm,
        revenuePerKm,
        fuelCost,
        maintenanceCost,
        tyreCost,
        insuranceCost,
        otherCost,
        tripCount: vehicleTrips.length,
      } as VehicleProfitability;
    });
  }, [vehicles, costs, revenues, trips]);

  const filteredProfitability = selectedVehicleId === "all"
    ? calculateProfitability
    : calculateProfitability.filter((vp) => vp.vehicle.id === selectedVehicleId);

  const chartData = useMemo(() => {
    return filteredProfitability.map((vp) => ({
      name: vp.vehicle.plate_number,
      revenue: vp.totalRevenue,
      costs: vp.totalCosts,
      profit: vp.netProfit,
    }));
  }, [filteredProfitability]);

  const costBreakdownData = useMemo(() => {
    return filteredProfitability.map((vp) => ({
      name: vp.vehicle.plate_number,
      fuel: vp.fuelCost,
      maintenance: vp.maintenanceCost,
      tyre: vp.tyreCost,
      insurance: vp.insuranceCost,
      other: vp.otherCost,
    }));
  }, [filteredProfitability]);

  const efficiencyData = useMemo(() => {
    return filteredProfitability.map((vp) => ({
      name: vp.vehicle.plate_number,
      costPerKm: vp.costPerKm,
      revenuePerKm: vp.revenuePerKm,
      margin: vp.profitMargin,
    }));
  }, [filteredProfitability]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <Button onClick={loadVehicleData} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Vehicle Profitability</h1>
        <p className="text-muted-foreground">Track vehicle performance, costs, and revenue per kilometer</p>
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
      </div>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="size-4 text-success" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold text-success">
              {formatAmount(filteredProfitability.reduce((sum, vp) => sum + vp.totalRevenue, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="size-4 text-destructive" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Costs</p>
            </div>
            <p className="text-2xl font-bold text-destructive">
              {formatAmount(filteredProfitability.reduce((sum, vp) => sum + vp.totalCosts, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Net Profit</p>
            </div>
            <p className={cn("text-2xl font-bold", filteredProfitability.reduce((sum, vp) => sum + vp.netProfit, 0) >= 0 ? "text-success" : "text-destructive")}>
              {formatAmount(filteredProfitability.reduce((sum, vp) => sum + vp.netProfit, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Route className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Distance</p>
            </div>
            <p className="text-2xl font-bold text-primary">
              {filteredProfitability.reduce((sum, vp) => sum + vp.totalDistance, 0).toLocaleString()} km
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue vs Costs by Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                <Bar dataKey="costs" fill="#ef4444" name="Costs" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cost Breakdown by Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={costBreakdownData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="fuel" fill="#f59e0b" name="Fuel" />
                <Bar dataKey="maintenance" fill="#8b5cf6" name="Maintenance" />
                <Bar dataKey="tyre" fill="#06b6d4" name="Tyre" />
                <Bar dataKey="insurance" fill="#ec4899" name="Insurance" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Efficiency Metrics (Cost/Revenue per KM)</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={efficiencyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="costPerKm" stroke="#ef4444" strokeWidth={2} name="Cost/KM" />
                <Line type="monotone" dataKey="revenuePerKm" stroke="#10b981" strokeWidth={2} name="Revenue/KM" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="size-5" /> Vehicle Profitability Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Trips</TableHead>
                  <TableHead>Distance (km)</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Costs</TableHead>
                  <TableHead>Net Profit</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead>Cost/KM</TableHead>
                  <TableHead>Revenue/KM</TableHead>
                  <TableHead>Fuel</TableHead>
                  <TableHead>Maintenance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfitability.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground">
                      No vehicle data available
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProfitability.map((vp) => (
                    <TableRow key={vp.vehicle.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{vp.vehicle.plate_number}</p>
                          <p className="text-xs text-muted-foreground">{vp.vehicle.make} {vp.vehicle.model}</p>
                        </div>
                      </TableCell>
                      <TableCell>{vp.tripCount}</TableCell>
                      <TableCell>{vp.totalDistance.toLocaleString()}</TableCell>
                      <TableCell className="text-success font-medium">{formatAmount(vp.totalRevenue)}</TableCell>
                      <TableCell className="text-destructive font-medium">{formatAmount(vp.totalCosts)}</TableCell>
                      <TableCell className={cn("font-medium", vp.netProfit >= 0 ? "text-success" : "text-destructive")}>
                        {formatAmount(vp.netProfit)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={vp.profitMargin >= 0 ? "default" : "destructive"}>
                          {vp.profitMargin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{formatAmount(vp.costPerKm)}</TableCell>
                      <TableCell>{formatAmount(vp.revenuePerKm)}</TableCell>
                      <TableCell>{formatAmount(vp.fuelCost)}</TableCell>
                      <TableCell>{formatAmount(vp.maintenanceCost)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
