"use client";

import { ReactNode } from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: ReactNode;
  /** Constrains inner max width. "narrow" for detail views, "wide" for kanbans and maps. */
  width?: "default" | "narrow" | "wide" | "full";
  className?: string;
}

/**
 * The single wrapper every top-level page should render.
 *
 * It mounts the sidebar, respects the collapse state, applies the global
 * background, and constrains inner content width. Pages should focus on their
 * own header (`<PageHeader />`) and content — the shell handles chrome.
 */
export function PageShell({ children, width = "default", className }: PageShellProps) {
  const { role } = useRole();
  const { isCollapsed } = useSidebar();

  const widthClass =
    width === "narrow" ? "max-w-4xl" :
    width === "wide" ? "max-w-[1600px]" :
    width === "full" ? "max-w-none" :
    "max-w-7xl";

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar role={(role as any) ?? "ADMIN"} />
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          isCollapsed ? "md:ml-20" : "md:ml-64",
        )}
      >
        <main className={cn("flex-1 px-4 sm:px-6 lg:px-8 py-6 mx-auto w-full", widthClass, className)}>
          {children}
        </main>
      </div>
    </div>
  );
}
