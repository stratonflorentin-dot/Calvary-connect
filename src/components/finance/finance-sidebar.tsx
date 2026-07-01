"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Receipt,
  CreditCard,
  Banknote,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Calculator,
  Users,
  Building2,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileSpreadsheet,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SubmenuItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SubmenuItem[];
}

export const FINANCE_MENU_GROUPS: MenuGroup[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { path: "/finance", label: "Finance Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Accounting",
    icon: BookOpen,
    items: [
      { path: "/finance/accounting/chart-of-accounts", label: "Chart of Accounts", icon: BookOpen },
      { path: "/finance/accounting/journal-entries", label: "Journal Entries", icon: FileText },
      { path: "/finance/accounting/general-ledger", label: "General Ledger", icon: FileSpreadsheet },
      { path: "/finance/accounting/trial-balance", label: "Trial Balance", icon: Calculator },
    ],
  },
  {
    label: "Receivables",
    icon: TrendingUp,
    items: [
      { path: "/finance/receivables/customer-invoices", label: "Customer Invoices", icon: FileText },
      { path: "/finance/receivables/customer-payments", label: "Customer Payments", icon: Receipt },
      { path: "/finance/receivables/aging-report", label: "Aging Report", icon: BarChart3 },
    ],
  },
  {
    label: "Payables",
    icon: TrendingDown,
    items: [
      { path: "/finance/payables/vendor-bills", label: "Vendor Bills", icon: FileText },
      { path: "/finance/payables/vendor-payments", label: "Vendor Payments", icon: CreditCard },
      { path: "/finance/payables/supplier-aging", label: "Supplier Aging", icon: BarChart3 },
    ],
  },
  {
    label: "Treasury & Banking",
    icon: Landmark,
    items: [
      { path: "/finance/banking/bank-accounts", label: "Bank Accounts", icon: Building2 },
      { path: "/finance/banking/cash-accounts", label: "Cash Accounts", icon: Wallet },
      { path: "/finance/banking/bank-statements", label: "Bank Statements", icon: FileText },
      { path: "/finance/banking/bank-reconciliation", label: "Bank Reconciliation", icon: FileSpreadsheet },
      { path: "/finance/banking/internal-transfers", label: "Internal Transfers", icon: TrendingUp },
    ],
  },
  {
    label: "Financial Reports",
    icon: BarChart3,
    items: [
      { path: "/finance/reports/profit-loss", label: "Profit & Loss", icon: TrendingUp },
      { path: "/finance/reports/balance-sheet", label: "Balance Sheet", icon: FileSpreadsheet },
      { path: "/finance/reports/cash-flow", label: "Cash Flow", icon: Wallet },
      { path: "/finance/reports/revenue-analysis", label: "Revenue Analysis", icon: TrendingUp },
      { path: "/finance/reports/expense-analysis", label: "Expense Analysis", icon: TrendingDown },
      { path: "/finance/reports/fleet-profitability", label: "Fleet Profitability", icon: BarChart3 },
      { path: "/finance/reports/reconciliation", label: "COA Reconciliation", icon: FileText },
    ],
  },
];

export function FinanceSidebar() {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Overview", "Accounting", "Receivables", "Payables", "Treasury & Banking", "Financial Reports"]);

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev =>
      prev.includes(label)
        ? prev.filter(g => g !== label)
        : [...prev, label]
    );
  };

  return (
    <aside className="w-64 bg-card border-r border-border h-[calc(100vh-64px)] flex flex-col sticky top-16 overflow-y-auto">
      <nav className="p-4 space-y-2">
        {FINANCE_MENU_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          const isExpanded = expandedGroups.includes(group.label);
          const hasActiveItem = group.items.some(item => pathname === item.path);

          return (
            <div key={group.label} className="mb-2">
              <Button
                variant="ghost"
                className="w-full justify-between px-3 py-2 h-auto text-left"
                onClick={() => toggleGroup(group.label)}
              >
                <div className="flex items-center gap-2">
                  <GroupIcon className={cn(
                    "size-4",
                    hasActiveItem ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-medium",
                    hasActiveItem ? "text-primary" : "text-foreground"
                  )}>
                    {group.label}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </Button>
              {isExpanded && (
                <div className="pl-9 space-y-1 mt-1">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <ItemIcon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
