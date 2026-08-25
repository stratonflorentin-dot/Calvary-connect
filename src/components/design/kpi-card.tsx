'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { listItem } from '@/lib/animations';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label: string; positive?: boolean };
  href?: string;
  className?: string;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'destructive';
}

const variantStyles = {
  default: 'bg-card hover:border-primary/30',
  accent: 'bg-accent/10 border-accent/30 hover:border-accent/50',
  success: 'bg-success/10 border-success/30 hover:border-success/50',
  warning: 'bg-warning/10 border-warning/30 hover:border-warning/50',
  destructive: 'bg-destructive/10 border-destructive/30 hover:border-destructive/50',
};

export function KpiCard({ label, value, icon, trend, href, className, variant = 'default' }: KpiCardProps) {
  const content = (
    <motion.div
      variants={listItem}
      className={cn(
        'cv-surface p-5 transition-all duration-200 hover:shadow-md group',
        variantStyles[variant],
        href && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <p className="cv-kpi-label truncate">{label}</p>
          <p className="cv-kpi-value">{value}</p>
        </div>
        {icon && (
          <div className="shrink-0 w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-2 text-xs font-medium">
          <span className={cn(
            trend.positive ? 'text-success' : 'text-destructive'
          )}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }

  return content;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-4', className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
