"use client";

import { useEffect, useState } from "react";
import { PageShell, PageHeader, SectionCard, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { applyTransition } from "@/lib/workflow/engine";
import { useRole } from "@/hooks/use-role";
import { format } from "date-fns";
import { Gavel, LogOut, Loader2, Star, User } from "lucide-react";

const formatTZS = (v: number) => `TZS ${Math.round(v).toLocaleString("en-TZ")}`;

interface Review {
  id: string;
  rating: number;
  review: string;
  goals: string | null;
  review_period_start: string | null;
  review_period_end: string | null;
  kpi_scores: Record<string, number> | null;
  status: string;
  employee_comments: string | null;
  employee_acknowledged_at: string | null;
}

interface DisciplinaryCase {
  id: string;
  case_number: string;
  category: string;
  status: string;
  incident_date: string;
  hearing_date: string | null;
  outcome: string | null;
}

interface SeparationCase {
  id: string;
  case_number: string;
  separation_type: string;
  status: string;
  last_working_day: string;
  final_pay_breakdown: { net_pay: number } | null;
}

export default function MyHrRecordsPage() {
  const { user } = useSupabase();
  const { role } = useRole();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cases, setCases] = useState<DisciplinaryCase[]>([]);
  const [separation, setSeparation] = useState<SeparationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [reviewRes, caseRes, sepRes] = await Promise.all([
      supabase.from("performance_reviews").select("*").eq("employee_id", user.id).order("review_date", { ascending: false }),
      supabase.from("disciplinary_cases").select("*").eq("employee_id", user.id).order("created_at", { ascending: false }),
      supabase.from("separation_cases").select("*").eq("employee_id", user.id).order("created_at", { ascending: false }),
    ]);
    setReviews((reviewRes.data as unknown as Review[]) ?? []);
    setCases((caseRes.data as unknown as DisciplinaryCase[]) ?? []);
    setSeparation((sepRes.data as unknown as SeparationCase[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const acknowledge = async (reviewId: string) => {
    if (!user?.id) return;
    setBusyId(reviewId);
    const result = await applyTransition({
      kind: "performance_review",
      entityId: reviewId,
      toState: "acknowledged",
      actorId: user.id,
      actorRole: (role as any) ?? undefined,
      payload: { comments: comments[reviewId] || undefined },
    });
    setBusyId(null);
    if (!result.ok) {
      toast({ title: "Couldn't acknowledge", description: result.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Review acknowledged" });
    load();
  };

  if (loading) {
    return (
      <PageShell>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </PageShell>
    );
  }

  const hasNothing = reviews.length === 0 && cases.length === 0 && separation.length === 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Human Resources"
        title="My HR records"
        subtitle="Performance reviews, disciplinary cases and separation status that concern you"
        icon={User}
      />

      {hasNothing ? (
        <EmptyState icon={User} title="Nothing on file" description="Performance reviews or HR cases involving you will appear here." />
      ) : (
        <div className="space-y-6">
          {reviews.length > 0 && (
            <SectionCard title="Performance reviews" padded={false}>
              <div className="divide-y divide-border">
                {reviews.map((r) => (
                  <div key={r.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-warning" />
                        <span className="font-semibold text-sm">
                          {r.review_period_start && r.review_period_end ? `${r.review_period_start} → ${r.review_period_end}` : "Review"}
                        </span>
                        <Badge variant={r.status === "acknowledged" ? "default" : "secondary"}>
                          {r.status === "acknowledged" ? "Acknowledged" : "Awaiting your acknowledgement"}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">Rating: {r.rating}/5</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{r.review}</p>
                    {r.goals && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Goals: </span>{r.goals}</p>}
                    {r.kpi_scores && Object.keys(r.kpi_scores).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(r.kpi_scores).map(([k, v]) => (
                          <span key={k} className="text-xs rounded-full border border-border px-2.5 py-1">{k}: <strong>{v}</strong></span>
                        ))}
                      </div>
                    )}
                    {r.status === "submitted" && (
                      <div className="space-y-2 pt-1">
                        <Textarea
                          placeholder="Optional comments before you acknowledge…"
                          value={comments[r.id] || ""}
                          onChange={(e) => setComments((p) => ({ ...p, [r.id]: e.target.value }))}
                          rows={2}
                        />
                        <Button size="sm" onClick={() => acknowledge(r.id)} disabled={busyId === r.id}>
                          {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                          Acknowledge
                        </Button>
                      </div>
                    )}
                    {r.status === "acknowledged" && r.employee_comments && (
                      <p className="text-xs text-muted-foreground italic">Your comment: "{r.employee_comments}"</p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {cases.length > 0 && (
            <SectionCard title="Disciplinary cases" padded={false}>
              <div className="divide-y divide-border">
                {cases.map((c) => (
                  <div key={c.id} className="px-5 py-4 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Gavel className="w-4 h-4 text-destructive" />
                      <div>
                        <p className="font-semibold text-sm">{c.case_number} — {c.category.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          Incident {c.incident_date}
                          {c.hearing_date ? ` · Hearing ${c.hearing_date}` : ""}
                          {c.outcome ? ` · Outcome: ${c.outcome.replace(/_/g, " ")}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">{c.status.replace(/_/g, " ")}</Badge>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {separation.length > 0 && (
            <SectionCard title="Separation" padded={false}>
              <div className="divide-y divide-border">
                {separation.map((s) => (
                  <div key={s.id} className="px-5 py-4 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-sm">{s.case_number} — {s.separation_type.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          Last working day {s.last_working_day}
                          {s.final_pay_breakdown ? ` · Final pay: ${formatTZS(s.final_pay_breakdown.net_pay)}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">{s.status.replace(/_/g, " ")}</Badge>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </PageShell>
  );
}
