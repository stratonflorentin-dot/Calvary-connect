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
import { MapPin, ArrowLeft, RefreshCw, TrendingUp, TrendingDown, DollarSign, Route, Truck, Calendar } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

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

type Vehicle = {
  id: string;
  plate_number: string;
  make: string;
  model: string;
};

type VehicleCost = {
  id: string;
  vehicle_id: string;
  cost_type: "fuel" | "maintenance" | "tyre" | "insurance" | "other";
  amount: number;
  currency: string;
  date: string;
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

type RouteProfitability = {
  route: string;
  origin: string;
  destination: string;
  totalTrips: number;
  totalDistance: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  revenuePerKm: number;
  costPerKm: number;
  avgTripRevenue: number;
  avgTripCost: number;
};

export default function RouteProfitabilityPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [costs, setCosts] = useState<VehicleCost[]>([]);
  const [revenues, setRevenues] = useState<TripRevenue[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");

  const loadRouteData = async () => {
    setLoading(true);
    try {
      const [tripsData, vehiclesData, costsData, revenuesData] = await Promise.all([
        supabase.from("trips").select("*"),
        supabase.from("vehicles").select("*"),
        supabase.from("vehicle_costs").select("*"),
        supabase.from("trip_revenue").select("*"),
      ]);

      setTrips(tripsData.data || []);
      setVehicles(vehiclesData.data || []);
      setCosts(costsData.data || []);
      setRevenues(revenuesData.data || []);
    } catch (err) {
      console.error("Error loading route data:", err);
      toast({ title: "Error", description: "Failed to load route data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRouteData();
  }, []);

  const calculateRouteProfitability = useMemo(() => {
    const routeMap = new Map<string, RouteProfitability>();

    trips.forEach((trip) => {
      const routeKey = `${trip.origin}-${trip.destination}`;
      const existing = routeMap.get(routeKey);

      const tripRevenue = revenues.filter((r) => r.trip_id === trip.id).reduce((sum, r) => sum + r.amount, 0) + (trip.fare_amount || 0);
      const tripCosts = costs.filter((c) => c.trip_id === trip.id).reduce((sum, c) => sum + c.amount, 0);

      if (existing) {
        existing.totalTrips += 1;
        existing.totalDistance += trip.distance_km || 0;
        existing.totalRevenue += tripRevenue;
        existing.totalCosts += tripCosts;
      } else {
        routeMap.set(routeKey, {
          route: routeKey,
          origin: trip.origin,
          destination: trip.destination,
          totalTrips: 1,
          totalDistance: trip.distance_km || 0,
          totalRevenue: tripRevenue,
          totalCosts: tripCosts,
          netProfit: 0,
          profitMargin: 0,
          revenuePerKm: 0,
          costPerKm: 0,
          avgTripRevenue: 0,
          avgTripCost: 0,
        });
      }
    });

    return Array.from(routeMap.values()).map((rp) => {
      rp.netProfit = rp.totalRevenue - rp.totalCosts;
      rp.profitMargin = rp.totalRevenue > 0 ? (rp.netProfit / rp.totalRevenue) * 100 : 0;
      rp.revenuePerKm = rp.totalDistance > 0 ? rp.totalRevenue / rp.totalDistance : 0;
      rp.costPerKm = rp.totalDistance > 0 ? rp.totalCosts / rp.totalDistance : 0;
      rp.avgTripRevenue = rp.totalTrips > 0 ? rp.totalRevenue / rp.totalTrips : 0;
      rp.avgTripCost = rp.totalTrips > 0 ? rp.totalCosts / rp.totalTrips : 0;
      return rp;
    }).sort((a, b) => b.netProfit - a.netProfit);
  }, [trips, costs, revenues]);

  const filteredRoutes = selectedVehicleId === "all"
    ? calculateRouteProfitability
    : calculateRouteProfitability.filter((rp) => {
        const routeTrips = trips.filter((t) => `${t.origin}-${t.destination}` === rp.route);
        return routeTrips.some((t) => t.vehicle_id === selectedVehicleId);
      });

  const chartData = useMemo(() => {
    return filteredRoutes.slice(0, 10).map((rp) => ({
      name: `${rp.origin} → ${rp.destination}`,
      revenue: rp.totalRevenue,
      costs: rp.totalCosts,
      profit: rp.netProfit,
    }));
  }, [filteredRoutes]);

  const efficiencyData = useMemo(() => {
    return filteredRoutes.slice(0, 10).map((rp) => ({
      name: `${rp.origin} → ${rp.destination}`,
      revenuePerKm: rp.revenuePerKm,
      costPerKm: rp.costPerKm,
      margin: rp.profitMargin,
    }));
  }, [filteredRoutes]);

  const totalRevenue = filteredRoutes.reduce((sum, rp) => sum + rp.totalRevenue, 0);
  const totalCosts = filteredRoutes.reduce((sum, rp) => sum + rp.totalCosts, 0);
  const totalProfit = totalRevenue - totalCosts;
  const totalDistance = filteredRoutes.reduce((sum, rp) => sum + rp.totalDistance, 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <Button onClick={loadRouteData} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Route Profitability</h1>
        <p className="text-muted-foreground">Analyze profitability by route and optimize your logistics network</p>
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
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="size-4 text-success" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold text-success">{formatAmount(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="size-4 text-destructive" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Costs</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatAmount(totalCosts)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Net Profit</p>
            </div>
            <p className={cn("text-2xl font-bold", totalProfit >= 0 ? "text-success" : "text-destructive")}>
              {formatAmount(totalProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Route className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Distance</p>
            </div>
            <p className="text-2xl font-bold text-primary">{totalDistance.toLocaleString()} km</p>
          </CardContent>
        </Card>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 10 Routes by Profit</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={60} />
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
            <CardTitle className="text-sm">Route Efficiency (Revenue/Cost per KM)</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={efficiencyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={60} />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="revenuePerKm" stroke="#10b981" strokeWidth={2} name="Revenue/KM" />
                <Line type="monotone" dataKey="costPerKm" stroke="#ef4444" strokeWidth={2} name="Cost/KM" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5" /> Route Profitability Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Trips</TableHead>
                  <TableHead>Distance (km)</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Costs</TableHead>
                  <TableHead>Net Profit</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead>Revenue/KM</TableHead>
                  <TableHead>Cost/KM</TableHead>
                  <TableHead>Avg Trip Rev</TableHead>
                  <TableHead>Avg Trip Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground">
                      No route data available
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoutes.map((rp) => (
                    <TableRow key={rp.route}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Route className="size-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{rp.origin}</p>
                            <p className="text-xs text-muted-foreground">→ {rp.destination}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{rp.totalTrips}</TableCell>
                      <TableCell>{rp.totalDistance.toLocaleString()}</TableCell>
                      <TableCell className="text-success font-medium">{formatAmount(rp.totalRevenue)}</TableCell>
                      <TableCell className="text-destructive font-medium">{formatAmount(rp.totalCosts)}</TableCell>
                      <TableCell className={cn("font-medium", rp.netProfit >= 0 ? "text-success" : "text-destructive")}>
                        {formatAmount(rp.netProfit)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rp.profitMargin >= 0 ? "default" : "destructive"}>
                          {rp.profitMargin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{formatAmount(rp.revenuePerKm)}</TableCell>
                      <TableCell>{formatAmount(rp.costPerKm)}</TableCell>
                      <TableCell>{formatAmount(rp.avgTripRevenue)}</TableCell>
                      <TableCell>{formatAmount(rp.avgTripCost)}</TableCell>
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
