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
import { Wrench, ArrowLeft, RefreshCw, Plus, Trash2, Edit2, TrendingUp, TrendingDown, Truck, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type Vehicle = {
  id: string;
  plate_number: string;
  make: string;
  model: string;
};

type MaintenanceCost = {
  id?: string;
  vehicle_id: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  maintenance_type: "routine" | "repair" | "inspection" | "other";
  odometer_reading?: number;
  vendor?: string;
};

const COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444"];

export default function MaintenanceCostsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [maintenanceCosts, setMaintenanceCosts] = useState<MaintenanceCost[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");
  const [modal, setModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [maintenanceForm, setMaintenanceForm] = useState({
    vehicle_id: "",
    amount: "",
    currency: "TZS",
    date: "",
    description: "",
    maintenance_type: "routine" as const,
    odometer_reading: "",
    vendor: "",
  });

  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceCost | null>(null);

  const loadMaintenanceCosts = async () => {
    setLoading(true);
    try {
      const [costsData, vehiclesData] = await Promise.all([
        supabase.from("vehicle_costs").select("*").eq("cost_type", "maintenance").order("date", { ascending: false }),
        supabase.from("vehicles").select("*"),
      ]);

      setMaintenanceCosts(costsData.data || []);
      setVehicles(vehiclesData.data || []);
    } catch (err) {
      console.error("Error loading maintenance costs:", err);
      toast({ title: "Error", description: "Failed to load maintenance costs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaintenanceCosts();
  }, []);

  const filteredCosts = selectedVehicleId === "all"
    ? maintenanceCosts
    : maintenanceCosts.filter((c) => c.vehicle_id === selectedVehicleId);

  const saveMaintenanceCost = async () => {
    if (!maintenanceForm.vehicle_id || !maintenanceForm.amount || !maintenanceForm.date) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const costData: MaintenanceCost = {
        vehicle_id: maintenanceForm.vehicle_id,
        amount: parseFloat(maintenanceForm.amount),
        currency: maintenanceForm.currency,
        date: maintenanceForm.date,
        description: maintenanceForm.description,
        maintenance_type: maintenanceForm.maintenance_type,
        odometer_reading: maintenanceForm.odometer_reading ? parseFloat(maintenanceForm.odometer_reading) : undefined,
        vendor: maintenanceForm.vendor,
      };

      let error;
      if (editingMaintenance?.id) {
        error = (await supabase.from("vehicle_costs").update({ ...costData, cost_type: "maintenance" }).eq("id", editingMaintenance.id)).error;
      } else {
        error = (await supabase.from("vehicle_costs").insert({ ...costData, cost_type: "maintenance" })).error;
      }

      if (error) throw error;

      await loadMaintenanceCosts();
      setModal(null);
      setMaintenanceForm({
        vehicle_id: "",
        amount: "",
        currency: "TZS",
        date: "",
        description: "",
        maintenance_type: "routine",
        odometer_reading: "",
        vendor: "",
      });
      setEditingMaintenance(null);
      toast({ title: "Success", description: editingMaintenance ? "Maintenance cost updated" : "Maintenance cost recorded" });
    } catch (err) {
      console.error("Error saving maintenance cost:", err);
      toast({ title: "Error", description: "Failed to save maintenance cost", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMaintenanceCost = async (id: string) => {
    if (!confirm("Are you sure you want to delete this maintenance cost?")) return;

    try {
      const { error } = await supabase.from("vehicle_costs").delete().eq("id", id);
      if (error) throw error;
      await loadMaintenanceCosts();
      toast({ title: "Success", description: "Maintenance cost deleted" });
    } catch (err) {
      console.error("Error deleting maintenance cost:", err);
      toast({ title: "Error", description: "Failed to delete maintenance cost", variant: "destructive" });
    }
  };

  const editMaintenanceCost = (cost: MaintenanceCost) => {
    setEditingMaintenance(cost);
    setMaintenanceForm({
      vehicle_id: cost.vehicle_id,
      amount: String(cost.amount),
      currency: cost.currency,
      date: cost.date,
      description: cost.description,
      maintenance_type: cost.maintenance_type || "routine",
      odometer_reading: cost.odometer_reading ? String(cost.odometer_reading) : "",
      vendor: cost.vendor || "",
    });
    setModal("maintenance");
  };

  const chartData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    filteredCosts.forEach((cost) => {
      const month = new Date(cost.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + cost.amount;
    });
    return Object.entries(monthlyData).map(([month, amount]) => ({ month, amount }));
  }, [filteredCosts]);

  const typeData = useMemo(() => {
    const typeCounts: Record<string, number> = { routine: 0, repair: 0, inspection: 0, other: 0 };
    filteredCosts.forEach((cost) => {
      const type = cost.maintenance_type || "other";
      typeCounts[type] = (typeCounts[type] || 0) + cost.amount;
    });
    return Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  }, [filteredCosts]);

  const vehicleMaintenanceData = useMemo(() => {
    return vehicles.map((vehicle) => {
      const vehicleCosts = filteredCosts.filter((c) => c.vehicle_id === vehicle.id);
      const totalCost = vehicleCosts.reduce((sum, c) => sum + c.amount, 0);
      return {
        name: vehicle.plate_number,
        cost: totalCost,
      };
    });
  }, [vehicles, filteredCosts]);

  const totalMaintenanceCost = filteredCosts.reduce((sum, c) => sum + c.amount, 0);
  const avgCostPerVehicle = vehicles.length > 0 ? totalMaintenanceCost / vehicles.length : 0;

  const getMaintenanceTypeBadge = (type: string) => {
    switch (type) {
      case "routine":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Routine</Badge>;
      case "repair":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Repair</Badge>;
      case "inspection":
        return <Badge className="bg-info/10 text-info border-info/20">Inspection</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <Button onClick={loadMaintenanceCosts} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Maintenance Costs</h1>
        <p className="text-muted-foreground">Track vehicle maintenance and repair expenses</p>
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
        <Dialog open={modal === "maintenance"} onOpenChange={(open) => setModal(open ? "maintenance" : null)}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> Add Maintenance Cost
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingMaintenance ? "Edit Maintenance Cost" : "Add Maintenance Cost"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Vehicle</Label>
                <Select value={maintenanceForm.vehicle_id} onValueChange={(value) => setMaintenanceForm({ ...maintenanceForm, vehicle_id: value })}>
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
              <div className="space-y-2">
                <Label>Maintenance Type</Label>
                <Select value={maintenanceForm.maintenance_type} onValueChange={(value: any) => setMaintenanceForm({ ...maintenanceForm, maintenance_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine Service</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={maintenanceForm.amount} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={maintenanceForm.date} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Odometer Reading (Optional)</Label>
                  <Input type="number" value={maintenanceForm.odometer_reading} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, odometer_reading: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Vendor (Optional)</Label>
                  <Input value={maintenanceForm.vendor} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vendor: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={maintenanceForm.description} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setModal(null); setEditingMaintenance(null); }}>Cancel</Button>
                <Button onClick={saveMaintenanceCost} disabled={submitting}>
                  {submitting ? "Saving..." : editingMaintenance ? "Update" : "Save"}
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
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Maintenance Cost</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatAmount(totalMaintenanceCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Records</p>
            </div>
            <p className="text-2xl font-bold text-primary">{filteredCosts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Avg Cost/Vehicle</p>
            </div>
            <p className="text-2xl font-bold text-warning">{formatAmount(avgCostPerVehicle)}</p>
          </CardContent>
        </Card>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Maintenance Costs</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="amount" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Costs by Type</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={(entry) => entry.name}>
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Costs by Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={vehicleMaintenanceData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="cost" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="size-5" /> Maintenance Cost Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Odometer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No maintenance costs recorded
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
                        <TableCell>{getMaintenanceTypeBadge(cost.maintenance_type || "other")}</TableCell>
                        <TableCell>{formatDate(cost.date)}</TableCell>
                        <TableCell>{cost.description}</TableCell>
                        <TableCell className="text-muted-foreground">{cost.vendor || "-"}</TableCell>
                        <TableCell>{cost.odometer_reading ? cost.odometer_reading.toLocaleString() : "-"}</TableCell>
                        <TableCell className="font-medium text-destructive">{formatAmount(cost.amount)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => editMaintenanceCost(cost)}>
                              <Edit2 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteMaintenanceCost(cost.id!)}>
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
