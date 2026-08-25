'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { slideUp, staggerContainer, listItem } from '@/lib/animations';

interface PageShellProps {
  children: ReactNode;
  className?: string;
  gutter?: 'none' | 'default' | 'loose';
  animate?: boolean;
}

export function PageShell({
  children,
  className,
  gutter = 'default',
  animate = true,
}: PageShellProps) {
  const Wrapper = animate ? motion.div : 'div';
  return (
    <Wrapper
      className={cn(
        'min-h-[calc(100vh-4rem)]',
        gutter === 'default' && 'p-4 sm:p-6 lg:p-8 pb-safe-bottom',
        gutter === 'loose' && 'p-6 sm:p-8 lg:p-10 pb-safe-bottom',
        className
      )}
      {...(animate
        ? {
            variants: staggerContainer,
            initial: 'hidden',
            animate: 'visible',
          }
        : {})}
    >
      {children}
    </Wrapper>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'center';
  animate?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  children,
  className,
  align = 'left',
  animate = true,
}: PageHeaderProps) {
  const Wrapper = animate ? motion.div : 'div';
  return (
    <Wrapper
      className={cn(
        'flex flex-col gap-4 pb-6 md:pb-8',
        align === 'left' ? 'sm:flex-row sm:items-start sm:justify-between' : 'items-center text-center',
        className
      )}
      {...(animate ? { variants: listItem } : {})}
    >
      <div className={cn('space-y-2', align === 'center' && 'max-w-2xl')}>
        {eyebrow && (
          <span className="cv-eyebrow">{eyebrow}</span>
        )}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm sm:text-base text-muted-foreground max-w-prose">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className={cn('flex flex-wrap items-center gap-3', align === 'center' && 'justify-center')}>
          {children}
        </div>
      )}
    </Wrapper>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, children, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4', className)}>
      <div>
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

interface PageSectionProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}

export function PageSection({ children, className, animate = true }: PageSectionProps) {
  const Wrapper = animate ? motion.section : 'section';
  return (
    <Wrapper
      className={cn('space-y-4', className)}
      {...(animate ? { variants: listItem } : {})}
    >
      {children}
    </Wrapper>
  );
}

export { slideUp };
