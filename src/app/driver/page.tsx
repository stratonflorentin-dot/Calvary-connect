"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { useDriverData } from "@/hooks/use-driver-data";
import { useToast } from "@/hooks/use-toast";
import { IndustryDriverShell } from "@/components/driver/industry-driver-shell";
import { IndustryCard, IndustryCardKicker } from "@/components/industry/card";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";

const STATUS_FLOW = ["pending", "loading", "in_transit", "delivered"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  loading: "Loading",
  in_transit: "In transit",
  delivered: "Delivered",
};
const NEXT_ACTION_LABEL: Record<string, string> = {
  pending: "Start loading",
  loading: "Depart (in transit)",
  in_transit: "Mark delivered",
};

function normalizedStatus(raw: unknown): string {
  const s = String(raw || "").toLowerCase();
  if (["created", "loaded"].includes(s)) return "pending";
  if (["in_progress"].includes(s)) return "in_transit";
  if (["completed"].includes(s)) return "delivered";
  return s || "pending";
}

/**
 * Single-active-trip driver home, per design_handoff_calvary_connect's
 * Role Screens spec: only the two actions that generate company data
 * (status update, POD upload) are filled buttons. A delivered trip with no
 * POD gets its own status and the only filled button in the list — status
 * is already final there, so a second "update status" action would be a
 * dead button, not just redundant.
 */
export default function DriverHomePage() {
  const { role } = useRole();
  const router = useRouter();
  const { user } = useSupabase();
  const { toast } = useToast();
  const { trips, assignedVehicle, stats, loading, refresh } = useDriverData();
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (role && role !== "DRIVER") router.replace("/dashboard");
  }, [role, router]);

  const activeTrip = trips.find((t) => {
    const s = normalizedStatus(t.status);
    return s === "in_transit" || s === "loading" || s === "pending";
  });
  const deliveredNoPod = trips.find((t) => normalizedStatus(t.status) === "delivered" && !t.pod_id);

  const advanceStatus = async (tripId: string, current: string) => {
    const idx = STATUS_FLOW.indexOf(current as (typeof STATUS_FLOW)[number]);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;
    setUpdating(true);
    try {
      const { error } = await supabase.from("trips").update({ status: next, updated_at: new Date().toISOString() }).eq("id", tripId);
      if (error) throw error;
      toast({ variant: "success", title: `Trip marked ${STATUS_LABEL[next].toLowerCase()}` });
      await refresh();
    } catch (err: any) {
      toast({ title: "Couldn't update trip", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const trip = activeTrip ?? deliveredNoPod;
  const tripStatus = trip ? normalizedStatus(trip.status) : null;

  return (
    <IndustryDriverShell title={`Hi, ${(user as any)?.name?.split(" ")[0] ?? "driver"}`}>
      {loading ? (
        <p className="text-[13px] text-[var(--ci-text-tertiary)] text-center py-8">Loading…</p>
      ) : !trip ? (
        <IndustryCard>
          <IndustryCardKicker>Status</IndustryCardKicker>
          <p className="text-[15px] mt-1">No active trip right now.</p>
          <p className="text-[13px] text-[var(--ci-text-secondary)] mt-1">
            {assignedVehicle ? `Assigned vehicle: ${String(assignedVehicle.plate_number ?? "—")}` : "No vehicle assigned yet."}
          </p>
        </IndustryCard>
      ) : (
        <IndustryCard blueprint hover={false}>
          <div className="flex items-center justify-between">
            <IndustryCardKicker>Active trip</IndustryCardKicker>
            <IndustryTag variant={tripStatus === "delivered" ? "accent" : "neutral"} pulse={tripStatus === "in_transit"}>
              {STATUS_LABEL[tripStatus!] ?? tripStatus}
            </IndustryTag>
          </div>
          <p className="ci-mono text-[20px] mt-1">{String(trip.trip_number ?? "Trip")}</p>
          <p className="text-[14px] mt-1">
            {String(trip.origin ?? "—")} <span className="text-[var(--ci-text-tertiary)]">→</span> {String(trip.destination ?? "—")}
          </p>

          <div className="flex flex-col gap-2 mt-4">
            {tripStatus !== "delivered" && tripStatus && NEXT_ACTION_LABEL[tripStatus] && (
              <IndustryButton
                variant="primary"
                size="driver"
                disabled={updating}
                onClick={() => advanceStatus(String(trip.id), tripStatus)}
              >
                {NEXT_ACTION_LABEL[tripStatus]}
              </IndustryButton>
            )}
            {tripStatus === "delivered" && (
              <IndustryButton variant="primary" size="driver" asChild>
                <Link href="/proof">Upload proof of delivery</Link>
              </IndustryButton>
            )}
          </div>
        </IndustryCard>
      )}

      <div className="ci-metric-strip grid-cols-2 mt-1">
        <div>
          <p className="ci-lbl">Pending</p>
          <p className="ci-mono text-[22px] leading-[.92]">{stats.pendingDeliveries}</p>
        </div>
        <div>
          <p className="ci-lbl">Delivered</p>
          <p className="ci-mono text-[22px] leading-[.92]">{stats.completedDeliveries}</p>
        </div>
      </div>
    </IndustryDriverShell>
  );
}
