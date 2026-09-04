"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Dispatch", href: "/dispatch" },
  { label: "Tracking", href: "/tracking", active: true },
  { label: "Live fleet map", href: "/map" },
  { label: "Sales handover", href: "/chat" },
  { label: "Trips", href: "/trips" },
  { label: "Fleet", href: "/fleet" },
];

/** Column 1 (196px) of the Tracking Console — logo, nav, live request
 *  counts, telematics-live indicator, user chip. Request counts are real
 *  pending-status counts, not the design handoff's placeholder numbers. */
export function TrackingRail() {
  const { user } = useSupabase();
  const [counts, setCounts] = useState({ fuel: 0, repair: 0, parts: 0 });
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [fuel, repair, parts] = await Promise.all([
        supabase.from("fuel_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("maintenance_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("parts_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      if (cancelled) return;
      setCounts({
        fuel: fuel.count ?? 0,
        repair: repair.count ?? 0,
        parts: parts.count ?? 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_profiles").select("name").eq("id", user.id).maybeSingle().then(({ data }) => {
      setUserName(data?.name ?? null);
    });
  }, [user]);

  return (
    <div className="flex flex-col h-full w-[196px] shrink-0 border-r border-[var(--ci-divider)] p-[13.6px]">
      <div className="flex items-center gap-2 mb-6">
        <div className="ci-blueprint ci-duotone size-8 shrink-0 grayscale contrast-[1.05]">
          <i className="ci-corner tl" /><i className="ci-corner tr" /><i className="ci-corner bl" /><i className="ci-corner br" />
          <Image src="/logo-mark.png" alt="" width={32} height={32} className="object-contain" />
        </div>
        <span className="text-[15px] font-semibold leading-none" style={{ fontFamily: "var(--font-barlow-condensed)" }}>
          Calvary Connect
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {MAIN_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-[13px] px-2 py-[7px] transition-colors duration-150",
              item.active
                ? "bg-[var(--ci-nav-active)] text-[var(--ci-accent-800)] font-semibold"
                : "text-[var(--ci-text-secondary)] hover:bg-[var(--ci-nav-hover)] hover:text-[var(--ci-text)]"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        <p className="ci-lbl px-2 mb-1">Requests</p>
        <div className="flex flex-col gap-0.5">
          <RequestLink label="Fuel" href="/fuel-approvals" count={counts.fuel} />
          <RequestLink label="Repair" href="/maintenance" count={counts.repair} />
          <RequestLink label="Parts" href="/parts-requests" count={counts.parts} />
        </div>
      </div>

      <div className="mt-5">
        <p className="ci-lbl px-2 mb-1">Insight</p>
        <div className="flex flex-col gap-0.5">
          <Link href="/reports" className="text-[13px] px-2 py-[7px] text-[var(--ci-text-secondary)] hover:bg-[var(--ci-nav-hover)] hover:text-[var(--ci-text)] transition-colors duration-150">
            Analysis
          </Link>
          <Link href="/trip-history" className="text-[13px] px-2 py-[7px] text-[var(--ci-text-secondary)] hover:bg-[var(--ci-nav-hover)] hover:text-[var(--ci-text)] transition-colors duration-150">
            History
          </Link>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-[var(--ci-divider)] flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--ci-text-tertiary)]">
          <span className="ci-pulse inline-block size-1.5 rounded-full bg-[var(--ci-accent)]" />
          Telematics live
        </div>
        <div className="text-[12px] text-[var(--ci-text-secondary)] truncate">{userName ?? user?.email ?? "—"}</div>
      </div>
    </div>
  );
}

function RequestLink({ label, href, count }: { label: string; href: string; count: number }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between text-[13px] px-2 py-[7px] text-[var(--ci-text-secondary)] hover:bg-[var(--ci-nav-hover)] hover:text-[var(--ci-text)] transition-colors duration-150"
    >
      <span>{label}</span>
      {count > 0 && <span className="ci-mono text-[11px]">{count}</span>}
    </Link>
  );
}
