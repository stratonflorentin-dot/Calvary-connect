"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IndustryShell } from "@/components/industry/shell";
import { cn } from "@/lib/utils";

interface RoleHome {
  label: string;
  href: string;
}

interface PageTab {
  label: string;
  href: string;
}

// The rail lists all 6 role homes (design_handoff_calvary_connect Role
// Screens spec: "Rail lists six role homes"), not just the current role's
// pages — clicking one jumps to that role's landing page. Driver keeps its
// own dedicated mobile shell (src/components/driver/industry-driver-shell.tsx)
// rather than this desktop rail+tabs pattern, so it's still listed here for
// managers previewing it, but never the *active* shell.
const ROLE_HOMES: RoleHome[] = [
  { label: "CEO", href: "/premium-dashboard" },
  { label: "Operator", href: "/dispatch" },
  { label: "Accountant", href: "/finance" },
  { label: "HR", href: "/hr" },
  { label: "Mechanic", href: "/mechanic/service-queue" },
  { label: "Driver", href: "/driver" },
];

/**
 * Two-column shell for the 20 non-driver role pages: 210px rail (six role
 * homes) + main, with a page-tab row in the header for the current role's
 * own pages. Ported from design_handoff_calvary_connect's Role Screens
 * spec. Each page passing its own `pages` list (rather than a single
 * hardcoded 24-route registry here) lets pages ship one at a time without
 * this shell needing to know about routes that don't exist yet.
 */
export function IndustryRoleShell({
  roleLabel,
  pages,
  children,
}: {
  roleLabel: string;
  pages: PageTab[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <IndustryShell className="flex h-screen w-screen overflow-hidden">
      <div className="w-[210px] shrink-0 border-r border-[var(--ci-divider)] p-[13.6px] flex flex-col gap-1">
        <p className="ci-lbl px-2 mb-1">Roles</p>
        {ROLE_HOMES.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className={cn(
              "text-[13px] px-2 py-[7px] transition-colors duration-150",
              r.label === roleLabel
                ? "bg-[var(--ci-nav-active)] text-[var(--ci-accent-800)] font-semibold"
                : "text-[var(--ci-text-secondary)] hover:bg-[var(--ci-nav-hover)] hover:text-[var(--ci-text)]"
            )}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-[var(--ci-divider)] px-[22px] pt-[17px] pb-0 shrink-0">
          <h2 className="text-[26px] leading-none tracking-[-0.01em] mb-3" style={{ fontFamily: "var(--font-barlow-condensed)", fontWeight: 600 }}>
            {roleLabel}
          </h2>
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {pages.map((p) => {
              const active = pathname === p.href;
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className={cn(
                    "text-[13px] px-3 py-[8px] whitespace-nowrap border-b-2 transition-colors duration-150",
                    active ? "border-[var(--ci-accent)] text-[var(--ci-text)] font-semibold" : "border-transparent text-[var(--ci-text-tertiary)] hover:text-[var(--ci-text)]"
                  )}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-[18px_22px_26px]">{children}</main>
      </div>
    </IndustryShell>
  );
}
