"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Route, Search, RefreshCw, TrendingUp, CheckCircle2, Clock,
  Truck, MapPin, User, DollarSign, Package, Calendar, Filter,
  ArrowRight, AlertTriangle, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  COMPLETED: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle2, label: 'Completed' },
  PENDING:   { bg: 'bg-amber-500/10 border-amber-500/20',   text: 'text-amber-400',   icon: Clock,         label: 'Pending'   },
  IN_TRANSIT: { bg: 'bg-blue-500/10 border-blue-500/20',    text: 'text-blue-400',    icon: Truck,         label: 'In Transit' },
  CANCELLED: { bg: 'bg-red-500/10 border-red-500/20',       text: 'text-red-400',     icon: XCircle,       label: 'Cancelled' },
  LOADED:    { bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-400',  icon: Package,       label: 'Loaded'    },
  DELIVERED: { bg: 'bg-teal-500/10 border-teal-500/20',     text: 'text-teal-400',    icon: CheckCircle2,  label: 'Delivered' },
};

const PAYMENT_STYLES: Record<string, { bg: string; text: string }> = {
  PAID:    { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  PENDING: { bg: 'bg-amber-500/10',  text: 'text-amber-400'   },
  ADVANCE: { bg: 'bg-blue-500/10',   text: 'text-blue-400'    },
};

export default function TripHistoryPage() {
  const { role, isAdmin } = useRole();
  const { user } = useSupabase();

  const [trips, setTrips] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<Record<string, any>>({});
  const [vehicles, setVehicles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tripsRes, driversRes, vehiclesRes] = await Promise.all([
        supabase.from('trips').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('id, name, avatar_url, phone').eq('role', 'DRIVER'),
        supabase.from('vehicles').select('id, plate_number, make, model, type'),
      ]);

      if (tripsRes.error) throw tripsRes.error;

      // Build lookup maps
      const driversMap: Record<string, any> = {};
      (driversRes.data || []).forEach((d: any) => { driversMap[d.id] = d; });

      const vehiclesMap: Record<string, any> = {};
      (vehiclesRes.data || []).forEach((v: any) => { vehiclesMap[v.id] = v; });

      setTrips(tripsRes.data || []);
      setDrivers(driversMap);
      setVehicles(vehiclesMap);
    } catch (err: any) {
      console.error('Failed to load trip history:', err);
      toast({ title: 'Load Failed', description: err.message || 'Could not fetch trips.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const filtered = trips.filter(t => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search ||
      (t.origin || '').toLowerCase().includes(searchLower) ||
      (t.destination || '').toLowerCase().includes(searchLower) ||
      (t.client || '').toLowerCase().includes(searchLower) ||
      (t.cargo || '').toLowerCase().includes(searchLower) ||
      (drivers[t.driver_id]?.name || '').toLowerCase().includes(searchLower) ||
      (vehicles[t.vehicle_id]?.plate_number || '').toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesPayment = paymentFilter === 'ALL' || t.payment_status === paymentFilter;
    const matchesType = typeFilter === 'ALL' || t.tripType === typeFilter;

    return matchesSearch && matchesStatus && matchesPayment && matchesType;
  });

  // Summary stats
  const totalRevenue = filtered.reduce((s, t) => s + (t.salesAmount || t.totalAmount || 0), 0);
  const completedCount = filtered.filter(t => t.status === 'COMPLETED' || t.status === 'DELIVERED').length;
  const pendingCount = filtered.filter(t => t.status === 'PENDING').length;
  const inTransitCount = filtered.filter(t => t.status === 'IN_TRANSIT' || t.status === 'LOADED').length;

  const fmt = (v: number) => new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(v);

  const statusOptions = ['ALL', 'PENDING', 'LOADED', 'IN_TRANSIT', 'COMPLETED', 'DELIVERED', 'CANCELLED'];
  const paymentOptions = ['ALL', 'PENDING', 'ADVANCE', 'PAID'];
  const typeOptions = ['ALL', 'local', 'transit'];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Sidebar role={role || 'ADMIN'} />

      <main className="flex-1 md:ml-60 p-5 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-7">

          {/* ─── Header ─── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                Trip History
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                Full chronological log of all company shipments, routes, and payment statuses.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={loadData}
              disabled={loading}
              className="border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-200 self-start md:self-auto"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* ─── KPI Cards ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Trips', value: filtered.length, icon: Route, color: 'indigo' },
              { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'emerald' },
              { label: 'In Transit', value: inTransitCount, icon: Truck, color: 'blue' },
              { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign, color: 'amber' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className={`bg-slate-900/40 border-slate-800/80 hover:border-${color}-500/40 transition-all duration-200 backdrop-blur-sm`}>
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className={`text-[10px] uppercase font-bold tracking-wider text-${color}-500`}>{label}</p>
                    <p className={`text-xl font-black mt-1 text-${color}-400 font-mono`}>{value}</p>
                  </div>
                  <div className={`w-10 h-10 bg-${color}-500/10 border border-${color}-500/20 rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 text-${color}-400`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ─── Filters Bar ─── */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center backdrop-blur-sm">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search route, driver, cargo, client, plate..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-blue-500 w-full"
              />
            </div>

            {/* Status filter */}
            <div className="flex gap-1 bg-slate-950 border border-slate-800 p-1 rounded-lg overflow-x-auto flex-shrink-0">
              {statusOptions.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                    statusFilter === s ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-200'
                  }`}
                >{s === 'ALL' ? 'All Status' : s}</button>
              ))}
            </div>

            {/* Payment filter */}
            <div className="flex gap-1 bg-slate-950 border border-slate-800 p-1 rounded-lg flex-shrink-0">
              {paymentOptions.map(p => (
                <button
                  key={p}
                  onClick={() => setPaymentFilter(p)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                    paymentFilter === p ? 'bg-slate-800 text-amber-400' : 'text-slate-500 hover:text-slate-200'
                  }`}
                >{p === 'ALL' ? 'All Payments' : p}</button>
              ))}
            </div>

            {/* Type filter */}
            <div className="flex gap-1 bg-slate-950 border border-slate-800 p-1 rounded-lg flex-shrink-0">
              {typeOptions.map(tp => (
                <button
                  key={tp}
                  onClick={() => setTypeFilter(tp)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                    typeFilter === tp ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-200'
                  }`}
                >{tp === 'ALL' ? 'All Types' : tp === 'local' ? '🇹🇿 Local' : '🌍 Transit'}</button>
              ))}
            </div>
          </div>

          {/* ─── Trips Table ─── */}
          <Card className="bg-slate-900/30 border-slate-800/80 shadow-xl overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <p className="text-slate-400 text-sm">Loading trip records...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
                <Route className="w-12 h-12 opacity-20" />
                <p className="text-sm">No trips match the current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-b border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs uppercase font-bold py-4 pl-6">Route</TableHead>
                      <TableHead className="text-slate-400 text-xs uppercase font-bold py-4">Driver</TableHead>
                      <TableHead className="text-slate-400 text-xs uppercase font-bold py-4">Vehicle</TableHead>
                      <TableHead className="text-slate-400 text-xs uppercase font-bold py-4">Cargo</TableHead>
                      <TableHead className="text-slate-400 text-xs uppercase font-bold py-4">Revenue</TableHead>
                      <TableHead className="text-slate-400 text-xs uppercase font-bold py-4">Type</TableHead>
                      <TableHead className="text-slate-400 text-xs uppercase font-bold py-4">Status</TableHead>
                      <TableHead className="text-slate-400 text-xs uppercase font-bold py-4">Payment</TableHead>
                      <TableHead className="text-slate-400 text-xs uppercase font-bold py-4">Date</TableHead>
                      <TableHead className="text-slate-400 text-xs uppercase font-bold py-4 pr-6 text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filtered.map(trip => {
                      const driver = drivers[trip.driver_id];
                      const vehicle = vehicles[trip.vehicle_id];
                      const statusStyle = STATUS_STYLES[trip.status] || STATUS_STYLES['PENDING'];
                      const payStyle = PAYMENT_STYLES[trip.payment_status] || PAYMENT_STYLES['PENDING'];
                      const StatusIcon = statusStyle.icon;
                      const isExpanded = expandedId === trip.id;
                      const revenue = trip.salesAmount || trip.totalAmount || 0;

                      return (
                        <>
                          <TableRow
                            key={trip.id}
                            className={`border-b border-slate-800/50 hover:bg-slate-900/20 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-900/20' : ''}`}
                            onClick={() => setExpandedId(isExpanded ? null : trip.id)}
                          >
                            {/* Route */}
                            <TableCell className="py-4 pl-6">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-sm">
                                <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                <span className="max-w-[100px] truncate">{trip.origin || '—'}</span>
                                <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                                <span className="max-w-[100px] truncate">{trip.destination || '—'}</span>
                              </div>
                              {trip.client && (
                                <p className="text-[10px] text-slate-500 mt-0.5 ml-5">Client: {trip.client}</p>
                              )}
                            </TableCell>

                            {/* Driver */}
                            <TableCell className="py-4">
                              {driver ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                    {driver.name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                  <span className="text-xs text-slate-300 font-medium max-w-[90px] truncate">{driver.name}</span>
                                </div>
                              ) : (
                                <span className="text-slate-600 text-xs italic">Unassigned</span>
                              )}
                            </TableCell>

                            {/* Vehicle */}
                            <TableCell className="py-4">
                              {vehicle ? (
                                <div className="flex items-center gap-1.5">
                                  <Truck className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                  <span className="text-xs text-slate-300 font-mono">{vehicle.plate_number}</span>
                                </div>
                              ) : (
                                <span className="text-slate-600 text-xs italic">No vehicle</span>
                              )}
                            </TableCell>

                            {/* Cargo */}
                            <TableCell className="py-4">
                              <div className="text-xs text-slate-300 max-w-[90px] truncate">{trip.cargo || '—'}</div>
                              {trip.cargoWeight && (
                                <p className="text-[10px] text-slate-600">{trip.cargoWeight}t</p>
                              )}
                            </TableCell>

                            {/* Revenue */}
                            <TableCell className="py-4 font-mono font-bold text-sm">
                              {revenue > 0 ? (
                                <span className="text-emerald-400">{fmt(revenue)}</span>
                              ) : (
                                <span className="text-slate-600 text-xs">—</span>
                              )}
                            </TableCell>

                            {/* Type */}
                            <TableCell className="py-4">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                trip.tripType === 'transit'
                                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}>
                                {trip.tripType === 'transit' ? '🌍 Transit' : '🇹🇿 Local'}
                              </span>
                            </TableCell>

                            {/* Status */}
                            <TableCell className="py-4">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${statusStyle.bg} ${statusStyle.text}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusStyle.label}
                              </span>
                            </TableCell>

                            {/* Payment */}
                            <TableCell className="py-4">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${payStyle.bg} ${payStyle.text}`}>
                                {trip.payment_status || 'PENDING'}
                              </span>
                            </TableCell>

                            {/* Date */}
                            <TableCell className="py-4">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Calendar className="w-3 h-3" />
                                {new Date(trip.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </TableCell>

                            {/* Expand toggle */}
                            <TableCell className="py-4 pr-6 text-right">
                              <button className="text-slate-600 hover:text-blue-400 transition-colors p-1">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </TableCell>
                          </TableRow>

                          {/* ─── Expanded Detail Row ─── */}
                          {isExpanded && (
                            <TableRow key={`${trip.id}-detail`} className="bg-slate-900/40 border-b border-slate-800/50">
                              <TableCell colSpan={10} className="py-5 px-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
                                  <div className="space-y-3">
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Route Info</p>
                                    <div className="space-y-1.5 text-slate-300">
                                      <p><span className="text-slate-500">From:</span> {trip.origin}</p>
                                      <p><span className="text-slate-500">To:</span> {trip.destination}</p>
                                      <p><span className="text-slate-500">Distance:</span> {trip.distance ? `${trip.distance} km` : '—'}</p>
                                      <p><span className="text-slate-500">Est. Time:</span> {trip.estimated_time || '—'}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Cargo & Client</p>
                                    <div className="space-y-1.5 text-slate-300">
                                      <p><span className="text-slate-500">Cargo:</span> {trip.cargo || '—'}</p>
                                      <p><span className="text-slate-500">Weight:</span> {trip.cargoWeight ? `${trip.cargoWeight} tons` : '—'}</p>
                                      <p><span className="text-slate-500">Client:</span> {trip.client || '—'}</p>
                                      <p><span className="text-slate-500">Waybill:</span> {trip.waybill_number || '—'}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Financial</p>
                                    <div className="space-y-1.5 text-slate-300">
                                      <p><span className="text-slate-500">Sales:</span> {trip.salesAmount ? fmt(trip.salesAmount) : '—'}</p>
                                      <p><span className="text-slate-500">VAT ({trip.vatRate || 0}%):</span> {trip.vatAmount ? fmt(trip.vatAmount) : '—'}</p>
                                      <p><span className="text-slate-500">Total:</span> <span className="text-emerald-400 font-bold">{trip.totalAmount ? fmt(trip.totalAmount) : '—'}</span></p>
                                      <p><span className="text-slate-500">Payment:</span> <span className={payStyle.text}>{trip.payment_status || 'PENDING'}</span></p>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Trip Costs</p>
                                    <div className="space-y-1.5 text-slate-300">
                                      <p><span className="text-slate-500">Fuel:</span> {trip.cost_fuel ? fmt(trip.cost_fuel) : '—'}</p>
                                      <p><span className="text-slate-500">Tolls:</span> {trip.cost_tolls ? fmt(trip.cost_tolls) : '—'}</p>
                                      <p><span className="text-slate-500">Border:</span> {trip.cost_border ? fmt(trip.cost_border) : '—'}</p>
                                      <p><span className="text-slate-500">Customs:</span> {trip.cost_customs ? fmt(trip.cost_customs) : '—'}</p>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Result count */}
          {!loading && (
            <p className="text-center text-xs text-slate-600">
              Showing {filtered.length} of {trips.length} trips
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
