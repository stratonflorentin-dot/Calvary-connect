"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { hoverLift } from "@/lib/animations";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  /** Tailwind classes for the icon bubble, e.g. "bg-primary/10 text-primary". */
  accent?: string;
  /** Percentage delta vs a prior period. Positive → green up-chip, negative → red down-chip. */
  delta?: number;
  href?: string;
  /** When true, negative values are considered "good" (like a reduced-expense KPI). */
  invertDelta?: boolean;
  loading?: boolean;
}

/**
 * Uniform KPI card. Every dashboard uses this so numbers align, feel like
 * one product, and gain drift chips for free.
 */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "bg-primary/10 text-primary",
  delta,
  href,
  invertDelta = false,
  loading = false,
}: StatCardProps) {
  const positive = invertDelta ? (delta ?? 0) < 0 : (delta ?? 0) >= 0;
  // Plain numeric values count up on change; anything else (pre-formatted
  // strings, currency, ReactNode) renders as-is — animating a raw number is
  // the one case we can do honestly without guessing at a formatter.
  const isPlainNumber = typeof value === "number" && Number.isFinite(value);

  const inner = (
    <div className="cv-kpi h-full flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
        {Icon && (
          <div className={cn("p-2 rounded-lg shrink-0", accent)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        {delta != null && !loading && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
              positive ? "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" : "bg-red-50 text-red-700",
            )}
          >
            {(delta ?? 0) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {loading ? (
          <div className="cv-skeleton h-7 w-24 rounded" />
        ) : isPlainNumber ? (
          <p className="cv-kpi-value"><AnimatedCounter value={value as number} /></p>
        ) : (
          <p className="cv-kpi-value">{value}</p>
        )}
        <p className="cv-kpi-label">{label}</p>
        {sub && !loading && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      <motion.div whileHover={hoverLift} whileTap={{ scale: 0.98 }} className="hover-lift h-full">
        {inner}
      </motion.div>
    </Link>
  ) : (
    inner
  );
}
