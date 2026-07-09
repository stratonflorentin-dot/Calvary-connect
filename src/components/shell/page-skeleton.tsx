"use client";

import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  kpiCount?: number;
  className?: string;
}

/**
 * Consistent shimmer skeleton for pages loading their first payload.
 * Uses the same visual rhythm as the real page so there's no layout jump.
 */
export function PageSkeleton({ kpiCount = 4, className }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-3">
        <div className="cv-skeleton w-10 h-10 rounded-xl" />
        <div className="space-y-2">
          <div className="cv-skeleton h-5 w-48 rounded" />
          <div className="cv-skeleton h-3 w-64 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: kpiCount }).map((_, i) => (
          <div key={i} className="cv-panel space-y-3">
            <div className="cv-skeleton h-4 w-4 rounded" />
            <div className="cv-skeleton h-7 w-24 rounded" />
            <div className="cv-skeleton h-3 w-16 rounded" />
          </div>
        ))}
      </div>
      <div className="cv-panel space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="cv-skeleton h-8 rounded" />
        ))}
      </div>
    </div>
  );
}
