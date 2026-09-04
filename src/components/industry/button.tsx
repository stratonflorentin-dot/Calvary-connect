import * as React from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-[var(--ci-accent)] text-[var(--ci-bg)] border-[var(--ci-accent)] hover:bg-[var(--ci-accent-600)] active:bg-[var(--ci-accent-700)]",
  secondary: "border-[var(--ci-divider)] hover:bg-[color-mix(in_srgb,var(--ci-text)_7%,transparent)] active:bg-[color-mix(in_srgb,var(--ci-text)_14%,transparent)]",
  ghost: "border-transparent text-[var(--ci-accent)] hover:bg-[color-mix(in_srgb,var(--ci-accent)_10%,transparent)] active:bg-[color-mix(in_srgb,var(--ci-accent)_18%,transparent)]",
};

/**
 * Industry design system button — hairline border, zero radius, scale(.97)
 * on press. `size="driver"` gives the 48px+ hit target the driver screens
 * require (design_handoff README: "Driver screens need 48px+ hit targets").
 */
export const IndustryButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    size?: "default" | "driver";
  }
>(({ children, className, variant = "secondary", size = "default", ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 border text-[14px] font-semibold transition-[background,color,border-color,transform] duration-150 ease-[cubic-bezier(.16,1,.3,1)]",
        "active:scale-[.97] disabled:opacity-45 disabled:pointer-events-none",
        size === "driver" ? "min-h-[48px] px-4" : "px-3 py-[7px]",
        VARIANT_CLASSES[variant],
        className
      )}
      style={{ fontFamily: "var(--font-barlow-condensed), system-ui, sans-serif" }}
      {...props}
    >
      {children}
    </button>
  );
});
IndustryButton.displayName = "IndustryButton";
