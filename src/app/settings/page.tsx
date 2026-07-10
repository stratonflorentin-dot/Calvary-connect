"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PageShell, PageHeader, SectionCard, RefreshControl } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { approvalRules, slaHours } from "@/lib/workflow/approvals";
import { KNOWN_CURRENCIES, REPORTING_CURRENCY } from "@/lib/finance/multi-currency";
import { AuditTrailService } from "@/services/audit-trail-service";
import { useSupabase } from "@/components/supabase-provider";
import {
  Bell,
  Building2,
  Clock,
  CircleDollarSign,
  Cog,
  Loader2,
  Save,
  Shield,
  Sparkles,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanySettings {
  name: string;
  legal_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  tin?: string;
  vat_registration?: string;
  reporting_currency: string;
  timezone: string;
  logo_url?: string;
}

const TIMEZONES = ["Africa/Dar_es_Salaam", "Africa/Nairobi", "Africa/Lusaka", "Africa/Johannesburg", "UTC"];

const TABS = [
  { id: "company", label: "Company",     icon: Building2 },
  { id: "money",   label: "Money & FX",  icon: CircleDollarSign },
  { id: "workflow", label: "Workflow SLAs", icon: Clock },
  { id: "approvals", label: "Approvals",  icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;

type TabId = typeof TABS[number]["id"];

export default function SettingsPage() {
  const { toast } = useToast();
  const { isAdmin } = useRole();
  const { user } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [tab, setTab] = useState<TabId>("company");

  const [company, setCompany] = useState<CompanySettings>({
    name: "",
    reporting_currency: REPORTING_CURRENCY,
    timezone: "Africa/Dar_es_Salaam",
  });

  const [rowId, setRowId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
    if (data) {
      setRowId(data.id);
      setCompany({
        name: data.company_name ?? "",
        legal_name: data.legal_name ?? "",
        address: data.address ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
        tin: data.tax_id ?? "",
        vat_registration: data.vat_registration ?? "",
        reporting_currency: data.base_currency ?? REPORTING_CURRENCY,
        timezone: data.timezone ?? "Africa/Dar_es_Salaam",
        logo_url: data.logo_url ?? "",
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveCompany = async () => {
    setSaving(true);
    try {
      // Map UI model onto the real company_settings columns
      const payload: Record<string, any> = {
        company_name: company.name || null,
        legal_name: company.legal_name || null,
        address: company.address || null,
        phone: company.phone || null,
        email: company.email || null,
        tax_id: company.tin || null,
        vat_registration: company.vat_registration || null,
        base_currency: company.reporting_currency,
        timezone: company.timezone,
        logo_url: company.logo_url || null,
        updated_at: new Date().toISOString(),
      };
      let error;
      if (rowId) {
        ({ error } = await supabase.from("company_settings").update(payload).eq("id", rowId));
      } else {
        const res = await supabase.from("company_settings").insert(payload).select("id").single();
        error = res.error;
        if (res.data?.id) setRowId(res.data.id);
      }
      if (error) {
        // Pre-010 fallback: only base columns exist
        const base = { company_name: payload.company_name, tax_id: payload.tax_id, address: payload.address, base_currency: payload.base_currency };
        const retry = rowId
          ? await supabase.from("company_settings").update(base).eq("id", rowId)
          : await supabase.from("company_settings").insert(base).select("id").single();
        if (retry.error) throw retry.error;
        if (!rowId && (retry as any).data?.id) setRowId((retry as any).data.id);
      }
      await AuditTrailService.log({
        user_id: user?.id,
        module: "management",
        action: "update",
        entity_type: "user" as any,
        entity_id: "company_settings",
        new_value: company,
        description: "Company settings updated",
      });
      toast({ title: "Saved", description: "Company settings updated." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const currentTab = useMemo(() => TABS.find((t) => t.id === tab)!, [tab]);

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="System"
        title="Settings"
        subtitle="Company profile, financial defaults, and workflow thresholds"
        icon={Cog}
        iconAccent="bg-primary text-primary-foreground"
        crumbs={[{ label: "System" }, { label: "Settings" }]}
        actions={<RefreshControl onRefresh={load} storageKey="settings" compact />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Tab rail */}
        <nav className="cv-surface p-2 h-fit sticky top-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="space-y-6">
          {tab === "company" && (
            <SectionCard
              title="Company Profile"
              subtitle="Shown on invoices, POD documents, and letterhead"
              actions={
                <Button onClick={saveCompany} disabled={saving || !isAdmin} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </Button>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="w-16 h-16 rounded-xl border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
                    {company.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={company.logo_url} alt="Company logo" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">Company logo</p>
                    <p className="text-xs text-muted-foreground">PNG or JPG, shown on the sidebar, invoices and printed documents.</p>
                  </div>
                  <label className="shrink-0">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      disabled={!isAdmin || uploadingLogo}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setUploadingLogo(true);
                        try {
                          const path = `company/logo-${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
                          const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
                          if (error) throw error;
                          const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
                          setCompany((p) => ({ ...p, logo_url: url }));
                          toast({ title: "Logo uploaded", description: "Hit Save to keep it." });
                        } catch (err: any) {
                          toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                        } finally {
                          setUploadingLogo(false);
                        }
                      }}
                    />
                    <span className={cn(
                      "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-bold cursor-pointer transition-colors",
                      uploadingLogo ? "opacity-60" : "hover:border-primary hover:text-primary",
                    )}>
                      {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {company.logo_url ? "Replace logo" : "Upload logo"}
                    </span>
                  </label>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Trading name</Label>
                  <Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="Calvary Connect" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Legal name</Label>
                  <Input value={company.legal_name ?? ""} onChange={(e) => setCompany({ ...company, legal_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tax ID (TIN)</Label>
                  <Input value={company.tin ?? ""} onChange={(e) => setCompany({ ...company, tin: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">VAT registration</Label>
                  <Input value={company.vat_registration ?? ""} onChange={(e) => setCompany({ ...company, vat_registration: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={company.phone ?? ""} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={company.email ?? ""} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Address</Label>
                  <Textarea value={company.address ?? ""} onChange={(e) => setCompany({ ...company, address: e.target.value })} rows={3} />
                </div>
              </div>
            </SectionCard>
          )}

          {tab === "money" && (
            <>
              <SectionCard
                title="Reporting Currency"
                subtitle="Primary currency for KPI cards and consolidated reports"
                actions={
                  <Button onClick={saveCompany} disabled={saving || !isAdmin} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                  </Button>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Currency</Label>
                    <Select value={company.reporting_currency} onValueChange={(v) => setCompany({ ...company, reporting_currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KNOWN_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Timezone</Label>
                    <Select value={company.timezone} onValueChange={(v) => setCompany({ ...company, timezone: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Foreign Exchange" subtitle="Historical rates for consolidated reports" href="/finance/accounting/fx-rates">
                <p className="text-sm text-muted-foreground">
                  Rates are stored historically. Reports pick up the most recent rate on or before the report date. Manage rates from the FX Rates page.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Link href="/finance/accounting/fx-rates">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Sparkles className="w-3.5 h-3.5" /> Manage FX Rates
                    </Button>
                  </Link>
                </div>
              </SectionCard>
            </>
          )}

          {tab === "workflow" && (
            <SectionCard title="SLA hours per workflow" subtitle="Requests older than these thresholds appear as overdue">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-3 py-2">Workflow</th>
                    <th className="px-3 py-2 text-right">SLA (hours)</th>
                    <th className="px-3 py-2">Where it surfaces</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(slaHours).map(([kind, hrs]) => (
                    <tr key={kind} className="border-t border-border">
                      <td className="px-3 py-3 font-bold capitalize">{kind.replace(/_/g, " ")}</td>
                      <td className="px-3 py-3 text-right font-mono">{hrs}h</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {kind === "trip" && "Dispatch board card, Trips list"}
                        {kind === "maintenance_request" && "Approvals inbox, Maintenance list"}
                        {kind === "fuel_request" && "Approvals inbox, Fuel Approvals"}
                        {kind === "expense" && "Approvals inbox, Expenses list"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-4">
                SLA thresholds live in <span className="font-mono">src/lib/workflow/approvals.ts</span> — edit and redeploy to change them.
              </p>
            </SectionCard>
          )}

          {tab === "approvals" && (
            <SectionCard title="Approval tiers" subtitle="Amount-based routing for spend requests">
              {Object.entries(approvalRules).map(([kind, tiers]) => (
                <div key={kind} className="mb-6 last:mb-0">
                  <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2 capitalize">{kind.replace(/_/g, " ")}</h4>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <th className="px-3 py-2">Up to</th>
                        <th className="px-3 py-2">Tier</th>
                        <th className="px-3 py-2">Approver roles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers?.map((t, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-3 font-mono text-xs">{t.maxAmount == null ? "no limit" : `TZS ${t.maxAmount.toLocaleString()}`}</td>
                          <td className="px-3 py-3 font-bold">{t.label}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {t.approverRoles.map((r) => <span key={r} className="cv-chip cv-chip-neutral">{r}</span>)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Tier thresholds live in <span className="font-mono">src/lib/workflow/approvals.ts</span>. Edit and redeploy to change them.
              </p>
            </SectionCard>
          )}

          {tab === "notifications" && (
            <SectionCard title="Notifications" subtitle="How the system reaches users">
              <p className="text-sm text-muted-foreground">
                Notifications are delivered in-app via the bell icon in the sidebar. All workflow transitions,
                approvals, and cross-module events (invoice generation, POD verification, expense approval) fire
                automatically. Email/SMS gateways can be added in a future release.
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="cv-panel">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                    <Bell className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold text-foreground">In-app bell</p>
                  <p className="text-xs text-muted-foreground mt-1">Live-subscribes per user; unread badge in the sidebar header.</p>
                </div>
                <div className="cv-panel">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Routing rules</p>
                  <p className="text-xs text-muted-foreground mt-1">Notification target roles are derived from workflow definitions.</p>
                </div>
                <div className="cv-panel">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Preventive scan</p>
                  <p className="text-xs text-muted-foreground mt-1">Auto-opens maintenance tickets on date/mileage thresholds.</p>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </PageShell>
  );
}
