"use client";

import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Every status string used across Finance/Fleet/Operations mapped to ONE of
// the five existing cv-chip-* tones (globals.css) — the same status word
// renders identically everywhere instead of each page inventing its own
// badge colors.
const STATUS_TONE: Record<string, Tone> = {
  // generic lifecycle
  draft: "neutral",
  pending: "warning",
  sent: "info",
  submitted: "info",
  approved: "success",
  active: "success",
  inactive: "neutral",
  cancelled: "danger",
  canceled: "danger",
  voided: "danger",
  completed: "success",
  expired: "neutral",
  archived: "neutral",
  confirmed: "info",
  pending_signature: "warning",
  suspended: "warning",
  terminated: "danger",
  // finance
  posted: "info",
  reconciled: "success",
  unmatched: "neutral",
  matched: "info",
  ignored: "neutral",
  paid: "success",
  partial: "info",
  overdue: "danger",
  unpaid: "warning",
  converted: "info",
  accepted: "success",
  rejected: "danger",
  disputed: "warning",
  reversed: "danger",
  // fleet / operations
  available: "success",
  in_use: "info",
  maintenance: "warning",
  out_of_service: "danger",
  delivered: "success",
  in_transit: "info",
  loading: "warning",
  scheduled: "info",
  requested: "warning",
  "in progress": "info",
  in_progress: "info",
};

export function statusTone(status: string | null | undefined): Tone {
  if (!status) return "neutral";
  return STATUS_TONE[status.toLowerCase().trim()] ?? "neutral";
}

export function StatusBadge({ status, label, className }: { status: string | null | undefined; label?: string; className?: string }) {
  const tone = statusTone(status);
  return (
    <span className={cn("cv-chip", `cv-chip-${tone}`, className)}>
      {label ?? (status ?? "—").replace(/_/g, " ")}
    </span>
  );
}
