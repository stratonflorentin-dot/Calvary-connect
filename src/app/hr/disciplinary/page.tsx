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
import { applyTransition } from "@/lib/workflow/engine";
import { format } from "date-fns";
import { Gavel, Loader2, Plus, ShieldAlert } from "lucide-react";

const ALLOWED_ROLES = ["CEO", "ADMIN", "HR"];

const CATEGORY_LABEL: Record<string, string> = {
  attendance: "Attendance",
  conduct: "Conduct",
  safety: "Safety",
  policy_violation: "Policy Violation",
  performance: "Performance",
  other: "Other",
};

const SEVERITY_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  minor: "secondary",
  moderate: "outline",
  major: "default",
  gross_misconduct: "destructive",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  reported: { label: "Reported", variant: "outline" },
  investigating: { label: "Investigating", variant: "secondary" },
  hearing: { label: "Hearing Scheduled", variant: "default" },
  resolved: { label: "Resolved", variant: "default" },
  withdrawn: { label: "Withdrawn", variant: "outline" },
};

const OUTCOME_LABEL: Record<string, string> = {
  verbal_warning: "Verbal Warning",
  written_warning: "Written Warning",
  final_warning: "Final Warning",
  suspension: "Suspension",
  termination: "Termination",
  no_action: "No Action",
};

interface DisciplinaryCase {
  id: string;
  case_number: string;
  employee_id: string;
  category: string;
  description: string;
  incident_date: string;
  severity: string;
  status: string;
  hearing_date: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  suspension_days: number | null;
  created_at: string;
  employee?: { name: string } | null;
  reporter?: { name: string } | null;
}

interface StaffOption {
  id: string;
  name: string;
}

