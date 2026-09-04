import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Industry design system card — a "blueprint" wireframe object: square,
 * transparent, 1px hairline border, no shadow. Standalone (not built on
 * @/components/ui/card) since that component is plain divs with no Radix
 * behavior to reuse — porting its baked-in rounded/shadow classes would
 * fight this system's own tokens instead of reusing anything real.
 *
 * `blueprint` adds the four corner registration marks — the system's
 * signature, used on every card in the reference screens.
 */
export function IndustryCard({
  children,
  className,
  blueprint = true,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  blueprint?: boolean;
  /** translateY(-1px) + accent border on hover, per the motion spec. */
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "ci-blueprint flex flex-col gap-[9px] p-[13px]",
        hover && "transition-[transform,border-color] duration-150 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-px hover:border-[var(--ci-accent)]",
        className
      )}
    >
      {blueprint && (
        <>
          <i className="ci-corner tl" />
          <i className="ci-corner tr" />
          <i className="ci-corner bl" />
          <i className="ci-corner br" />
        </>
      )}
      {children}
    </div>
  );
}

export function IndustryCardKicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("ci-lbl", className)}>{children}</p>;
}

export function IndustryCardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h5
      className={cn("text-[13px] font-semibold leading-tight", className)}
      style={{ fontFamily: "var(--font-barlow-condensed), system-ui, sans-serif" }}
    >
      {children}
    </h5>
  );
}

export function IndustryCardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[13px] leading-[1.6] text-[var(--ci-text-secondary)]", className)}>{children}</div>;
}
