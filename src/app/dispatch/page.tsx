"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  Truck, Navigation, CheckCircle2, Clock, AlertTriangle, Plus,
  Search, MoreVertical, User, RefreshCw, Zap,
  Package, ArrowRight, Eye, Edit, X, Loader2
} from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { cn } from "@/lib/utils";
import { applyTransition } from "@/lib/workflow/engine";
import { hoursSince, isOverdue, slaHours } from "@/lib/workflow/approvals";
import { toast } from "@/hooks/use-toast";
import { PageShell, PageHeader, RefreshControl } from "@/components/shell";
import { hydrateTrips } from "@/lib/trips/hydrate";

// ─── Types ───────────────────────────────────────────────────────────────────
type TripStatus = "pending" | "loading" | "in_transit" | "delivered" | "cancelled";

interface DispatchTrip {
  id: string;
  trip_number?: string;
  origin: string;
  destination: string;
  status: TripStatus;
  driver_name?: string;
  vehicle_plate?: string;
  cargo_type?: string;
  client?: string;
  created_at?: string;
  estimated_arrival?: string;
  revenue?: number;
}

// ─── Column Config ────────────────────────────────────────────────────────────
const COLUMNS: { id: TripStatus; label: string; color: string; bg: string; icon: React.ElementType; description: string }[] = [
  { id: "pending",    label: "Pending",    color: "text-warning",          bg: "bg-warning/5 border-warning/20",           icon: Clock,        description: "Awaiting assignment" },
  { id: "loading",   label: "Loading",    color: "text-muted-foreground", bg: "bg-muted/50 border-border",                icon: Package,      description: "Being loaded at origin" },
  { id: "in_transit",label: "In Transit", color: "text-info",             bg: "bg-info/5 border-info/20",                 icon: Navigation,   description: "Currently on the road" },
  { id: "delivered", label: "Delivered",  color: "text-success",          bg: "bg-success/5 border-success/20",           icon: CheckCircle2, description: "Successfully delivered" },
  { id: "cancelled", label: "Cancelled",  color: "text-destructive",      bg: "bg-destructive/5 border-destructive/20",   icon: X,            description: "Cancelled or rejected" },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusPip = ({ status }: { status: TripStatus }) => {
  const map: Record<TripStatus, string> = {
    pending:    "bg-warning",
    loading:    "bg-muted-foreground",
    in_transit: "bg-info animate-pulse",
    delivered:  "bg-success",
    cancelled:  "bg-destructive",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status]}`} />;
};

// ─── Trip Card ────────────────────────────────────────────────────────────────
function TripCard({
  trip,
  onDragStart,
  onQuickStatus,
}: {
  trip: DispatchTrip;
  onDragStart: (e: React.DragEvent, trip: DispatchTrip) => void;
  onQuickStatus: (trip: DispatchTrip, next: TripStatus) => void;
}) {
  const overdue =
    trip.status !== "delivered" && trip.status !== "cancelled" && trip.created_at
      ? isOverdue("trip", trip.created_at)
      : false;
  const ageH = trip.created_at ? hoursSince(trip.created_at) : 0;
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const nextStatus: Record<TripStatus, TripStatus | null> = {
    pending: "loading", loading: "in_transit", in_transit: "delivered", delivered: null, cancelled: null,
  };
  const next = nextStatus[trip.status];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, trip)}
      className="group bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-grab active:cursor-grabbing select-none"
    >
      {/* Card header */}
      <div className="p-3 pb-2 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusPip status={trip.status} />
            <span className="text-xs font-bold text-muted-foreground font-mono">
              {trip.trip_number || `TRP-${trip.id.slice(0, 6).toUpperCase()}`}
            </span>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenu(!menu)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menu && (
              <div className="absolute right-0 top-6 z-20 bg-card border border-border rounded-xl shadow-xl py-1 w-40 text-xs">
                <Link href={`/trips/${trip.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-muted text-foreground">
                  <Eye className="w-3.5 h-3.5" /> View Details
                </Link>
                <Link href={`/trips`} className="flex items-center gap-2 px-3 py-2 hover:bg-muted text-foreground">
                  <Edit className="w-3.5 h-3.5" /> Edit Trip
                </Link>
                {next && (
                  <button
                    onClick={() => { onQuickStatus(trip, next); setMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary/10 text-primary font-semibold"
                  >
                    <Zap className="w-3.5 h-3.5" /> Move to {next.replace("_", " ")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Route */}
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2 mb-2.5">
          <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-success" />
            <div className="w-px h-5 bg-border" />
            <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
          </div>
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate leading-tight">{trip.origin || "—"}</p>
            <p className="text-xs font-semibold text-foreground truncate leading-tight">{trip.destination || "—"}</p>
          </div>
        </div>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {trip.driver_name && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              <User className="w-2.5 h-2.5" /> {trip.driver_name}
            </span>
          )}
          {trip.vehicle_plate && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
              <Truck className="w-2.5 h-2.5" /> {trip.vehicle_plate}
            </span>
          )}
          {trip.cargo_type && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning bg-warning/10 rounded-full px-2 py-0.5">
              <Package className="w-2.5 h-2.5" /> {trip.cargo_type}
            </span>
          )}
        </div>

        {/* SLA warning */}
        {overdue && (
          <div className="flex items-center gap-1 mt-2 px-2 py-1 rounded-md bg-destructive/10 text-destructive text-[10px] font-bold uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" /> Overdue by {(ageH - slaHours.trip).toFixed(1)}h
          </div>
        )}

        {/* Client + quick action */}
        {(trip.client || next) && (
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/60">
            <span className="text-[10px] text-muted-foreground truncate">{trip.client || ""}</span>
            {next && (
              <button
                onClick={() => onQuickStatus(trip, next)}
                className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-0.5 shrink-0"
              >
                {next.replace("_", " ")} <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({
  col,
  trips,
  onDragStart,
  onDrop,
  onQuickStatus,
}: {
  col: typeof COLUMNS[0];
  trips: DispatchTrip[];
  onDragStart: (e: React.DragEvent, trip: DispatchTrip) => void;
  onDrop: (e: React.DragEvent, status: TripStatus) => void;
  onQuickStatus: (trip: DispatchTrip, next: TripStatus) => void;
}) {
  const [over, setOver] = useState(false);
  const Icon = col.icon;

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 transition-all duration-200 min-w-[260px] max-w-[300px] flex-1 ${
        over ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/10" : `border-transparent ${col.bg}`
      }`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); onDrop(e, col.id); }}
    >
      {/* Column header */}
      <div className="px-4 py-3 flex items-center justify-between sticky top-0">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${col.color}`} />
          <span className={`text-sm font-bold ${col.color}`}>{col.label}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${col.color} bg-card/80 border border-current/20`}>
            {trips.length}
          </span>
        </div>
      </div>
      <p className="px-4 text-[10px] text-muted-foreground -mt-2 mb-2">{col.description}</p>

      {/* Cards */}
      <div className="flex-1 px-3 pb-3 space-y-2.5 overflow-y-auto max-h-[calc(100vh-260px)] scrollbar-thin">
        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60">
            <Icon className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs font-medium">No trips</p>
          </div>
        ) : (
          trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} onDragStart={onDragStart} onQuickStatus={onQuickStatus} />
          ))
        )}
        {/* Drop hint */}
        {over && (
          <div className="border-2 border-dashed border-primary/30 rounded-xl h-16 flex items-center justify-center text-xs text-primary/70 font-medium">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DispatchBoardPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [trips, setTrips] = useState<DispatchTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<DispatchTrip | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadTrips = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) {
      const hydrated = await hydrateTrips(data);
      const mapped: DispatchTrip[] = hydrated.map((r: any) => ({
        id: r.id,
        trip_number: r.trip_number,
        origin: r.origin,
        destination: r.destination,
        status: (String(r.status ?? "pending").toLowerCase()) as TripStatus,
        driver_name: r.driver_name ?? undefined,
        vehicle_plate: r.vehicle_plate ?? undefined,
        cargo_type: r.cargo_type,
        client: r.client,
        created_at: r.created_at,
        estimated_arrival: r.estimated_arrival,
        revenue: r.revenue ?? r.price,
      }));
      setTrips(mapped);
    } else if (error) {
      console.error("[Dispatch] load error:", error.message);
    }
    setLoading(false);
    setLastUpdated(new Date());
  };

  useEffect(() => { loadTrips(); }, []);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, trip: DispatchTrip) => {
    setDragging(trip);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TripStatus) => {
    e.preventDefault();
    if (!dragging || dragging.status === targetStatus) { setDragging(null); return; }
    await updateStatus(dragging, targetStatus);
    setDragging(null);
  };

  const updateStatus = async (trip: DispatchTrip, newStatus: TripStatus) => {
    // Optimistic update
    setTrips((prev) => prev.map((t) => t.id === trip.id ? { ...t, status: newStatus } : t));
    setSaving(true);
    const result = await applyTransition({
      kind: "trip",
      entityId: trip.id,
      toState: newStatus,
      actorId: user?.id ?? "system",
      actorRole: (role as any) ?? undefined,
      payload: { entity: trip },
    });
    if (!result.ok) {
      // Revert and surface the reason
      setTrips((prev) => prev.map((t) => t.id === trip.id ? { ...t, status: trip.status } : t));
      toast({
        title: "Status change blocked",
        description: result.message,
        variant: "destructive",
      });
    } else if (result.sideEffects.length > 0) {
      toast({
        title: "Status updated",
        description: result.sideEffects.map((s) => s.replace(/_/g, " ")).join(", "),
      });
    }
    setSaving(false);
  };

  // Filter
  const q = search.toLowerCase();
  const filtered = trips.filter((t) =>
    !q || [t.trip_number, t.origin, t.destination, t.driver_name, t.client, t.vehicle_plate]
      .some((v) => v?.toLowerCase().includes(q))
  );

  const byStatus = (status: TripStatus) => filtered.filter((t) => t.status === status);

  // Stats
  const stats = [
    { label: "Total", value: trips.length, color: "text-foreground" },
    { label: "Pending", value: trips.filter(t => t.status === "pending").length, color: "text-warning" },
    { label: "In Transit", value: trips.filter(t => t.status === "in_transit").length, color: "text-info" },
    { label: "Delivered", value: trips.filter(t => t.status === "delivered").length, color: "text-success" },
  ];

  return (
    <PageShell width="full">
      <PageHeader
        eyebrow="Operations"
        title="Dispatch Board"
        subtitle={`${trips.length} trips · ${trips.filter(t => t.status === "in_transit").length} in transit${saving ? " · saving…" : ""}`}
        icon={Navigation}
        iconAccent="bg-primary text-primary-foreground"
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trips…"
                className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card w-48"
              />
            </div>
            <RefreshControl onRefresh={loadTrips} autoSeconds={30} storageKey="dispatch" />
            <Link href="/trips" className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 cv-elev-sm">
              <Plus className="w-3.5 h-3.5" /> New Trip
            </Link>
          </>
        }
      />

      {/* Stat strip */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 bg-card rounded-full px-3 py-1 border border-border">
            <span className="text-[10px] text-muted-foreground font-medium">{s.label}</span>
            <span className={`text-sm font-black ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Board */}
      <div className="overflow-x-auto -mx-6 px-6 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading dispatch board…</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 min-w-max pb-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                trips={byStatus(col.id)}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onQuickStatus={updateStatus}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drag ghost label */}
      {dragging && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground/90 text-background text-xs font-bold px-4 py-2 rounded-full shadow-xl backdrop-blur-sm pointer-events-none z-50">
          Drag to a column to update status
        </div>
      )}
    </PageShell>
  );
}