export default function DisciplinaryCasesPage() {
  const { role, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const canView = !roleLoading && ALLOWED_ROLES.includes(String(role || "").toUpperCase());

  const [cases, setCases] = useState<DisciplinaryCase[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [category, setCategory] = useState("conduct");
  const [severity, setSeverity] = useState("minor");
  const [incidentDate, setIncidentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");

  const [detail, setDetail] = useState<DisciplinaryCase | null>(null);
  const [hearingModalOpen, setHearingModalOpen] = useState(false);
  const [hearingDate, setHearingDate] = useState("");
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [outcome, setOutcome] = useState("verbal_warning");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [suspensionDays, setSuspensionDays] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [caseRes, staffRes] = await Promise.all([
      supabase
        .from("disciplinary_cases")
        .select("*, employee:user_profiles!employee_id(name), reporter:user_profiles!reported_by(name)")
        .order("created_at", { ascending: false }),
      supabase.from("user_profiles").select("id, name").eq("status", "active").order("name"),
    ]);
    if (caseRes.error) {
      toast({ title: "Couldn't load cases", description: caseRes.error.message, variant: "destructive" });
    } else {
      setCases((caseRes.data as unknown as DisciplinaryCase[]) ?? []);
    }
    setStaff((staffRes.data as StaffOption[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const createCase = async () => {
    if (!employeeId) {
      toast({ title: "Pick an employee", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Describe the incident", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: caseNumber, error: numErr } = await supabase.rpc("next_doc_number", { p_type: "disciplinary_case" });
    if (numErr) {
      setSaving(false);
      toast({ title: "Couldn't generate case number", description: numErr.message, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("disciplinary_cases").insert({
      case_number: caseNumber,
      employee_id: employeeId,
      category,
      severity,
      incident_date: incidentDate,
      description: description.trim(),
      reported_by: user?.id ?? null,
      created_by: user?.id ?? null,
      status: "reported",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't create case", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Case reported", description: `${caseNumber} created.` });
    setCreateOpen(false);
    setEmployeeId("");
    setDescription("");
    setSeverity("minor");
    setCategory("conduct");
    load();
  };

  const refreshDetail = (updated: any) => {
    setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
    load();
  };

  const submitHearing = async () => {
    if (!detail || !hearingDate) return;
    setActionBusy(true);
    const result = await applyTransition({
      kind: "disciplinary_case",
      entityId: detail.id,
      toState: "hearing",
      actorId: user?.id ?? "",
      actorRole: (role as any) ?? undefined,
      payload: { hearing_date: hearingDate },
    });
    setActionBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't schedule hearing", description: result.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Hearing scheduled" });
    setHearingModalOpen(false);
    setHearingDate("");
    refreshDetail(result.entity);
  };

  const submitOutcome = async () => {
    if (!detail) return;
    setActionBusy(true);
    const result = await applyTransition({
      kind: "disciplinary_case",
      entityId: detail.id,
      toState: "resolved",
      actorId: user?.id ?? "",
      actorRole: (role as any) ?? undefined,
      payload: {
        outcome,
        outcome_notes: outcomeNotes || undefined,
        suspension_days: outcome === "suspension" && suspensionDays ? Number(suspensionDays) : undefined,
      },
    });
    setActionBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't record outcome", description: result.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Outcome recorded" });
    setOutcomeModalOpen(false);
    setOutcomeNotes("");
    setSuspensionDays("");
    refreshDetail(result.entity);
  };

  if (roleLoading) return null;
  if (!canView) {
    return (
      <PageShell>
        <EmptyState icon={ShieldAlert} title="Access denied" description="You don't have permission to view disciplinary cases." />
      </PageShell>
    );
  }

  const openCount = cases.filter((c) => !["resolved", "withdrawn"].includes(c.status)).length;
  const resolvedCount = cases.filter((c) => c.status === "resolved").length;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Human Resources"
        title="Disciplinary cases"
        subtitle="Track misconduct reports from investigation through to outcome"
        icon={Gavel}
        crumbs={[{ label: "HR", href: "/hr" }, { label: "Disciplinary Cases" }]}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> Report case
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total cases" value={cases.length} icon={Gavel} accent="bg-primary/10 text-primary" />
        <StatCard label="Open" value={openCount} icon={ShieldAlert} accent="bg-warning/10 text-warning" />
        <StatCard label="Resolved" value={resolvedCount} icon={Gavel} accent="bg-success/10 text-success" />
      </div>

      <SectionCard title="All cases">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : cases.length === 0 ? (
          <EmptyState icon={Gavel} title="No cases reported" description="Report one above." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case #</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Incident date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => {
                  const statusMeta = STATUS_BADGE[c.status] ?? { label: c.status, variant: "outline" as const };
                  return (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetail(c)}>
                      <TableCell className="font-mono text-xs font-semibold">{c.case_number}</TableCell>
                      <TableCell className="font-medium">{c.employee?.name || c.employee_id}</TableCell>
                      <TableCell>{CATEGORY_LABEL[c.category] ?? c.category}</TableCell>
                      <TableCell>
                        <Badge variant={SEVERITY_BADGE[c.severity] ?? "outline"}>{c.severity.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.incident_date}</TableCell>
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
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Gavel className="w-4 h-4" />
              </div>
              <DialogTitle>Report disciplinary case</DialogTitle>
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
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="gross_misconduct">Gross Misconduct</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Incident date *</Label>
              <Input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description *</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What happened, when, and who was involved" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={createCase} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Report case
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
                    <Gavel className="w-4 h-4" />
                  </div>
                  <DialogTitle className="flex items-center gap-2">
                    {detail.case_number}
                    <Badge variant={(STATUS_BADGE[detail.status] ?? { variant: "outline" as const }).variant}>
                      {(STATUS_BADGE[detail.status] ?? { label: detail.status }).label}
                    </Badge>
                  </DialogTitle>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Employee</Label>
                    <p className="font-medium">{detail.employee?.name || detail.employee_id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Reported by</Label>
                    <p className="font-medium">{detail.reporter?.name || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <p>{CATEGORY_LABEL[detail.category] ?? detail.category}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Severity</Label>
                    <p className="capitalize">{detail.severity.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Incident date</Label>
                    <p>{detail.incident_date}</p>
                  </div>
                  {detail.hearing_date && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Hearing date</Label>
                      <p>{detail.hearing_date}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{detail.description}</p>
                </div>
                {detail.outcome && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <Label className="text-xs text-muted-foreground">Outcome</Label>
                    <p className="text-sm font-semibold mt-0.5">
                      {OUTCOME_LABEL[detail.outcome] ?? detail.outcome}
                      {detail.suspension_days ? ` — ${detail.suspension_days} day(s)` : ""}
                    </p>
                    {detail.outcome_notes && <p className="text-sm text-muted-foreground mt-1">{detail.outcome_notes}</p>}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {detail.status === "investigating" && (
                    <>
                      <Button size="sm" onClick={() => setHearingModalOpen(true)}>Schedule Hearing</Button>
                      <Button size="sm" variant="outline" onClick={() => setOutcomeModalOpen(true)}>Resolve (No Hearing)</Button>
                    </>
                  )}
                  {detail.status === "hearing" && (
                    <Button size="sm" onClick={() => setOutcomeModalOpen(true)}>Record Outcome</Button>
                  )}
                  <TransitionButtons
                    kind="disciplinary_case"
                    entity={detail}
                    actorId={user?.id ?? ""}
                    actorRole={role as any}
                    size="sm"
                    exclude={["hearing", "resolved"]}
                    onDone={refreshDetail}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule hearing modal */}
      <Dialog open={hearingModalOpen} onOpenChange={setHearingModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Schedule hearing</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Hearing date *</Label>
              <Input type="date" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setHearingModalOpen(false)} disabled={actionBusy}>Cancel</Button>
              <Button onClick={submitHearing} disabled={actionBusy || !hearingDate}>
                {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record outcome modal */}
      <Dialog open={outcomeModalOpen} onOpenChange={setOutcomeModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Record outcome</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Outcome *</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTCOME_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {outcome === "suspension" && (
              <div className="space-y-1">
                <Label className="text-xs">Suspension days</Label>
                <Input type="number" min={1} value={suspensionDays} onChange={(e) => setSuspensionDays(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} rows={3} />
            </div>
            {outcome === "termination" && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                Recording termination here doesn't separate the employee automatically — start a separation case from the HR module once this is saved.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOutcomeModalOpen(false)} disabled={actionBusy}>Cancel</Button>
              <Button onClick={submitOutcome} disabled={actionBusy}>
                {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save outcome"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
