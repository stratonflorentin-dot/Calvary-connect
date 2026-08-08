"use client";

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { StatCard, SectionCard, RefreshControl } from "@/components/shell";
import { useSupabase } from "@/components/supabase-provider";

/**
 * Reusable role-dashboard skeleton.
 *
 * Every non-executive role dashboard shares the same rhythm: welcome band,
 * KPI strip, and a set of section cards. Each role passes its data in;
 * layout stays consistent.
 */

export interface RoleKpi {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  accent?: string;
  href?: string;
  delta?: number;
}

export interface RoleSection {
  title: string;
  subtitle?: ReactNode;
  href?: string;
  padded?: boolean;
  colSpan?: number;
  content: ReactNode;
}

interface RoleDashboardProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  onRefresh: () => Promise<unknown> | unknown;
  storageKey: string;
  kpis: RoleKpi[];
  sections: RoleSection[];
  quickActions?: { href: string; label: string; icon: LucideIcon; tone?: string }[];
}

import Link from "next/link";
import { cn } from "@/lib/utils";

export function RoleDashboard({
  eyebrow,
  title,
  subtitle,
  onRefresh,
  storageKey,
  kpis,
  sections,
  quickActions,
}: RoleDashboardProps) {
  const { user } = useSupabase();
  return (
    <div className="space-y-6">
      <div className="cv-panel bg-gradient-to-br from-sidebar via-sidebar to-sidebar-accent text-sidebar-foreground border-sidebar-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{eyebrow}</p>
            <h1 className="text-2xl font-black tracking-tight">{title}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
            {subtitle && <p className="text-sm opacity-90 mt-1">{subtitle}</p>}
          </div>
          <RefreshControl onRefresh={onRefresh} storageKey={storageKey} compact />
        </div>
      </div>

      {kpis.length > 0 && (
        <div className={cn("grid gap-4",
          kpis.length <= 2 ? "grid-cols-2" :
          kpis.length <= 4 ? "grid-cols-2 md:grid-cols-4" :
          "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
        )}>
          {kpis.map((k, i) => (
            <StatCard
              key={i}
              label={k.label}
              value={k.value}
              sub={k.sub}
              icon={k.icon}
              accent={k.accent}
              href={k.href}
              delta={k.delta}
            />
          ))}
        </div>
      )}

      {sections.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {sections.map((s, i) => (
            <div key={i} className={cn("lg:col-span-" + (s.colSpan ?? 1))}>
              <SectionCard title={s.title} subtitle={s.subtitle} href={s.href} padded={s.padded ?? true}>
                {s.content}
              </SectionCard>
            </div>
          ))}
        </div>
      )}

      {quickActions && quickActions.length > 0 && (
        <SectionCard title="Quick actions" subtitle="Jump to what you need">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.href} href={a.href} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/30 transition-colors">
                  <div className={cn("p-2 rounded-lg", a.tone ?? "bg-primary/10 text-primary")}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-foreground text-center">{a.label}</span>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
