"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { getListStagger, listItem } from "@/lib/animations";
import { PageShell, PageHeader, StatCard, SectionCard, EmptyState, PageSkeleton, RefreshControl } from "@/components/shell";
import { Button } from "@/components/ui/button";
import {
  Truck, Calendar, CheckCircle2, Clock, Activity, Users, Wrench,
  ArrowUpRight, Package, ShieldAlert, ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isVehicleAvailable, isVehicleInUse, isVehicleInMaintenance } from "@/lib/fleet/vehicle-status";

const QUICK_ACTIONS = [
  { href: "/trips", label: "New trip", icon: Truck, accent: "bg-primary/10 text-primary" },
  { href: "/bookings", label: "View bookings", icon: Calendar, accent: "bg-info/10 text-info" },
  { href: "/operations/pod", label: "Manage PODs", icon: Package, accent: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" },
  { href: "/fleet", label: "Fleet status", icon: Wrench, accent: "bg-warning/10 text-warning" },
];

export default function OperationsDashboard() {
  const { toast } = useToast();
  const { role, isLoading: roleLoading, hasDepartmentAccess } = useRole();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    inProgressBookings: 0,
    totalVehicles: 0,
    availableVehicles: 0,
    inUseVehicles: 0,
    maintenanceVehicles: 0,
    totalDrivers: 0,
    availableDrivers: 0,
    onTripDrivers: 0,
    pendingPODs: 0,
    verifiedPODs: 0,
    totalPODs: 0,
  });
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [
        bookingsData,
        tripsData,
        vehiclesData,
        usersData,
        podsData,
      ] = await Promise.all([
        supabase.from("bookings").select("*").eq("status", "pending").limit(5),
        supabase.from("trips").select("*").in("status", ["pending", "loading", "in_transit"]).limit(5),
        supabase.from("vehicles").select("*"),
        supabase.from("users").select("*").eq("role", "DRIVER"),
        supabase.from("proof_of_delivery").select("*"),
      ]);

      const allBookings = await supabase.from("bookings").select("*");
      const allTrips = await supabase.from("trips").select("*");

      setStats({
        totalBookings: allBookings.data?.length || 0,
        pendingBookings: allBookings.data?.filter((b: any) => b.status === "pending").length || 0,
        confirmedBookings: allBookings.data?.filter((b: any) => b.status === "confirmed").length || 0,
        inProgressBookings: allBookings.data?.filter((b: any) => b.status === "in_progress").length || 0,
        totalVehicles: vehiclesData.data?.length || 0,
        availableVehicles: vehiclesData.data?.filter((v: any) => isVehicleAvailable(v.status)).length || 0,
        inUseVehicles: vehiclesData.data?.filter((v: any) => isVehicleInUse(v.status)).length || 0,
        maintenanceVehicles: vehiclesData.data?.filter((v: any) => isVehicleInMaintenance(v.status)).length || 0,
        totalDrivers: usersData.data?.length || 0,
        availableDrivers: usersData.data?.filter((u: any) => u.status === "active").length || 0,
        onTripDrivers: allTrips.data?.filter((t: any) => t.status === "in_transit").length || 0,
        pendingPODs: podsData.data?.filter((p: any) => p.status === "pending").length || 0,
        verifiedPODs: podsData.data?.filter((p: any) => p.status === "verified").length || 0,
        totalPODs: podsData.data?.length || 0,
      });

      setActiveTrips(tripsData.data || []);
      setPendingBookings(bookingsData.data || []);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (roleLoading) return <PageShell width="wide"><PageSkeleton kpiCount={8} /></PageShell>;

  if (!hasDepartmentAccess("OPERATIONS") && role !== "CEO" && role !== "ADMIN") {
    return (
      <PageShell width="wide">
        <EmptyState
          icon={ShieldAlert}
          title="Access denied"
          description="Operations dashboard requires Operations department access."
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Operations"
        title="Operations Dashboard"
        subtitle="Fleet operations and trip management overview"
        icon={Activity}
        iconAccent="bg-primary text-primary-foreground"
        actions={
          <>
            <RefreshControl onRefresh={loadDashboardData} storageKey="operations-dashboard" />
            <Link href="/trips">
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Truck className="w-3.5 h-3.5" /> Manage trips
              </Button>
            </Link>
          </>
        }
      />

      {loading ? (
        <PageSkeleton kpiCount={8} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total bookings" value={stats.totalBookings} sub="All time" icon={Calendar} accent="bg-primary/10 text-primary" />
            <StatCard label="Pending" value={stats.pendingBookings} sub="Awaiting confirmation" icon={Clock} accent="bg-warning/10 text-warning" />
            <StatCard label="Confirmed" value={stats.confirmedBookings} sub="Ready for dispatch" icon={CheckCircle2} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" />
            <StatCard label="In progress" value={stats.inProgressBookings} sub="Active operations" icon={Activity} accent="bg-info/10 text-info" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total vehicles" value={stats.totalVehicles} sub="Fleet size" icon={Truck} accent="bg-primary/10 text-primary" />
            <StatCard label="Available" value={stats.availableVehicles} sub="Ready for assignment" icon={CheckCircle2} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" />
            <StatCard label="In use" value={stats.inUseVehicles} sub="Currently on trips" icon={ArrowUpRight} accent="bg-info/10 text-info" />
            <StatCard label="Maintenance" value={stats.maintenanceVehicles} sub="Under repair" icon={Wrench} accent="bg-destructive/10 text-destructive" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
            <SectionCard title="Driver status" icon={Users}>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat value={stats.totalDrivers} label="Total" tone="neutral" />
                <MiniStat value={stats.availableDrivers} label="Available" tone="success" />
                <MiniStat value={stats.onTripDrivers} label="On trip" tone="info" />
              </div>
            </SectionCard>

            <SectionCard title="POD status" icon={ClipboardCheck} href="/operations/pod">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat value={stats.totalPODs} label="Total" tone="neutral" />
                <MiniStat value={stats.pendingPODs} label="Pending" tone="warning" />
                <MiniStat value={stats.verifiedPODs} label="Verified" tone="success" />
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
            <SectionCard title="Active trips" icon={Truck} href="/trips" padded={false}>
              {activeTrips.length === 0 ? (
                <EmptyState icon={Truck} title="No active trips" description="Trips in progress will show up here." />
              ) : (
                <motion.ul
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: getListStagger(activeTrips.length) } } }}
                  initial="hidden"
                  animate="visible"
                  className="divide-y divide-border"
                >
                  {activeTrips.map((trip) => (
                    <motion.li key={trip.id} variants={listItem} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{trip.trip_number || trip.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground truncate">{trip.origin} → {trip.destination}</p>
                      </div>
                      <span className={cn("cv-chip shrink-0", trip.status === "in_transit" ? "cv-chip-info" : "cv-chip-warning")}>
                        {trip.status}
                      </span>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </SectionCard>

            <SectionCard title="Pending bookings" icon={Clock} href="/bookings" padded={false}>
              {pendingBookings.length === 0 ? (
                <EmptyState icon={Calendar} title="No pending bookings" description="New bookings awaiting a trip will show up here." />
              ) : (
                <motion.ul
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: getListStagger(pendingBookings.length) } } }}
                  initial="hidden"
                  animate="visible"
                  className="divide-y divide-border"
                >
                  {pendingBookings.map((booking) => (
                    <motion.li key={booking.id} variants={listItem} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{booking.booking_number}</p>
                        <p className="text-xs text-muted-foreground truncate">{booking.pickup_location} → {booking.delivery_location}</p>
                      </div>
                      <Link href="/trips" className="shrink-0">
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                          Create trip <ArrowUpRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </SectionCard>
          </div>

          <div>
            <h2 className="text-sm font-black text-foreground mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Quick actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {QUICK_ACTIONS.map(({ href, label, icon: Icon, accent }) => (
                <Link key={href} href={href}>
                  <motion.div
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="cv-surface p-5 flex flex-col items-center justify-center gap-2 text-center transition-colors hover:border-primary/30 hover:shadow-md"
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", accent)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-foreground">{label}</span>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

function MiniStat({ value, label, tone }: { value: number; label: string; tone: "neutral" | "success" | "warning" | "info" }) {
  const toneClass = {
    neutral: "bg-muted text-foreground",
    success: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]",
    warning: "bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]",
    info: "bg-[hsl(var(--info-soft))] text-[hsl(var(--info))]",
  }[tone];
  return (
    <div className={cn("text-center py-4 rounded-lg", toneClass)}>
      <div className="text-2xl font-black tracking-tight">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-0.5">{label}</div>
    </div>
  );
}
