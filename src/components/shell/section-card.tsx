"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  href?: string;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

/**
 * A titled card with an optional right-aligned "View all" link and
 * bottom-padding toggle for tables that want to hug the edges.
 */
export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  actions,
  href,
  children,
  className,
  padded = true,
}: SectionCardProps) {
  return (
    <div className={cn("cv-surface overflow-hidden", className)}>
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
            <h3 className="text-sm font-black text-foreground">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {href && (
            <Link href={href} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
      <div className={padded ? "p-5" : ""}>
        {children}
      </div>
    </div>
  );
}
