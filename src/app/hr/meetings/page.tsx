"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { PageShell, PageHeader, StatCard, SectionCard, EmptyState, PageSkeleton } from "@/components/shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format, isAfter, isThisWeek } from "date-fns";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  created_by: string | null;
  created_at: string;
  attendee_count?: number;
  attendee_names?: string[];
}

const STATUS_META: Record<string, { label: string; chip: string }> = {
  scheduled: { label: "Scheduled", chip: "cv-chip-info" },
  completed: { label: "Completed", chip: "cv-chip-success" },
  cancelled: { label: "Cancelled", chip: "cv-chip-danger" },
};

function MeetingsPageInner() {
  const { user } = useSupabase();
  const { isAdmin, isLoading: roleLoading } = useRole();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [form, setForm] = useState({ title: "", date: "", time: "09:00" });
  const [attendees, setAttendees] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, a, s] = await Promise.all([
      supabase.from("meetings").select("*").order("scheduled_at", { ascending: false }).limit(300),
      supabase.from("meeting_attendees").select("meeting_id, user_id"),
      supabase.from("user_profiles").select("id, name").order("name"),
    ]);
    const nameById = new Map((s.data ?? []).map((u: any) => [u.id, u.name]));
    const byMeeting = new Map<string, string[]>();
    for (const row of a.data ?? []) {
      const list = byMeeting.get(row.meeting_id) ?? [];
      list.push(nameById.get(row.user_id) ?? "Unknown");
      byMeeting.set(row.meeting_id, list);
    }
    setMeetings(
      (m.data ?? []).map((row: any) => ({
        ...row,
        attendee_names: byMeeting.get(row.id) ?? [],
        attendee_count: (byMeeting.get(row.id) ?? []).length,
      })),
    );
    setStaff(s.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate();
      router.replace("/hr/meetings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", date: format(new Date(), "yyyy-MM-dd"), time: "09:00" });
    setAttendees([]);
    setDialogOpen(true);
  };

  const openEdit = (m: Meeting) => {
    setEditing(m);
    const d = new Date(m.scheduled_at);
    setForm({ title: m.title, date: format(d, "yyyy-MM-dd"), time: format(d, "HH:mm") });
    supabase
      .from("meeting_attendees")
      .select("user_id")
      .eq("meeting_id", m.id)
      .then(({ data }) => setAttendees((data ?? []).map((r: any) => r.user_id)));
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) {
      toast({ title: "Missing fields", description: "Title and date are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const when = new Date(`${form.date}T${form.time || "09:00"}`).toISOString();

      if (editing) {
        const { error } = await supabase
          .from("meetings")
          .update({ title: form.title.trim(), scheduled_at: when, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        await supabase.from("meeting_attendees").delete().eq("meeting_id", editing.id);
        if (attendees.length > 0) {
          await supabase.from("meeting_attendees").insert(
            attendees.map((uid) => ({ meeting_id: editing.id, user_id: uid, rsvp_status: "pending" })),
          );
        }
        toast({ title: "Meeting updated" });
      } else {
        const { data, error } = await supabase
          .from("meetings")
          .insert({ title: form.title.trim(), scheduled_at: when, status: "scheduled", created_by: user?.id ?? null })
          .select()
          .single();
        if (error) throw error;

        if (attendees.length > 0 && data?.id) {
          await supabase.from("meeting_attendees").insert(
            attendees.map((uid) => ({ meeting_id: data.id, user_id: uid, rsvp_status: "pending" })),
          );
          await supabase.from("notifications").insert(
            attendees.map((uid) => ({
              user_id: uid,
              type: "meeting_invite",
              title: "Meeting invitation",
              message: `You are invited to "${form.title.trim()}" on ${format(new Date(when), "MMM d, yyyy HH:mm")}`,
              is_read: false,
            })),
          );
        }
        toast({ title: "Meeting scheduled", description: `${attendees.length} invitation(s) sent` });
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (m: Meeting, status: string) => {
    const { error } = await supabase
      .from("meetings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", m.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (m: Meeting) => {
    if (!window.confirm(`Delete meeting "${m.title}"? This cannot be undone.`)) return;
    await supabase.from("meeting_attendees").delete().eq("meeting_id", m.id);
    const { error } = await supabase.from("meetings").delete().eq("id", m.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Meeting deleted" });
      load();
    }
  };

  const now = new Date();
  const upcoming = useMemo(
    () => meetings.filter((m) => isAfter(new Date(m.scheduled_at), now) && m.status !== "cancelled"),
    [meetings], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const past = useMemo(
    () => meetings.filter((m) => !isAfter(new Date(m.scheduled_at), now) || m.status === "cancelled"),
    [meetings], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const thisWeek = upcoming.filter((m) => isThisWeek(new Date(m.scheduled_at), { weekStartsOn: 1 })).length;
  const completed = meetings.filter((m) => m.status === "completed").length;
  const cancelled = meetings.filter((m) => m.status === "cancelled").length;
  const visible = tab === "upcoming" ? upcoming : past;

  if (roleLoading) return <PageShell><PageSkeleton kpiCount={4} /></PageShell>;
  if (!isAdmin) {
    return (
      <PageShell>
        <EmptyState icon={Ban} title="Access restricted" description="Only managers can view the meetings module." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Human Resources"
        title="Meetings"
        subtitle="Schedule staff meetings, invite attendees and track outcomes"
        icon={CalendarDays}
        crumbs={[{ label: "HR", href: "/hr" }, { label: "Meetings" }]}
        actions={
          <Button size="sm" onClick={openCreate} className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> New meeting
          </Button>
        }
      />

      {loading ? (
        <PageSkeleton kpiCount={4} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard label="Upcoming" value={upcoming.length} icon={CalendarDays} accent="bg-primary/10 text-primary" />
            <StatCard label="This week" value={thisWeek} icon={Clock} accent="bg-[hsl(var(--info-soft))] text-[hsl(var(--info))]" />
            <StatCard label="Completed" value={completed} icon={CheckCircle2} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" />
            <StatCard label="Cancelled" value={cancelled} icon={Ban} accent="bg-red-100 text-red-700" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(["upcoming", "past"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "px-4 h-9 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors",
                  tab === k
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40",
                )}
              >
                {k === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
              </button>
            ))}
          </div>

          <SectionCard title={tab === "upcoming" ? "Upcoming meetings" : "Past meetings"} padded={false}>
            {visible.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={tab === "upcoming" ? "No upcoming meetings" : "No past meetings"}
                description={tab === "upcoming" ? "Schedule your first meeting to get the team together." : "Completed and cancelled meetings will appear here."}
                action={
                  tab === "upcoming" ? (
                    <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                      <Plus className="w-4 h-4" /> New meeting
                    </Button>
                  ) : null
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((m) => {
                  const meta = STATUS_META[m.status] ?? { label: m.status, chip: "cv-chip-neutral" };
                  return (
                    <li key={m.id} className="px-5 py-4 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <button className="min-w-0 text-left flex-1" onClick={() => openEdit(m)}>
                          <p className="text-sm font-black text-foreground truncate hover:text-primary transition-colors">{m.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5" /> {format(new Date(m.scheduled_at), "EEE, MMM d yyyy · HH:mm")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" /> {m.attendee_count ?? 0} attendee{(m.attendee_count ?? 0) === 1 ? "" : "s"}
                            </span>
                            {(m.attendee_names ?? []).length > 0 && (
                              <span className="truncate max-w-[280px]">{(m.attendee_names ?? []).slice(0, 3).join(", ")}{(m.attendee_names ?? []).length > 3 ? "…" : ""}</span>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("cv-chip", meta.chip)}>{meta.label}</span>
                          {m.status === "scheduled" && (
                            <>
                              <button
                                onClick={() => setStatus(m, "completed")}
                                title="Mark completed"
                                className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:border-[hsl(var(--success))] hover:text-[hsl(var(--success))] flex items-center justify-center transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setStatus(m, "cancelled")}
                                title="Cancel meeting"
                                className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive flex items-center justify-center transition-colors"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => remove(m)}
                            title="Delete meeting"
                            className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <CalendarDays className="w-4 h-4" />
              </div>
              <DialogTitle>{editing ? "Edit meeting" : "Schedule meeting"}</DialogTitle>
            </div>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Monthly ops review" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Time</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Attendees ({attendees.length} selected)</Label>
              <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto p-3 border border-border rounded-xl bg-muted/30">
                {staff.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                    <input
                      type="checkbox"
                      checked={attendees.includes(s.id)}
                      onChange={(e) =>
                        setAttendees((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                      }
                      className="rounded"
                    />
                    <span className="truncate">{s.name ?? "Unnamed"}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editing ? "Save changes" : "Schedule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={<PageShell><PageSkeleton kpiCount={4} /></PageShell>}>
      <MeetingsPageInner />
    </Suspense>
  );
}
