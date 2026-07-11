"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    mobile?: 1 | 2;
    tablet?: 1 | 2 | 3;
    laptop?: 2 | 3 | 4;
    desktop?: 3 | 4 | 5 | 6;
  };
  gap?: "sm" | "md" | "lg";
}

export function ResponsiveGrid({
  children,
  className,
  cols = { mobile: 1, tablet: 2, laptop: 3, desktop: 4 },
  gap = "md",
}: ResponsiveGridProps) {
  const colsClasses = {
    mobile: cols.mobile === 1 ? "grid-cols-1" : "grid-cols-2",
    tablet: cols.tablet === 1 ? "sm:grid-cols-1" : cols.tablet === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
    laptop: cols.laptop === 2 ? "lg:grid-cols-2" : cols.laptop === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
    desktop: cols.desktop === 3 ? "xl:grid-cols-3" : cols.desktop === 4 ? "xl:grid-cols-4" : cols.desktop === 5 ? "xl:grid-cols-5" : "xl:grid-cols-6",
  };

  const gapClasses = {
    sm: "gap-2 sm:gap-3",
    md: "gap-3 sm:gap-4",
    lg: "gap-4 sm:gap-6",
  };

  return (
    <div
      className={cn(
        "grid",
        colsClasses.mobile,
        colsClasses.tablet,
        colsClasses.laptop,
        colsClasses.desktop,
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}
