"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, Package, MapPin, CheckCircle2, Clock, Truck,
  Navigation, AlertCircle, ArrowRight, Phone, RefreshCw,
  Shield, Globe, Loader2, ExternalLink
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type TripStatus = "pending" | "loading" | "in_transit" | "delivered" | "cancelled";

interface TrackingResult {
  id: string;
  trip_number: string;
  origin: string;
  destination: string;
  status: TripStatus;
  cargo_type?: string;
  client?: string;
  driver_name?: string;
  vehicle_plate?: string;
  created_at: string;
  estimated_arrival?: string;
  delivered_at?: string;
  notes?: string;
  revenue?: number;
}

// ─── Status Timeline Steps ─────────────────────────────────────────────────────
const STEPS: { id: TripStatus; label: string; desc: string; icon: React.ElementType }[] = [
  { id: "pending",    label: "Order Placed",    desc: "Trip created & pending assignment", icon: Clock },
  { id: "loading",   label: "Loading",          desc: "Cargo being loaded at origin",      icon: Package },
  { id: "in_transit",label: "In Transit",       desc: "Your shipment is on the road",      icon: Navigation },
  { id: "delivered", label: "Delivered",        desc: "Successfully delivered",             icon: CheckCircle2 },
];
const STATUS_INDEX: Record<TripStatus, number> = {
  pending: 0, loading: 1, in_transit: 2, delivered: 3, cancelled: -1,
};

