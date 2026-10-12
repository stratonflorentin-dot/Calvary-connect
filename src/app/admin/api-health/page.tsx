"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";

type Provider = { status: string; calls: number; failures: number; lastLatencyMs: number; lastCheckAt: string; lastSuccessAt?: string };
type Health = { providers: Record<string, Provider>; cache: { hits: number; misses: number; entries: number }; memory: { heapUsed: number; rss: number }; redisStatus: string };
type AuditEntry = { action: string | null; change_summary: string | null; created_at: string | null; details: Record<string, unknown> | null };

export default function ApiHealthPage() {
  const { role, isLoading } = useRole();
  const { toast } = useToast();
  const [health, setHealth] = useState<Health>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [realtime, setRealtime] = useState(false);
  const authHeaders = useCallback(async (json = false) => {
    const { data: { session } } = await supabase.auth.getSession();
    return { ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}), ...(json ? { "content-type": "application/json" } : {}) };
  }, []);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/external/health", { headers: await authHeaders(), cache: "no-store" });
    const payload = await response.json();
    if (payload.success) { setHealth(payload.data as Health); setAudit(payload.audit ?? []); }
  }, [authHeaders]);
  useEffect(() => {
    if (isLoading || !role || !["CEO", "ADMIN"].includes(String(role))) return;
    void refresh();
    let timer: number | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const fallback = () => { if (timer === undefined) timer = window.setInterval(() => void refresh(), 15_000); };
    try {
      channel = supabase.channel("admin-external-api-health")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "api_health_events" }, () => void refresh())
        .subscribe((status) => {
          if (status === "SUBSCRIBED") { setRealtime(true); if (timer !== undefined) window.clearInterval(timer); timer = undefined; }
          else { setRealtime(false); fallback(); }
        });
    } catch { fallback(); }
    return () => { if (timer !== undefined) window.clearInterval(timer); if (channel) void supabase.removeChannel(channel); };
  }, [isLoading, refresh, role]);

  async function action(actionName: "invalidate-cache" | "test-endpoints") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/external/health", { method: "POST", headers: await authHeaders(true), body: JSON.stringify({ action: actionName }) });
      const payload = await response.json();
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const description = retryAfter ? `Try again in ${retryAfter} seconds.` : "Wait before retrying.";
        setMessage(`Rate limited. ${description}`);
        toast({ title: "Health action rate limited", description, variant: "destructive" });
        return;
      }
      if (!response.ok) throw new Error(payload.error?.message ?? payload.error ?? "The action could not be completed.");
      setMessage(actionName === "invalidate-cache" ? `Cleared ${payload.data?.clearedEntries ?? 0} cached entries.` : `${(payload.data ?? []).filter((item: { success: boolean }) => item.success).length} of ${(payload.data ?? []).length} configured endpoints responded.`);
      toast({ title: actionName === "invalidate-cache" ? "Cache invalidated" : "Endpoint checks finished", description: actionName === "invalidate-cache" ? `${payload.data?.clearedEntries ?? 0} cached entries cleared.` : "Endpoint check results are shown in the dashboard." });
      await refresh();
    } catch (error) {
      const description = error instanceof Error ? error.message : "The action could not be completed.";
      setMessage(description);
      toast({ title: "Health action failed", description, variant: "destructive" });
    }
    finally { setBusy(false); }
  }

  function exportHealth() {
    if (!health) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), ...health }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "external-api-health.json"; link.click(); URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    if (!health) return;
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      pdf.setFontSize(18); pdf.text("External API health report", 14, 18);
      pdf.setFontSize(10); pdf.text(`Generated ${new Date().toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })} (EAT)`, 14, 26);
      pdf.setFontSize(13); pdf.text("Provider summary", 14, 38);
      let y = 47;
      Object.entries(health.providers).forEach(([name, provider]) => {
        const errorRate = provider.calls ? Math.round(provider.failures / provider.calls * 100) : 0;
        pdf.setFontSize(10); pdf.text(`${name}: ${provider.status} | ${provider.lastLatencyMs} ms latency | ${provider.calls} calls | ${errorRate}% errors`, 14, y);
        pdf.setDrawColor(80, 130, 180); pdf.rect(14, y + 3, 100, 3); pdf.setFillColor(46, 130, 90); pdf.rect(14, y + 3, Math.max(2, Math.min(100, provider.lastLatencyMs / 30)), 3, "F"); y += 12;
      });
      y += 3; pdf.setFontSize(13); pdf.text("Cache & runtime", 14, y); y += 8; pdf.setFontSize(10);
      pdf.text(`Cache hits ${health.cache.hits} | misses ${health.cache.misses} | entries ${health.cache.entries}`, 14, y); y += 6;
      pdf.text(`Heap ${(health.memory.heapUsed / 1048576).toFixed(1)} MB | RSS ${(health.memory.rss / 1048576).toFixed(1)} MB`, 14, y); y += 12;
      pdf.setFontSize(13); pdf.text("Recent admin audit events", 14, y); y += 8; pdf.setFontSize(9);
      for (const item of audit.slice(0, 12)) {
        if (y > 275) { pdf.addPage(); y = 18; }
        pdf.text(`${item.created_at ? new Date(item.created_at).toLocaleString() : "Unknown time"} | ${item.change_summary ?? item.action ?? "Admin action"}`, 14, y, { maxWidth: 180 }); y += 7;
      }
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      pdf.save(`api-health-report-${date}.pdf`);
    } catch (error) { toast({ title: "PDF export failed", description: error instanceof Error ? error.message : "Could not create report.", variant: "destructive" }); }
  }

  if (isLoading) return <main className="p-8 text-sm text-muted-foreground">Checking access…</main>;
  if (!role || !["CEO", "ADMIN"].includes(String(role))) return <main className="p-8"><h1 className="text-xl font-semibold">Admin access required</h1></main>;
  const cards = [
    { key: "tpa", label: "TPA vessel schedule", detail: "Official port shipping list" },
    { key: "globalpetrolprices", label: "Fuel prices", detail: "7 fuel operations" },
    { key: "exchangerate", label: "Exchange rates", detail: "Base currency: TZS" },
    { key: "nager", label: "Tanzania holidays", detail: "Annual public holiday list" },
  ];
  const totalCache = health ? health.cache.hits + health.cache.misses : 0;
  const alerts = health ? [
    ...Object.entries(health.providers).flatMap(([provider, state]) => [
      ...(state.lastLatencyMs > 2_000 ? [`${provider} latency is above 2 seconds.`] : []),
      ...(state.calls > 0 && state.failures / state.calls > 0.05 ? [`${provider} error rate is above 5%.`] : []),
    ]),
    ...(totalCache > 0 && health.cache.hits / totalCache < 0.7 ? ["Cache hit rate is below 70%."] : []),
  ] : [];
  return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Operations</p><h1 className="mt-1 text-2xl font-bold">External API health</h1><p className="mt-1 text-sm text-muted-foreground">Provider status, cache activity, and runtime memory. Updates: {realtime ? "live" : "polling fallback"}.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void exportPdf()} disabled={!health}>Export PDF</Button><Button variant="outline" onClick={exportHealth} disabled={!health}>Export JSON</Button><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div></header>
    {alerts.length > 0 && <section role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200"><h2 className="mb-1 font-semibold">Health thresholds exceeded</h2><ul className="list-inside list-disc">{alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul></section>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ key, label, detail }) => {
      const provider = health?.providers[key]; const good = provider?.status === "healthy";
      return <section key={key} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">{label}</h2><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>{good ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : provider ? <XCircle className="h-5 w-5 text-destructive" /> : <Activity className="h-5 w-5 text-muted-foreground" />}</div><p className="mt-5 text-lg font-bold">{provider ? good ? "Healthy" : "Degraded" : "Not called yet"}</p><p className="mt-1 text-xs text-muted-foreground">{provider ? `${provider.lastLatencyMs} ms · ${provider.calls} calls · ${provider.failures} failures` : "No checks in this runtime yet"}</p><p className="mt-2 text-[10px] text-muted-foreground">Last success: {provider?.lastSuccessAt ? new Date(provider.lastSuccessAt).toLocaleString() : "—"}</p></section>;
    })}</div>
    <div className="grid gap-3 md:grid-cols-3"><section className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-primary" />Cache</div><p className="mt-3 text-2xl font-bold">{health?.cache.entries ?? 0} <span className="text-sm font-normal text-muted-foreground">entries</span></p><p className="mt-1 text-xs text-muted-foreground">{health?.cache.hits ?? 0} hits · {health?.cache.misses ?? 0} misses{totalCache ? ` · ${Math.round((health!.cache.hits / totalCache) * 100)}% hit rate` : ""}</p></section><section className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-primary" />Runtime memory</div><p className="mt-3 text-2xl font-bold">{health ? `${(health.memory.heapUsed / 1024 / 1024).toFixed(0)} MB` : "—"}</p><p className="mt-1 text-xs text-muted-foreground">Heap used · RSS {health ? `${(health.memory.rss / 1024 / 1024).toFixed(0)} MB` : "—"}</p></section><section className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-primary" />Redis cache</div><p className="mt-3 text-lg font-bold capitalize">{health?.redisStatus.replaceAll("_", " ") ?? "Loading"}</p><p className="mt-1 text-xs text-muted-foreground">Cache is shared across instances when Redis is configured.</p></section></div>
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4"><Button variant="outline" disabled={busy} onClick={() => void action("invalidate-cache")}><RotateCcw className="mr-2 h-4 w-4" />Invalidate cache</Button><Button disabled={busy} onClick={() => void action("test-endpoints")}><Activity className="mr-2 h-4 w-4" />Test configured endpoints</Button>{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}<p className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />TRA and border sources are not configured.</p></section>
  </main>;
}
