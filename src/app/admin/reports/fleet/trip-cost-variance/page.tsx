"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/components/ui/currency-badge";
import { ArrowLeft, RefreshCw, TrendingUp, AlertTriangle, ShieldCheck, Globe2 } from "lucide-react";
import { loadRateMap, convertSync } from "@/lib/finance/fx";
import { REPORTING_CURRENCY } from "@/lib/finance/multi-currency";

interface VarianceRow {
  tripId: string;
  tripNumber: string;
  origin: string;
  destination: string;
  status: string;
  expenseCount: number;
  currency: string;
  mixedCurrencies: boolean;
  requested: number;
  committed: number;
  actual: number;
  variance: number;
  variancePct: number | null;
  band: "ok" | "warning" | "critical" | null;
}

interface Summary {
  tripsWithExpenses: number;
  byCurrency: Record<string, { requested: number; committed: number; actual: number }>;
  currencies: string[];
  criticalCount: number;
  warningCount: number;
}

const BAND_META: Record<string, { label: string; chip: string }> = {
  ok: { label: "On budget", chip: "bg-success/10 text-success" },
  warning: { label: "Warning", chip: "bg-warning/10 text-warning" },
  critical: { label: "Critical", chip: "bg-destructive/10 text-destructive" },
};

export default function TripCostVariancePage() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<VarianceRow[]>([]);
  const [thresholds, setThresholds] = useState<{ warning: number; critical: number } | null>(null);
  const [rateMap, setRateMap] = useState<Record<string, number>>({});
  const [rateMapMissing, setRateMapMissing] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/reports/trip-cost-variance", {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const result = await res.json();
      if (result.success) {
        setSummary(result.summary);
        setRows(result.data);
        setThresholds(result.thresholds);
      } else {
        setError(result.error || "Failed to load report data.");
      }
    } catch (err: any) {
      setError("A network or server error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!summary || summary.currencies.length <= 1) return;
    loadRateMap(summary.currencies, REPORTING_CURRENCY).then((map) => {
      setRateMap(map);
      setRateMapMissing(summary.currencies.filter((c) => c !== REPORTING_CURRENCY && map[`${c}->${REPORTING_CURRENCY}`] == null));
    });
  }, [summary]);

  // Company-wide total across currencies — an explicit, rate-shown
  // conversion for a "full picture" figure, never a silent blended sum.
  const consolidated = summary && summary.currencies.length > 1
    ? summary.currencies.reduce(
        (acc, cur) => {
          const b = summary.byCurrency[cur];
          const requested = convertSync(b.requested, cur, REPORTING_CURRENCY, rateMap);
          const committed = convertSync(b.committed, cur, REPORTING_CURRENCY, rateMap);
          const actual = convertSync(b.actual, cur, REPORTING_CURRENCY, rateMap);
          if (requested == null || committed == null || actual == null) return acc;
          return { requested: acc.requested + requested, committed: acc.committed + committed, actual: acc.actual + actual };
        },
        { requested: 0, committed: 0, actual: 0 },
      )
    : null;

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
                <ArrowLeft className="size-4" /> Back to Reports
              </Link>
              <h1 className="text-3xl font-bold">Trip Cost Variance</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Requested vs. approved vs. actually paid, per trip{thresholds ? ` — flagged at ±${thresholds.warning}% (warning) / ±${thresholds.critical}% (critical) vs. what was committed` : ""}.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 text-sm">{error}</div>
          )}

          {summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Trips w/ expenses</p>
                  <p className="text-2xl font-bold">{summary.tripsWithExpenses}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-destructive" />
                    <p className="text-xs text-muted-foreground">Critical / Warning</p>
                  </div>
                  <p className="text-xl font-bold">{summary.criticalCount} / {summary.warningCount}</p>
                </CardContent></Card>
              </div>
              {consolidated && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe2 className="size-4 text-primary" />
                      <p className="text-xs font-bold text-foreground">
                        Company-wide total ({REPORTING_CURRENCY} equivalent)
                      </p>
                    </div>
                    {rateMapMissing.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Missing an exchange rate for {rateMapMissing.join(", ")} —{" "}
                        <Link href="/finance/accounting/fx-rates" className="text-primary hover:underline">record one</Link> to include it here.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Requested</p>
                          <p className="text-lg font-bold">{formatCurrency(consolidated.requested, REPORTING_CURRENCY)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Committed</p>
                          <p className="text-lg font-bold">{formatCurrency(consolidated.committed, REPORTING_CURRENCY)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Actual</p>
                          <p className="text-lg font-bold">{formatCurrency(consolidated.actual, REPORTING_CURRENCY)}</p>
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Converted using today's rate on file — a translation for comparison, not a repost. Native-currency figures below remain the source of truth.
                    </p>
                  </CardContent>
                </Card>
              )}
              {/* One requested/committed/actual set per currency — never
                  summed together, same "Mixed currencies" convention as the
                  rest of Finance. */}
              {summary.currencies.map((cur) => (
                <div key={cur} className="grid grid-cols-3 gap-4">
                  <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Requested ({cur})</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.byCurrency[cur].requested, cur)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Committed ({cur})</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.byCurrency[cur].committed, cur)}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Actual ({cur})</p>
                    <p className="text-xl font-bold">{formatCurrency(summary.byCurrency[cur].actual, cur)}</p>
                  </CardContent></Card>
                </div>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="size-5 text-primary" />
                Per-trip breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Trip</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Route</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Requested</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Committed</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actual</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Variance</th>
                    <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No trips with linked expenses in this period.
                    </td></tr>
                  )}
                  {rows.map((r) => {
                    const meta = r.band ? BAND_META[r.band] : null;
                    return (
                      <tr key={r.tripId} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">{r.tripNumber || r.tripId.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {r.origin} → {r.destination}
                          {r.mixedCurrencies && (
                            <span className="ml-1.5 text-[10px] font-bold text-warning" title="This trip's expenses span more than one currency — totals below are only the dominant one.">
                              mixed currencies
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.requested, r.currency)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.committed, r.currency)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.actual, r.currency)}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${r.variance > 0 ? "text-destructive" : r.variance < 0 ? "text-success" : ""}`}>
                          {r.variancePct === null ? "—" : `${r.variance > 0 ? "+" : ""}${r.variancePct}%`}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {meta ? (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.chip}`}>
                              {r.band === "ok" && <ShieldCheck className="inline size-3 mr-1" />}
                              {meta.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not yet committed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