// ─── Components ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TripStatus }) {
  const styles: Record<TripStatus, string> = {
    pending:    "bg-amber-50  text-amber-700  border-amber-200",
    loading:    "bg-blue-50   text-blue-700   border-blue-200",
    in_transit: "bg-sky-50    text-sky-700    border-sky-200",
    delivered:  "bg-green-50  text-green-700  border-green-200",
    cancelled:  "bg-red-50    text-red-600    border-red-200",
  };
  const labels: Record<TripStatus, string> = {
    pending: "Pending", loading: "Loading", in_transit: "In Transit",
    delivered: "Delivered", cancelled: "Cancelled",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "in_transit" ? "bg-sky-500 animate-pulse" : "bg-current"}`} />
      {labels[status]}
    </span>
  );
}

function TimelineStep({
  step, isActive, isComplete, isCancelled,
}: {
  step: typeof STEPS[0]; isActive: boolean; isComplete: boolean; isCancelled: boolean;
}) {
  const Icon = step.icon;
  return (
    <div className={`flex items-start gap-4 transition-all duration-500 ${isCancelled ? "opacity-30" : ""}`}>
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 shadow-sm ${
          isComplete ? "bg-green-500 border-green-500 text-white scale-110" :
          isActive   ? "bg-sky-500   border-sky-500   text-white scale-110 shadow-lg shadow-sky-200 animate-pulse" :
                       "bg-white     border-gray-200   text-gray-300"
        }`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <div className="pb-6 flex-1">
        <p className={`text-sm font-bold leading-tight ${isComplete || isActive ? "text-slate-800" : "text-slate-400"}`}>
          {step.label}
        </p>
        <p className={`text-xs mt-0.5 ${isComplete || isActive ? "text-slate-500" : "text-slate-300"}`}>
          {step.desc}
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TrackingPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim().toUpperCase();
    if (!q) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSearched(true);

    // Try exact trip_number match first, then partial
    const { data, error: dbErr } = await supabase
      .from("trips")
      .select(`
        id, trip_number, origin, destination, status, cargo_type,
        client, created_at, estimated_arrival, delivered_at, notes, revenue,
        driver:users!trips_driver_id_fkey(full_name),
        vehicle:fleet_vehicles!trips_vehicle_id_fkey(plate_number)
      `)
      .or(`trip_number.ilike.%${q}%,id.eq.${q.toLowerCase()}`)
      .limit(1)
      .single();

    if (dbErr || !data) {
      setError("No shipment found with that tracking number. Please double-check and try again.");
    } else {
      const r = data as any;
      setResult({
        id: r.id,
        trip_number: r.trip_number || `TRP-${r.id.slice(0, 8).toUpperCase()}`,
        origin: r.origin,
        destination: r.destination,
        status: r.status as TripStatus,
        cargo_type: r.cargo_type,
        client: r.client,
        driver_name: r.driver?.full_name,
        vehicle_plate: r.vehicle?.plate_number,
        created_at: r.created_at,
        estimated_arrival: r.estimated_arrival,
        delivered_at: r.delivered_at,
        notes: r.notes,
        revenue: r.revenue,
      });
    }
    setLoading(false);
  };

  const currentStep = result ? STATUS_INDEX[result.status] : -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col">
      {/* ── Hero / Search ── */}
      <div className="flex-1 flex flex-col items-center justify-start pt-16 px-4">
        {/* Logo area */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shadow-xl shadow-indigo-900/50">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white leading-tight tracking-tight">Calvary Connect</h1>
            <p className="text-xs text-slate-400 font-medium">Shipment Tracking Portal</p>
          </div>
        </div>

        {/* Search box */}
        <div className="w-full max-w-xl">
          <h2 className="text-3xl font-black text-white text-center mb-2">Track Your Shipment</h2>
          <p className="text-slate-400 text-center text-sm mb-8">Enter your tracking number to get real-time status updates</p>

          <form onSubmit={handleSearch} className="relative">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. TRP-2024-001"
                  className="w-full pl-11 pr-4 py-4 bg-white/10 backdrop-blur-sm text-white placeholder-slate-400 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm font-medium transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-sky-900/50 disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Track
              </button>
            </div>
          </form>

          {/* Trust badges */}
          <div className="flex justify-center gap-6 mt-6">
            {[
              { icon: Shield, text: "Secure & Private" },
              { icon: Globe, text: "Real-time Updates" },
              { icon: RefreshCw, text: "Always Current" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Icon className="w-3.5 h-3.5 text-sky-400" /> {text}
              </div>
            ))}
          </div>
        </div>

        {/* ── Results ── */}
        <div className="w-full max-w-2xl mt-10">
          {/* Error */}
          {error && searched && !loading && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl px-6 py-5 flex items-start gap-3 animate-in fade-in slide-in-from-top-3 duration-300">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Shipment Not Found</p>
                <p className="text-xs mt-1 opacity-80">{error}</p>
              </div>
            </div>
          )}

          {/* Result card */}
          {result && !loading && (
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-400">
              {/* Colored top bar by status */}
              <div className={`h-1.5 w-full ${
                result.status === "delivered" ? "bg-gradient-to-r from-green-400 to-emerald-500" :
                result.status === "in_transit" ? "bg-gradient-to-r from-sky-400 to-indigo-500" :
                result.status === "cancelled" ? "bg-red-400" :
                "bg-gradient-to-r from-amber-400 to-orange-400"
              }`} />

              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 font-medium">Tracking #</span>
                  </div>
                  <p className="text-xl font-black text-slate-800 font-mono">{result.trip_number}</p>
                  {result.client && <p className="text-xs text-slate-500 mt-0.5">{result.client}</p>}
                </div>
                <StatusBadge status={result.status} />
              </div>

              <div className="px-6 py-5 grid md:grid-cols-2 gap-6">
                {/* Route */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Route</p>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                      <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-100" />
                      <div className="w-0.5 h-10 bg-gray-200" />
                      <div className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-100" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Origin</p>
                        <p className="text-sm font-bold text-slate-700">{result.origin}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Destination</p>
                        <p className="text-sm font-bold text-slate-700">{result.destination}</p>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="mt-4 space-y-2">
                    {result.cargo_type && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Package className="w-3.5 h-3.5 text-amber-500" />
                        <span className="font-medium">Cargo:</span> {result.cargo_type}
                      </div>
                    )}
                    {result.vehicle_plate && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Truck className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-medium">Vehicle:</span> {result.vehicle_plate}
                      </div>
                    )}
                    {result.estimated_arrival && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                        <span className="font-medium">Est. Arrival:</span>{" "}
                        {new Date(result.estimated_arrival).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-medium">Dispatched:</span>{" "}
                      {new Date(result.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Progress</p>
                  {result.status === "cancelled" ? (
                    <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-red-700">Shipment Cancelled</p>
                        <p className="text-xs text-red-500 mt-0.5">{result.notes || "This shipment was cancelled."}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-100" />
                      {STEPS.map((step, i) => (
                        <TimelineStep
                          key={step.id}
                          step={step}
                          isComplete={i < currentStep}
                          isActive={i === currentStep}
                          isCancelled={result.status === "cancelled"}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  For support, contact{" "}
                  <a href="tel:+254700000000" className="font-bold text-sky-600 hover:underline">
                    +254 700 000 000
                  </a>
                </p>
                <button
                  onClick={handleSearch}
                  className="flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="py-6 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} Calvary Connect · All rights reserved
      </div>
    </div>
  );
}
