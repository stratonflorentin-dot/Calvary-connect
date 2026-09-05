"use client";

import { useEffect, useMemo, useState } from "react";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryCard, IndustryCardKicker } from "@/components/industry/card";
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from "@/components/industry/table";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";
import { Loader2, Send } from "lucide-react";

const HR_PAGES = [
  { label: "People", href: "/users" },
  { label: "Payroll & allowances", href: "/allowances" },
  { label: "Leave", href: "/hr/leave" },
  { label: "Driver compliance", href: "/admin/hr/driver-compliance" },
];

const HR_ROLES = ["CEO", "ADMIN", "HR"];

const LEAVE_TYPES = [
  { value: "annual", label: "Annual leave", paidByDefault: true },
  { value: "sick", label: "Sick leave", paidByDefault: true },
  { value: "maternity_paternity", label: "Maternity / Paternity", paidByDefault: true },
  { value: "compassionate", label: "Compassionate leave", paidByDefault: true },
  { value: "unpaid", label: "Unpaid leave", paidByDefault: false },
  { value: "other", label: "Other", paidByDefault: true },
];

const STATUS_VARIANT: Record<string, "accent" | "warning" | "danger"> = {
  pending: "warning",
  approved: "accent",
  rejected: "danger",
};

const fieldClass = "w-full text-[14px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[7px] outline-none focus-visible:border-[var(--ci-accent)]";

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
    <IndustryRoleShell roleLabel="HR" pages={HR_PAGES}>
      <IndustryCard>
        <IndustryCardKicker>Request leave</IndustryCardKicker>
        <p className="text-[12px] text-[var(--ci-text-tertiary)] -mt-1">
          Unpaid leave reduces taxable pay for the days it covers in the next payroll run.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
          <div>
            <label className="ci-lbl block mb-1">Type</label>
            <select
              value={leaveType}
              onChange={(e) => {
                setLeaveType(e.target.value);
                const def = LEAVE_TYPES.find((t) => t.value === e.target.value);
                if (def) setIsPaid(def.paidByDefault);
              }}
              className={fieldClass}
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="ci-lbl block mb-1">Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className="ci-lbl block mb-1">End date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldClass} />
          </div>
          <div className="flex items-end gap-2 pb-[7px]">
            <input
              id="is_paid"
              type="checkbox"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
              className="size-4 accent-[var(--ci-accent)]"
            />
            <label htmlFor="is_paid" className="text-[12px] text-[var(--ci-text-secondary)]">Paid leave</label>
          </div>
        </div>
        <div>
          <label className="ci-lbl block mb-1">Reason (optional)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={fieldClass} />
        </div>
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-[var(--ci-divider)]">
          <p className="text-[11px] text-[var(--ci-text-tertiary)] ci-mono">
            {requestedDays > 0 ? `${requestedDays} day(s) requested` : "Pick both dates"}
          </p>
          <IndustryButton variant="primary" onClick={submit} disabled={submitting || !startDate || !endDate} className="gap-1.5">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Submit request
          </IndustryButton>
        </div>
      </IndustryCard>

      <div className="mt-4">
        <IndustryCardKicker>My requests</IndustryCardKicker>
        <IndustryCard className="mt-2">
          <IndustryTable>
            <thead>
              <tr>
                <IndustryTh>Type</IndustryTh>
                <IndustryTh>Dates</IndustryTh>
                <IndustryTh align="right">Days</IndustryTh>
                <IndustryTh>Paid</IndustryTh>
                <IndustryTh>Status</IndustryTh>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><IndustryTd colSpan={5} className="text-center text-[var(--ci-text-tertiary)]">Loading…</IndustryTd></tr>
              ) : myRequests.length === 0 ? (
                <tr><IndustryTd colSpan={5} className="text-center text-[var(--ci-text-tertiary)]">No leave requests yet. Submit one above.</IndustryTd></tr>
              ) : (
                myRequests.map((r) => (
                  <IndustryTr key={r.id}>
                    <IndustryTd className="capitalize">{r.leave_type.replace(/_/g, " ")}</IndustryTd>
                    <IndustryTd mono>{r.start_date} → {r.end_date}</IndustryTd>
                    <IndustryTd align="right" mono>{daysBetween(r.start_date, r.end_date)}</IndustryTd>
                    <IndustryTd>{r.is_paid ? "Paid" : "Unpaid"}</IndustryTd>
                    <IndustryTd>
                      <IndustryTag variant={STATUS_VARIANT[r.status] ?? "neutral"}>{r.status}</IndustryTag>
                      {r.status === "rejected" && r.rejected_reason && (
                        <p className="text-[11px] text-[var(--ci-text-tertiary)] mt-1">{r.rejected_reason}</p>
                      )}
                    </IndustryTd>
                  </IndustryTr>
                ))
              )}
            </tbody>
          </IndustryTable>
        </IndustryCard>
      </div>

      {isHr && (
        <div className="mt-4">
          <IndustryCardKicker>
            Team requests{pendingTeamCount > 0 ? ` — ${pendingTeamCount} awaiting a decision` : ""}
          </IndustryCardKicker>
          <IndustryCard className="mt-2">
            <IndustryTable>
              <thead>
                <tr>
                  <IndustryTh>Employee</IndustryTh>
                  <IndustryTh>Type</IndustryTh>
                  <IndustryTh>Dates</IndustryTh>
                  <IndustryTh align="right">Days</IndustryTh>
                  <IndustryTh>Paid</IndustryTh>
                  <IndustryTh>Status</IndustryTh>
                  <IndustryTh align="right">Action</IndustryTh>
                </tr>
              </thead>
              <tbody>
                {teamRequests.length === 0 ? (
                  <tr><IndustryTd colSpan={7} className="text-center text-[var(--ci-text-tertiary)]">No leave requests from the team.</IndustryTd></tr>
                ) : (
                  teamRequests.map((r) => (
                    <IndustryTr key={r.id}>
                      <IndustryTd>{r.employee?.name || r.employee_id}</IndustryTd>
                      <IndustryTd className="capitalize">{r.leave_type.replace(/_/g, " ")}</IndustryTd>
                      <IndustryTd mono>{r.start_date} → {r.end_date}</IndustryTd>
                      <IndustryTd align="right" mono>{daysBetween(r.start_date, r.end_date)}</IndustryTd>
                      <IndustryTd>{r.is_paid ? "Paid" : "Unpaid"}</IndustryTd>
                      <IndustryTd><IndustryTag variant={STATUS_VARIANT[r.status] ?? "neutral"}>{r.status}</IndustryTag></IndustryTd>
                      <IndustryTd align="right">
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
                          <span className="text-[12px] text-[var(--ci-text-tertiary)]">—</span>
                        )}
                      </IndustryTd>
                    </IndustryTr>
                  ))
                )}
              </tbody>
            </IndustryTable>
          </IndustryCard>
        </div>
      )}
    </IndustryRoleShell>
  );
}
