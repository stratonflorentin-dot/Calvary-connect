import * as React from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES: Record<string, string> = {
  accent: "bg-[var(--ci-accent-100)] text-[var(--ci-accent-800)]",
  neutral: "bg-[color-mix(in_srgb,var(--ci-text)_8%,transparent)] text-[var(--ci-text-secondary)]",
  outline: "border border-[var(--ci-accent)] text-[var(--ci-accent)]",
  warning: "bg-[var(--ci-accent-100)] text-[var(--ci-accent-800)]",
  danger: "bg-[color-mix(in_srgb,#b3261e_12%,transparent)] text-[#8c1d18]",
};

/**
 * Industry design system tag — flat, square (no border-radius), used for
 * status/state labels throughout the reference screens (a live status tag,
 * a document expiry tag, a match-reason tag, ...).
 */
export function IndustryTag({
  children,
  className,
  variant = "neutral",
  pulse = false,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "accent" | "neutral" | "outline" | "warning" | "danger";
  /** Live/active indicator — opacity 1→.4→1, 1.9s infinite. */
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-[3px] text-[11px] tracking-[0.02em]",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {pulse && <span className="ci-pulse inline-block size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
