"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactNode } from "react";

interface MobileDataCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  onClick?: () => void;
}

export function MobileDataCard({
  title,
  subtitle,
  children,
  className,
  action,
  onClick,
}: MobileDataCardProps) {
  return (
    <Card
      className={cn(
        "hover:border-indigo-300 transition-colors cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">{title}</CardTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </div>
          {action && <div className="ml-2 shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">{children}</div>
      </CardContent>
    </Card>
  );
}
