"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IndustryShell } from "@/components/industry/shell";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
}

const NAV: NavItem[] = [
  { label: "Home", href: "/driver" },
  { label: "My trips", href: "/driver/trips" },
  { label: "Fuel", href: "/driver/fuel" },
  { label: "Expenses", href: "/driver/expenses" },
];

/**
 * Driver screens per design_handoff_calvary_connect's Role Screens spec:
 * --color-accent-900 header, 48px+ hit targets, no nested in-page tabs,
 * bottom tab bar. Standalone from src/components/driver/driver-shell.tsx
 * (the existing shadcn-themed shell every driver page still uses) rather
 * than a shared component — this is a different visual system entirely,
 * ported one driver page at a time so nothing breaks mid-migration.
 */
export function IndustryDriverShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <IndustryShell className="min-h-screen flex flex-col pb-[64px]">
      <header className="bg-[var(--ci-accent-900)] text-[var(--ci-bg)] px-4 py-4">
        <h2 className="text-[22px] leading-none" style={{ fontFamily: "var(--font-barlow-condensed)", fontWeight: 600 }}>
          {title}
        </h2>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-3">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--ci-bg)] border-t border-[var(--ci-divider)] flex">
        {NAV.map((item) => {
          const active = item.href === "/driver" ? pathname === "/driver" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex items-center justify-center min-h-[48px] text-[12px] transition-colors duration-150 border-t-2",
                active ? "border-[var(--ci-accent)] text-[var(--ci-accent-800)] font-semibold" : "border-transparent text-[var(--ci-text-tertiary)]"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </IndustryShell>
  );
}
