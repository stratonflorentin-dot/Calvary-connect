"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Crumb } from "./page-header";
import { StatusBadge } from "./status-badge";

interface EntityHeaderMetaItem {
  label: string;
  value: ReactNode;
}

interface EntityHeaderProps {
  crumbs?: Crumb[];
  /** e.g. "CUSTOMER", "INVOICE", "VEHICLE" — same slot PageHeader calls eyebrow. */
  eyebrow: string;
  /** Primary identity — a customer's name, an invoice/proforma number, a vehicle's plate. */
  title: string;
  /** Secondary identity shown right under the title — e.g. the customer name on an invoice. */
  subtitle?: ReactNode;
  status?: string | null;
  statusLabel?: string;
  /** Extra inline chips next to the status badge — e.g. "Zero Rated", "Disputed", a currency/FX note. */
  badges?: ReactNode;
  primaryMetricLabel?: string;
  primaryMetricValue?: ReactNode;
  primaryMetricTone?: "default" | "success" | "danger";
  metadata?: EntityHeaderMetaItem[];
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
}

/**
 * The one header every entity detail page (Customer/Vehicle/Bank Account/
 * Invoice/Proforma) renders through, so they read as one product instead of
 * five independently-invented layouts. Order matches the app's existing
 * PageHeader convention (breadcrumb -> eyebrow -> title) and then extends it
 * with the status/primary-metric/metadata row a detail page needs that a
 * list page doesn't.
 */
export function EntityHeader({
  crumbs,
  eyebrow,
  title,
  subtitle,
  status,
  statusLabel,
  primaryMetricLabel,
  primaryMetricValue,
  primaryMetricTone = "default",
  metadata,
  badges,
  primaryAction,
  secondaryActions,
  className,
}: EntityHeaderProps) {
  return (
    <header className={cn("mb-6", className)}>
      {crumbs && crumbs.length > 0 && (
        <nav className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.href ? (
                <Link href={c.href} className="hover:text-foreground transition-colors">{c.label}</Link>
              ) : (
                <span>{c.label}</span>
              )}
              {i < crumbs.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="cv-eyebrow">{eyebrow}</span>
          <div className="flex items-center gap-2.5 flex-wrap mt-1.5">
            <h1 className="text-2xl font-black text-foreground tracking-tight truncate">{title}</h1>
            {status && <StatusBadge status={status} label={statusLabel} />}
            {badges}
          </div>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}

          {(primaryMetricValue != null || (metadata && metadata.length > 0)) && (
            <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mt-4">
              {primaryMetricValue != null && (
                <div>
                  {primaryMetricLabel && <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{primaryMetricLabel}</p>}
                  <p className={cn(
                    "text-xl font-black tabular-nums mt-0.5",
                    primaryMetricTone === "success" && "text-success",
                    primaryMetricTone === "danger" && "text-destructive",
                    primaryMetricTone === "default" && "text-foreground",
                  )}>
                    {primaryMetricValue}
                  </p>
                </div>
              )}
              {metadata?.map((m, i) => (
                <div key={i}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{m.label}</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {(primaryAction || secondaryActions) && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
    </header>
  );
}
