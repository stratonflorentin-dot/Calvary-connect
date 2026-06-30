"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  FileText, Upload, CheckCircle, XCircle, Clock, Search, 
  RefreshCw, Download, Eye, ArrowLeft, Truck, MapPin, Calendar
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type POD = {
  id?: string;
  trip_id: string;
  pod_number: string;
  delivery_date: string;
  receiver_name: string;
  receiver_signature?: string;
  delivery_notes?: string;
  delivery_document_url?: string;
  attachments?: string[];
  status: 'pending' | 'verified' | 'rejected';
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at?: string;
};

type Trip = {
  id: string;
  trip_number: string;
  origin: string;
  destination: string;
  client: string;
  status: string;
  pod_status: string;
  customer_delivery_confirmed: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  verified: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function PODPage() {
  const { toast } = useToast();
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [pods, setPods] = useState<POD[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewingPod, setViewingPod] = useState<POD | null>(null);

  const [podForm, setPodForm] = useState<POD>({
    trip_id: "",
    pod_number: "",
    delivery_date: format(new Date(), "yyyy-MM-dd"),
    receiver_name: "",
    delivery_notes: "",
    status: "pending",
    verified: false,
  });

  const loadPODs = async () => {
    setLoading(true);
    try {
      const [podsData, tripsData] = await Promise.all([
        supabase.from("proof_of_delivery").select("*, trips(trip_number, origin, destination, client, status)").order("created_at", { ascending: false }),
        supabase.from("trips").select("*").in("status", ["COMPLETED", "IN_PROGRESS"]).order("created_at", { ascending: false }),
      ]);

      setPods(podsData.data || []);
      setTrips(tripsData.data || []);
    } catch (err) {
      console.error("Error loading PODs:", err);
      toast({ title: "Error", description: "Failed to load PODs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPODs();
  }, []);

  const savePOD = async () => {
    if (!podForm.trip_id || !podForm.receiver_name) {
      toast({ title: "Validation Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const podNumber = `POD-${Date.now().toString().slice(-8)}`;
      const trip = trips.find(t => t.id === podForm.trip_id);

      const podData = {
        pod_number: podNumber,
        trip_id: podForm.trip_id,
        delivery_date: podForm.delivery_date,
        receiver_name: podForm.receiver_name,
        delivery_notes: podForm.delivery_notes,
        status: "pending",
        verified: false,
      };

      const { error } = await supabase.from("proof_of_delivery").insert([podData]);

      if (error) throw error;

      // Update trip POD status
      await supabase.from("trips").update({
        pod_status: "uploaded",
        customer_delivery_confirmed: true,
        customer_confirmed_at: new Date().toISOString(),
      }).eq("id", podForm.trip_id);

      await loadPODs();
      setShowDialog(false);
      setPodForm({
        trip_id: "",
        pod_number: "",
        delivery_date: format(new Date(), "yyyy-MM-dd"),
        receiver_name: "",
        delivery_notes: "",
        status: "pending",
        verified: false,
      });
      setSelectedTrip(null);
      toast({ title: "Success", description: "Proof of Delivery uploaded" });
    } catch (err) {
      console.error("Error saving POD:", err);
      toast({ title: "Error", description: "Failed to save POD", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const verifyPOD = async (pod: POD) => {
    if (!confirm(`Verify POD ${pod.pod_number}?`)) return;

    try {
      const { error } = await supabase.from("proof_of_delivery").update({
        verified: true,
        status: "verified",
        verified_by: role,
        verified_at: new Date().toISOString(),
      }).eq("id", pod.id);

      if (error) throw error;

      // Update trip status to completed
      await supabase.from("trips").update({
        status: "COMPLETED",
        pod_status: "verified",
      }).eq("id", pod.trip_id);

      await loadPODs();
      toast({ title: "Success", description: "POD verified" });
    } catch (err) {
      console.error("Error verifying POD:", err);
      toast({ title: "Error", description: "Failed to verify POD", variant: "destructive" });
    }
  };

  const rejectPOD = async (pod: POD) => {
    if (!confirm(`Reject POD ${pod.pod_number}?`)) return;

    try {
      const { error } = await supabase.from("proof_of_delivery").update({
        verified: false,
        status: "rejected",
      }).eq("id", pod.id);

      if (error) throw error;

      await loadPODs();
      toast({ title: "Success", description: "POD rejected" });
    } catch (err) {
      console.error("Error rejecting POD:", err);
      toast({ title: "Error", description: "Failed to reject POD", variant: "destructive" });
    }
  };

  const filteredPods = pods.filter(
    (pod) =>
      (statusFilter === "all" || pod.status === statusFilter) &&
      (pod.pod_number.toLowerCase().includes(search.toLowerCase()) ||
        pod.receiver_name.toLowerCase().includes(search.toLowerCase()))
  );

  const availableTrips = trips.filter(t => t.pod_status === "not_uploaded" || t.pod_status === null);

  if (role === "DRIVER") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role={role} />
        <main className="flex-1 md:ml-60 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Access denied. Drivers cannot access POD management.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role || "CEO"} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" asChild>
              <Link href="/operations">
                <ArrowLeft className="size-4 mr-2" /> Back to Operations
              </Link>
            </Button>
            <Button onClick={loadPODs} disabled={loading}>
              <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
            </Button>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Proof of Delivery</h1>
            <p className="text-muted-foreground">Manage delivery confirmations and POD documents</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="size-4 text-primary" />
                  <p className="text-xs font-medium text-muted-foreground uppercase">Total PODs</p>
                </div>
                <p className="text-2xl font-bold">{pods.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="size-4 text-warning" />
                  <p className="text-xs font-medium text-muted-foreground uppercase">Pending</p>
                </div>
                <p className="text-2xl font-bold text-warning">{pods.filter(p => p.status === "pending").length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="size-4 text-success" />
                  <p className="text-xs font-medium text-muted-foreground uppercase">Verified</p>
                </div>
                <p className="text-2xl font-bold text-success">{pods.filter(p => p.status === "verified").length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="size-4 text-blue-500" />
                  <p className="text-xs font-medium text-muted-foreground uppercase">Trips Needing POD</p>
                </div>
                <p className="text-2xl font-bold text-blue-500">{availableTrips.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mb-6">
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={availableTrips.length === 0}>
                  <Upload className="size-4" /> Upload POD
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Upload Proof of Delivery</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Select Trip *</Label>
                    <Select
                      value={podForm.trip_id}
                      onValueChange={(value) => {
                        const trip = trips.find(t => t.id === value);
                        setSelectedTrip(trip || null);
                        setPodForm({ ...podForm, trip_id: value });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select completed trip" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTrips.map((trip) => (
                          <SelectItem key={trip.id} value={trip.id}>
                            {trip.trip_number} - {trip.client} ({trip.origin} → {trip.destination})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTrip && (
                    <Card className="bg-muted/50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="size-4 text-muted-foreground" />
                          <span className="font-medium">{selectedTrip.origin} → {selectedTrip.destination}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm mt-1">
                          <FileText className="size-4 text-muted-foreground" />
                          <span>Client: {selectedTrip.client}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <div className="space-y-2">
                    <Label>Delivery Date *</Label>
                    <Input
                      type="date"
                      value={podForm.delivery_date}
                      onChange={(e) => setPodForm({ ...podForm, delivery_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Receiver Name *</Label>
                    <Input
                      value={podForm.receiver_name}
                      onChange={(e) => setPodForm({ ...podForm, receiver_name: e.target.value })}
                      placeholder="Name of person receiving goods"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delivery Notes</Label>
                      <Textarea
                        value={podForm.delivery_notes}
                        onChange={(e) => setPodForm({ ...podForm, delivery_notes: e.target.value })}
                        rows={3}
                        placeholder="Any notes about the delivery..."
                      />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => { setShowDialog(false); setSelectedTrip(null); }}>
                      Cancel
                    </Button>
                    <Button onClick={savePOD} disabled={submitting}>
                      {submitting ? "Uploading..." : "Upload POD"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                placeholder="Search PODs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PODs Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5" /> All Proof of Deliveries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>POD #</TableHead>
                      <TableHead>Trip</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Receiver</TableHead>
                      <TableHead>Delivery Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPods.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No PODs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPods.map((pod) => (
                        <TableRow key={pod.id}>
                          <TableCell className="font-medium">{pod.pod_number}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{(pod as any).trips?.trip_number || "Unknown"}</div>
                              <div className="text-muted-foreground">{(pod as any).trips?.client || ""}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {(pod as any).trips?.origin || ""} → {(pod as any).trips?.destination || ""}
                          </TableCell>
                          <TableCell>{pod.receiver_name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(pod.delivery_date), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[pod.status] || "bg-gray-10 text-gray border-gray/20"}>
                              {pod.status.charAt(0).toUpperCase() + pod.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {pod.status === "pending" && (role === "CEO" || role === "ADMIN" || role === "OPERATIONS") && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => verifyPOD(pod)} className="text-success">
                                    <CheckCircle className="size-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => rejectPOD(pod)} className="text-destructive">
                                    <XCircle className="size-4" />
                                  </Button>
                                </>
                              )}
                              {pod.delivery_document_url && (
                                <Button variant="ghost" size="sm" title="Download Document">
                                  <Download className="size-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
