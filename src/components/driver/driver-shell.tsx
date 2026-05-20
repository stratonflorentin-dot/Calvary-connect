"use client";

import { Sidebar } from "@/components/navigation/sidebar";
import { BottomTabs } from "@/components/navigation/bottom-tabs";
import type { ReactNode } from "react";

interface DriverShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function DriverShell({ title, description, children, action }: DriverShellProps) {
  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Sidebar role="DRIVER" />
      <main className="flex-1 md:ml-60 p-4 md:p-6 max-w-3xl mx-auto w-full">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-headline tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {action}
        </header>
        {children}
      </main>
      <BottomTabs role="DRIVER" />
    </div>
  );
}
