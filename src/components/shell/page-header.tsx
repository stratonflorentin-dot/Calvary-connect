"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  iconAccent?: string; // tailwind class e.g. "bg-primary text-primary-foreground"
  crumbs?: Crumb[];
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

/**
 * Standard page header for every module. Handles the eyebrow chip, crumbs,
 * icon block, and right-aligned actions in a consistent way so pages read
 * as one product rather than a stitched-together patchwork.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  iconAccent = "bg-primary text-primary-foreground",
  crumbs,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6", className)}>
      <div className="min-w-0 flex-1">
        {crumbs && crumbs.length > 0 && (
          <nav className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.href ? (
                  <Link href={c.href} className="hover:text-foreground transition-colors">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < crumbs.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2 mb-1">
          {eyebrow && <span className="cv-eyebrow">{eyebrow}</span>}
          {meta}
        </div>
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center cv-elev-sm shrink-0", iconAccent)}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-foreground tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </header>
  );
}
