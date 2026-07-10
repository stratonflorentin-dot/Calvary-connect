"use client";

import Link from "next/link";
import { PageShell, PageHeader } from "@/components/shell";
import {
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  FileBarChart,
  FileSpreadsheet,
  Landmark,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const REPORTS = [
  {
    href: "/finance/reports/profit-loss",
    icon: BarChart3,
    title: "Profit & Loss",
    description: "Income statement by period and currency.",
    tone: "bg-primary/10 text-primary",
  },
  {
    href: "/finance/reports/balance-sheet",
    icon: Scale,
    title: "Balance Sheet",
    description: "Assets, liabilities and equity position.",
    tone: "bg-violet-100 text-violet-700",
  },
  {
    href: "/finance/reports/cash-flow",
    icon: ArrowLeftRight,
    title: "Cash Flow",
    description: "Operating, investing and financing cash movement.",
    tone: "bg-sky-100 text-sky-700",
  },
  {
    href: "/finance/reports/revenue-analysis",
    icon: TrendingUp,
    title: "Revenue Analysis",
    description: "Revenue trends by client, route and vehicle.",
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    href: "/finance/reports/expense-analysis",
    icon: TrendingDown,
    title: "Expense Analysis",
    description: "Cost breakdown by category and cost centre.",
    tone: "bg-rose-100 text-rose-700",
  },
  {
    href: "/finance/reports/trial-balance",
    icon: FileSpreadsheet,
    title: "Trial Balance",
    description: "Debit and credit balances across all accounts.",
    tone: "bg-amber-100 text-amber-700",
  },
  {
    href: "/finance/reports/aging-report",
    icon: CalendarClock,
    title: "Aging Report",
    description: "Outstanding receivables and payables by age.",
    tone: "bg-orange-100 text-orange-700",
  },
  {
    href: "/finance/reports/tax-reports",
    icon: Receipt,
    title: "Tax Reports",
    description: "VAT and statutory tax summaries.",
    tone: "bg-teal-100 text-teal-700",
  },
  {
    href: "/finance/reports/reconciliation",
    icon: Landmark,
    title: "Reconciliation",
    description: "Bank and ledger reconciliation status.",
    tone: "bg-fuchsia-100 text-fuchsia-700",
  },
];

export default function FinanceReportsHubPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Finance"
        title="Financial reports"
        subtitle="Statements, analysis and compliance reporting"
        icon={FileBarChart}
        crumbs={[{ label: "Finance", href: "/finance" }, { label: "Reports" }]}
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="cv-surface p-5 flex flex-col gap-3 hover:border-primary/50 transition-colors group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.tone}`}>
              <r.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                {r.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
