"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell, PageHeader, SectionCard, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { CalendarDays, Loader2, Send } from "lucide-react";

const HR_ROLES = ["CEO", "ADMIN", "HR"];

const LEAVE_TYPES = [
  { value: "annual", label: "Annual leave", paidByDefault: true },
  { value: "sick", label: "Sick leave", paidByDefault: true },
  { value: "maternity_paternity", label: "Maternity / Paternity", paidByDefault: true },
  { value: "compassionate", label: "Compassionate leave", paidByDefault: true },
  { value: "unpaid", label: "Unpaid leave", paidByDefault: false },
  { value: "other", label: "Other", paidByDefault: true },
];

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

interface LeaveRow {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  is_paid: boolean;
  status: "pending" | "approved" | "rejected";
  rejected_reason: string | null;
  created_at: string;
  employee?: { name: string } | null;
}

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return Math.max(0, diff);
}

export default function LeavePage() {
  const { role, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const isHr = HR_ROLES.includes(String(role || "").toUpperCase());

  const [myRequests, setMyRequests] = useState<LeaveRow[]>([]);
  const [teamRequests, setTeamRequests] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [leaveType, setLeaveType] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isPaid, setIsPaid] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const mine = await supabase
      .from("leave_requests")
      .select("id, employee_id, leave_type, start_date, end_date, reason, is_paid, status, rejected_reason, created_at")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false });
    setMyRequests(mine.data ?? []);

    if (isHr) {
      const team = await supabase
        .from("leave_requests")
        .select("id, employee_id, leave_type, start_date, end_date, reason, is_paid, status, rejected_reason, created_at, employee:user_profiles(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      setTeamRequests((team.data as unknown as LeaveRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!roleLoading && user?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, user?.id, isHr]);

  const requestedDays = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);

  const submit = async () => {
    if (!user?.id) return;
    if (!startDate || !endDate) {
      toast({ title: "Missing dates", description: "Pick a start and end date.", variant: "destructive" });
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast({ title: "Invalid range", description: "End date is before the start date.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("leave_requests").insert({
      employee_id: user.id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason || null,
      is_paid: isPaid,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't submit request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Leave request submitted", description: `${requestedDays} day(s), awaiting approval.` });
    setStartDate("");
    setEndDate("");
    setReason("");
    load();
  };

  if (roleLoading) return null;

  const pendingTeamCount = teamRequests.filter((r) => r.status === "pending").length;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="HR"
        title="Leave"
        subtitle="Request time off, or review and approve requests from your team."
        icon={CalendarDays}
      />

      <SectionCard title="Request leave" subtitle="Unpaid leave reduces taxable pay for the days it covers in the next payroll run.">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs mb-1.5 block">Type</Label>
            <Select
              value={leaveType}
              onValueChange={(v) => {
                setLeaveType(v);
                const def = LEAVE_TYPES.find((t) => t.value === v);
                if (def) setIsPaid(def.paidByDefault);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Checkbox id="is_paid" checked={isPaid} onCheckedChange={(v) => setIsPaid(v === true)} />
            <Label htmlFor="is_paid" className="text-xs font-normal">Paid leave</Label>
          </div>
        </div>
        <div className="mt-4">
          <Label className="text-xs mb-1.5 block">Reason (optional)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {requestedDays > 0 ? `${requestedDays} day(s) requested` : "Pick both dates"}
          </p>
          <Button onClick={submit} disabled={submitting || !startDate || !endDate}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Submit request
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="My requests" className="mt-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : myRequests.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No leave requests yet" description="Submit one above." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myRequests.map((r) => {
                const badge = STATUS_BADGE[r.status] ?? { label: r.status, variant: "outline" as const };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="capitalize">{r.leave_type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-muted-foreground">{r.start_date} → {r.end_date}</TableCell>
                    <TableCell>{daysBetween(r.start_date, r.end_date)}</TableCell>
                    <TableCell>{r.is_paid ? "Paid" : "Unpaid"}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {r.status === "rejected" && r.rejected_reason && (
                        <p className="text-xs text-muted-foreground mt-1">{r.rejected_reason}</p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {isHr && (
        <SectionCard
          title="Team requests"
          subtitle={pendingTeamCount > 0 ? `${pendingTeamCount} awaiting a decision` : undefined}
          className="mt-6"
        >
          {teamRequests.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No leave requests from the team" description="Nothing to review yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamRequests.map((r) => {
                  const badge = STATUS_BADGE[r.status] ?? { label: r.status, variant: "outline" as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.employee?.name || r.employee_id}</TableCell>
                      <TableCell className="capitalize">{r.leave_type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-muted-foreground">{r.start_date} → {r.end_date}</TableCell>
                      <TableCell>{daysBetween(r.start_date, r.end_date)}</TableCell>
                      <TableCell>{r.is_paid ? "Paid" : "Unpaid"}</TableCell>
                      <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" ? (
                          <TransitionButtons
                            kind="leave_request"
                            entity={r}
                            actorId={user?.id ?? "system"}
                            actorRole={role ?? undefined}
                            onDone={load}
                            size="sm"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      )}
    </PageShell>
  );
}
