"use client";

import { useEffect, useState } from "react";
import { PageShell, PageHeader, SectionCard, StatCard, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { format } from "date-fns";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";

const ALLOWED_ROLES = ["CEO", "ADMIN", "HR"];

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "outline" },
  submitted: { label: "Awaiting acknowledgement", variant: "secondary" },
  acknowledged: { label: "Acknowledged", variant: "default" },
};

interface PerformanceReview {
  id: string;
  employee_id: string;
  rating: number;
  review: string;
  goals: string | null;
  review_date: string;
  review_period_start: string | null;
  review_period_end: string | null;
  kpi_scores: Record<string, number> | null;
  status: string;
  employee_acknowledged_at: string | null;
  employee_comments: string | null;
  employee?: { name: string } | null;
}

interface StaffOption {
  id: string;
  name: string;
}

export default function PerformanceReviewsPage() {
  const { role, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const canView = !roleLoading && ALLOWED_ROLES.includes(String(role || "").toUpperCase());

  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [rating, setRating] = useState("3");
  const [reviewText, setReviewText] = useState("");
  const [reviewTextMissing, setReviewTextMissing] = useState(false);
  const [goals, setGoals] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [kpiRows, setKpiRows] = useState<{ label: string; score: string }[]>([{ label: "", score: "" }]);

  const [detail, setDetail] = useState<PerformanceReview | null>(null);

  const load = async () => {
    setLoading(true);
    const [reviewRes, staffRes] = await Promise.all([
      supabase
        .from("performance_reviews")
        .select("*, employee:user_profiles!employee_id(name)")
        .order("review_date", { ascending: false }),
      supabase.from("user_profiles").select("id, name").eq("status", "active").order("name"),
    ]);
    if (reviewRes.error) {
      toast({ title: "Couldn't load reviews", description: reviewRes.error.message, variant: "destructive" });
    } else {
      setReviews((reviewRes.data as unknown as PerformanceReview[]) ?? []);
    }
    setStaff((staffRes.data as StaffOption[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const updateKpiRow = (i: number, field: "label" | "score", value: string) => {
    setKpiRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const createReview = async () => {
    if (!employeeId) {
      toast({ title: "Pick an employee", variant: "destructive" });
      return;
    }
    if (!reviewText.trim()) {
      setReviewTextMissing(true);
      toast({ title: "Write a review summary", description: "The Review field below is required before this can be saved.", variant: "destructive" });
      return;
    }
    setReviewTextMissing(false);
    setSaving(true);
    const kpi_scores: Record<string, number> = {};
    for (const row of kpiRows) {
      if (row.label.trim() && row.score !== "") kpi_scores[row.label.trim()] = Number(row.score);
    }
    const { error } = await supabase.from("performance_reviews").insert({
      employee_id: employeeId,
      rating: Number(rating),
      review: reviewText.trim(),
      goals: goals.trim() || null,
      review_date: format(new Date(), "yyyy-MM-dd"),
      review_period_start: periodStart || null,
      review_period_end: periodEnd || null,
      kpi_scores,
      status: "draft",
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't create review", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Review saved as draft" });
    setCreateOpen(false);
    setEmployeeId("");
    setReviewText("");
    setReviewTextMissing(false);
    setGoals("");
    setPeriodStart("");
    setPeriodEnd("");
    setRating("3");
    setKpiRows([{ label: "", score: "" }]);
    load();
  };

  const refreshDetail = (updated: any) => {
    setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
    load();
  };

  if (roleLoading) return null;
  if (!canView) {
    return (
      <PageShell>
        <EmptyState icon={Star} title="Access denied" description="You don't have permission to view performance reviews." />
      </PageShell>
    );
  }

  const draftCount = reviews.filter((r) => r.status === "draft").length;
  const awaitingCount = reviews.filter((r) => r.status === "submitted").length;
  const avgRating =
    reviews.length > 0 ? (reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : "—";

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Human Resources"
        title="Performance reviews"
        subtitle="KPI reviews with a real draft → submitted → acknowledged lifecycle"
        icon={Star}
        crumbs={[{ label: "HR", href: "/hr" }, { label: "Performance Reviews" }]}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> New review
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total reviews" value={reviews.length} icon={Star} accent="bg-primary/10 text-primary" />
        <StatCard label="Drafts" value={draftCount} icon={Star} accent="bg-muted text-muted-foreground" />
        <StatCard label="Awaiting employee" value={awaitingCount} icon={Star} accent="bg-warning/10 text-warning" />
        <StatCard label="Avg rating" value={avgRating} icon={Star} accent="bg-success/10 text-success" />
      </div>

      <SectionCard title="All reviews">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : reviews.length === 0 ? (
          <EmptyState icon={Star} title="No reviews yet" description="Create one above." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Review date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((r) => {
                  const statusMeta = STATUS_BADGE[r.status] ?? { label: r.status, variant: "outline" as const };
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetail(r)}>
                      <TableCell className="font-medium">{r.employee?.name || r.employee_id}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.review_period_start && r.review_period_end ? `${r.review_period_start} → ${r.review_period_end}` : "—"}
                      </TableCell>
                      <TableCell>{r.rating}/5</TableCell>
                      <TableCell className="text-muted-foreground">{r.review_date}</TableCell>
                      <TableCell><Badge variant={statusMeta.variant}>{statusMeta.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Star className="w-4 h-4" />
              </div>
              <DialogTitle>New performance review</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Employee *</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Period start</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Period end</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Overall rating (1–5) *</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">KPI scores</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setKpiRows((p) => [...p, { label: "", score: "" }])}>
                  <Plus className="w-3 h-3 mr-1" /> Add metric
                </Button>
              </div>
              {kpiRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="e.g. Punctuality" value={row.label} onChange={(e) => updateKpiRow(i, "label", e.target.value)} className="flex-1" />
                  <Input placeholder="Score" type="number" value={row.score} onChange={(e) => updateKpiRow(i, "score", e.target.value)} className="w-24" />
                  <Button type="button" size="icon" variant="ghost" onClick={() => setKpiRows((p) => p.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Freeform — define whatever metrics fit this employee's role. No fixed scale is assumed.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Review *</Label>
              <Textarea
                value={reviewText}
                onChange={(e) => {
                  setReviewText(e.target.value);
                  if (e.target.value.trim()) setReviewTextMissing(false);
                }}
                rows={4}
                placeholder="Summary of performance for this period"
                className={reviewTextMissing ? "border-destructive focus-visible:ring-destructive" : undefined}
              />
              {reviewTextMissing && <p className="text-xs text-destructive">Required before this review can be saved.</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Goals for next period</Label>
              <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={createReview} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Save as draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Star className="w-4 h-4" />
                  </div>
                  <DialogTitle className="flex items-center gap-2">
                    {detail.employee?.name || detail.employee_id}
                    <Badge variant={(STATUS_BADGE[detail.status] ?? { variant: "outline" as const }).variant}>
                      {(STATUS_BADGE[detail.status] ?? { label: detail.status }).label}
                    </Badge>
                  </DialogTitle>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Rating</Label>
                    <p className="font-medium">{detail.rating}/5</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Period</Label>
                    <p>{detail.review_period_start && detail.review_period_end ? `${detail.review_period_start} → ${detail.review_period_end}` : "—"}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Review</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{detail.review}</p>
                </div>
                {detail.goals && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Goals</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{detail.goals}</p>
                  </div>
                )}
                {detail.kpi_scores && Object.keys(detail.kpi_scores).length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">KPI scores</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {Object.entries(detail.kpi_scores).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm rounded-lg border border-border px-2.5 py-1.5">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-semibold">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detail.employee_comments && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <Label className="text-xs text-muted-foreground">Employee's comments</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{detail.employee_comments}</p>
                    {detail.employee_acknowledged_at && (
                      <p className="text-xs text-muted-foreground mt-1">Acknowledged {format(new Date(detail.employee_acknowledged_at), "MMM d, yyyy")}</p>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-border">
                  <TransitionButtons
                    kind="performance_review"
                    entity={detail}
                    actorId={user?.id ?? ""}
                    actorRole={role as any}
                    size="sm"
                    exclude={["acknowledged"]}
                    onDone={refreshDetail}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
