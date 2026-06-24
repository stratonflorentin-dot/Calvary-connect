'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  FileUp,
  Filter,
  Globe2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldX,
  Truck,
  WalletCards,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InsuranceSummary, InsuranceStatus, TruckInsurance } from '@/types/roles';
import { cn } from '@/lib/utils';

type TabKey = 'overview' | 'expiring' | 'cross_border' | 'compliance';

const statusStyles: Record<InsuranceStatus | 'cancelled', string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expiring_soon: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

const policyLabels: Record<string, string> = {
  third_party: 'Third Party',
  third_party_cargo: 'Third Party + Cargo',
  comprehensive: 'Comprehensive',
  cross_border: 'Cross-Border',
};

function formatMoney(value = 0) {
  if (value >= 1_000_000_000) return `TZS ${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `TZS ${(value / 1_000_000).toFixed(1)}M`;
  return `TZS ${value.toLocaleString()}`;
}

function daysUntil(date: string) {
  const today = new Date();
  const expiry = new Date(date);
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

function getRisk(policy: TruckInsurance) {
  const days = daysUntil(policy.expiry_date);
  if (policy.status === 'expired' || days < 0) return { label: 'Critical', className: 'bg-rose-600 text-white' };
  if (days <= 7) return { label: 'Urgent', className: 'bg-orange-600 text-white' };
  if (days <= 30) return { label: 'Watch', className: 'bg-amber-500 text-white' };
  if (policy.is_cross_border && !policy.has_comesa_yellow_card) {
    return { label: 'COMESA Gap', className: 'bg-sky-600 text-white' };
  }
  return { label: 'Covered', className: 'bg-emerald-600 text-white' };
}

function ProgressBar({ value, tone = 'emerald' }: { value: number; tone?: 'emerald' | 'sky' | 'amber' }) {
  const color = tone === 'sky' ? 'bg-sky-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div className={cn('h-2 rounded-full transition-all', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export default function InsuranceDashboard() {
  const [summary, setSummary] = useState<InsuranceSummary | null>(null);
  const [insurance, setInsurance] = useState<TruckInsurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InsuranceStatus>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, insuranceRes] = await Promise.all([
        fetch('/api/insurance/summary'),
        fetch('/api/insurance'),
      ]);

      const summaryData = await summaryRes.json();
      const insuranceData = await insuranceRes.json();
      setSummary(summaryData.data ?? null);
      setInsurance(insuranceData.data ?? []);
    } catch (error) {
      console.error('Error fetching insurance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPolicies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return insurance
      .filter((policy) => {
        if (activeTab === 'expiring') {
          const days = daysUntil(policy.expiry_date);
          if (days > 30 || days < -30) return false;
        }
        if (activeTab === 'cross_border' && !policy.is_cross_border) return false;
        if (statusFilter !== 'all' && policy.status !== statusFilter) return false;
        if (!normalized) return true;

        return [
          policy.insurer_name,
          policy.policy_type,
          policy.tira_reference_number,
          policy.vehicle_id,
          policy.route_coverage_area,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized));
      })
      .sort((a, b) => daysUntil(a.expiry_date) - daysUntil(b.expiry_date));
  }, [activeTab, insurance, query, statusFilter]);

  const complianceTotal = summary
    ? summary.mandatory_tira_compliance.compliant + summary.mandatory_tira_compliance.non_compliant
    : 0;
  const tiraRate = complianceTotal ? (summary!.mandatory_tira_compliance.compliant / complianceTotal) * 100 : 0;
  const crossBorderTotal = summary
    ? summary.cross_border_coverage.with_yellow_card + summary.cross_border_coverage.without_yellow_card
    : 0;
  const yellowCardRate = crossBorderTotal ? (summary!.cross_border_coverage.with_yellow_card / crossBorderTotal) * 100 : 100;
  const criticalPolicies = insurance.filter((policy) => policy.status === 'expired' || daysUntil(policy.expiry_date) <= 7).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-sky-200 bg-sky-50 text-sky-700">Fleet Compliance</Badge>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">TIRA Ready</Badge>
                {criticalPolicies > 0 && <Badge className="border-rose-200 bg-rose-50 text-rose-700">{criticalPolicies} urgent</Badge>}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">Insurance Command Center</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-600">
                  Control policy coverage, renewals, claims readiness, cross-border compliance, and fleet insurance cost from one operations view.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                Refresh
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => window.print()}>
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Link href="/hr/insurance/bulk-import">
                <Button variant="outline" className="gap-2">
                  <FileUp className="h-4 w-4" />
                  Import
                </Button>
              </Link>
              <Link href="/hr/insurance/add">
                <Button className="gap-2 bg-slate-950 text-white hover:bg-slate-800">
                  <Plus className="h-4 w-4" />
                  New Policy
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Active Policies"
            value={summary?.total_active_policies ?? 0}
            detail={`${summary?.total_vehicles ?? 0} vehicles in fleet`}
            icon={ShieldCheck}
            tone="emerald"
          />
          <MetricCard
            title="Renewal Window"
            value={summary?.expiring_within_30_days ?? 0}
            detail="Policies expiring within 30 days"
            icon={CalendarClock}
            tone="amber"
          />
          <MetricCard
            title="Expired"
            value={summary?.expired_policies ?? 0}
            detail="Must be renewed before dispatch"
            icon={ShieldX}
            tone="rose"
          />
          <MetricCard
            title="Annual Premium"
            value={formatMoney(summary?.total_annual_premium ?? 0)}
            detail="Fleet insurance exposure"
            icon={WalletCards}
            tone="sky"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-slate-200 shadow-sm lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                    Compliance Health
                  </CardTitle>
                  <CardDescription>TIRA coverage, COMESA readiness, and dispatch risk.</CardDescription>
                </div>
                <Badge className={cn('border', tiraRate >= 90 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                  {tiraRate.toFixed(1)}% TIRA
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">TIRA Mandatory Coverage</p>
                    <p className="text-xs text-slate-500">Minimum third-party coverage per truck</p>
                  </div>
                  <span className="text-lg font-semibold text-slate-950">{tiraRate.toFixed(0)}%</span>
                </div>
                <ProgressBar value={tiraRate} />
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{summary?.mandatory_tira_compliance.compliant ?? 0} compliant</span>
                  <span>{summary?.mandatory_tira_compliance.non_compliant ?? 0} missing</span>
                </div>
              </div>
              <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">COMESA Yellow Card</p>
                    <p className="text-xs text-slate-500">Cross-border route readiness</p>
                  </div>
                  <span className="text-lg font-semibold text-slate-950">{yellowCardRate.toFixed(0)}%</span>
                </div>
                <ProgressBar value={yellowCardRate} tone="sky" />
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{summary?.cross_border_coverage.with_yellow_card ?? 0} ready</span>
                  <span>{summary?.cross_border_coverage.without_yellow_card ?? 0} gaps</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Dispatch Guardrails
              </CardTitle>
              <CardDescription>Rules ops should check before assigning routes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <GuardrailRow ok={(summary?.expired_policies ?? 0) === 0} label="No expired policy on assigned vehicle" />
              <GuardrailRow ok={(summary?.mandatory_tira_compliance.non_compliant ?? 0) === 0} label="TIRA coverage exists for every truck" />
              <GuardrailRow ok={(summary?.cross_border_coverage.without_yellow_card ?? 0) === 0} label="Yellow Card present for cross-border trucks" />
              <GuardrailRow ok={criticalPolicies === 0} label="No policy expiring inside 7 days" />
            </CardContent>
          </Card>
        </section>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-slate-700" />
                  Policy Register
                </CardTitle>
                <CardDescription>Search, review, and act on policy coverage across the fleet.</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search policies"
                    className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none ring-offset-white placeholder:text-slate-400 focus:border-slate-400 sm:w-72"
                  />
                </div>
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as 'all' | InsuranceStatus)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-8 text-sm outline-none focus:border-slate-400 sm:w-44"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="expiring_soon">Expiring soon</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 sm:w-auto sm:grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="expiring">Renewals</TabsTrigger>
                <TabsTrigger value="cross_border">Cross-Border</TabsTrigger>
                <TabsTrigger value="compliance">Compliance</TabsTrigger>
              </TabsList>
              <TabsContent value={activeTab} className="mt-4">
                <PolicyTable policies={filteredPolicies} loading={loading} />
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: ElementType;
  tone: 'emerald' | 'amber' | 'rose' | 'sky';
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-semibold text-slate-950">{value}</p>
            <p className="text-xs text-slate-500">{detail}</p>
          </div>
          <div className={cn('rounded-md border p-2', tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GuardrailRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
      <span className="text-sm text-slate-700">{label}</span>
    </div>
  );
}

function PolicyTable({ policies, loading }: { policies: TruckInsurance[]; loading: boolean }) {
  if (loading) {
    return <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">Loading insurance command data...</div>;
  }

  if (policies.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
        <FileText className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-medium text-slate-700">No policies match this view</p>
        <p className="mt-1 text-xs text-slate-500">Add a policy or adjust your filters to see records.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Policy</th>
              <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
              <th className="px-4 py-3 text-left font-semibold">Coverage</th>
              <th className="px-4 py-3 text-left font-semibold">Expiry</th>
              <th className="px-4 py-3 text-left font-semibold">Risk</th>
              <th className="px-4 py-3 text-left font-semibold">Premium</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {policies.map((policy) => {
              const days = daysUntil(policy.expiry_date);
              const risk = getRisk(policy);
              return (
                <tr key={policy.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-950">{policy.insurer_name}</div>
                    <div className="mt-1 text-xs text-slate-500">{policy.tira_reference_number}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Truck className="h-4 w-4 text-slate-400" />
                      <span>{policy.vehicle_id?.slice(0, 8) || 'Unassigned'}</span>
                    </div>
                    {policy.assigned_driver_id && <div className="mt-1 text-xs text-slate-500">Driver {policy.assigned_driver_id.slice(0, 8)}</div>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-slate-200 text-slate-700">
                        {policyLabels[policy.policy_type] ?? policy.policy_type}
                      </Badge>
                      {policy.is_cross_border && (
                        <Badge className="border-sky-200 bg-sky-50 text-sky-700">
                          <Globe2 className="mr-1 h-3 w-3" />
                          Regional
                        </Badge>
                      )}
                      {policy.has_comesa_yellow_card && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">COMESA</Badge>}
                    </div>
                    {policy.route_coverage_area && <div className="mt-2 text-xs text-slate-500">{policy.route_coverage_area}</div>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-800">{new Date(policy.expiry_date).toLocaleDateString()}</div>
                    <div className={cn('mt-1 text-xs', days < 0 ? 'text-rose-600' : days <= 30 ? 'text-amber-600' : 'text-slate-500')}>
                      {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <Badge className={cn('w-fit', risk.className)}>{risk.label}</Badge>
                      <Badge variant="outline" className={cn('w-fit capitalize', statusStyles[policy.status])}>
                        {policy.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800">{formatMoney(policy.annual_premium)}</td>
                  <td className="px-4 py-4 text-right">
                    <Link href={`/hr/insurance/${policy.id}`}>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
