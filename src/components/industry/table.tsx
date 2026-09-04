import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Industry design system table — hairline row dividers, uppercase 9.5px
 * headers at 55% ink, tabular-nums data cells. Standalone plain-HTML
 * wrappers (not built on @/components/ui/table, which is also plain divs
 * with no behavior of its own to reuse).
 */
export function IndustryTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <table className={cn("w-full border-collapse text-[13px]", className)}>
      {children}
    </table>
  );
}

export function IndustryTh({ children, className, align }: { children: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "ci-lbl border-b border-[var(--ci-divider)] px-[9px] py-[8px] font-normal",
        align === "right" && "text-right",
        align === "center" && "text-center",
        !align && "text-left",
        className
      )}
    >
      {children}
    </th>
  );
}

export function IndustryTd({
  children,
  className,
  align,
  mono = false,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** Identifiers, quantities, dates, money — rendered tabular-nums monospace. */
  mono?: boolean;
}) {
  return (
    <td
      className={cn(
        "border-b border-[var(--ci-cell-divider)] px-[9px] py-[10px]",
        mono && "ci-mono",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}

export function IndustryTr({
  children,
  className,
  selected = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  /** Accent border + 8% accent wash — used for the selected row in a list. */
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition-colors duration-150 ease-[cubic-bezier(.16,1,.3,1)]",
        onClick && "cursor-pointer",
        selected ? "bg-[var(--ci-selected)]" : "hover:bg-[var(--ci-row-hover)]",
        className
      )}
    >
      {children}
    </tr>
  );
}
