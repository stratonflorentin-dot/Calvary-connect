// Automatic compliance status engine. Status is always DERIVED from the
// expiry date — never user-selected — so it is correct every day without a
// stored value going stale.

export type ComplianceStatus = "expired" | "due_today" | "due_7" | "due_30" | "ok";

export const STATUS_META: Record<ComplianceStatus, { label: string; chip: string; rank: number }> = {
  expired:   { label: "Expired",     chip: "cv-chip-danger",  rank: 0 },
  due_today: { label: "Due today",   chip: "cv-chip-danger",  rank: 1 },
  due_7:     { label: "≤ 7 days",    chip: "cv-chip-warning", rank: 2 },
  due_30:    { label: "8–30 days",   chip: "cv-chip-warning", rank: 3 },
  ok:        { label: "Valid",       chip: "cv-chip-success", rank: 4 },
};

export function daysRemaining(expiry?: string | null): number | null {
  if (!expiry) return null;
  const end = new Date(expiry);
  end.setHours(23, 59, 59, 999);
  return Math.floor((end.getTime() - Date.now()) / 86_400_000);
}

export function complianceStatus(expiry?: string | null): ComplianceStatus {
  const d = daysRemaining(expiry);
  if (d === null) return "ok";
  if (d < 0) return "expired";
  if (d === 0) return "due_today";
  if (d <= 7) return "due_7";
  if (d <= 30) return "due_30";
  return "ok";
}

/** Reminder thresholds (days before expiry) used by the notification engine. */
export const REMINDER_THRESHOLDS = [90, 60, 30, 14, 7, 3, 1, 0] as const;

export const DOCUMENT_TYPES = [
  "insurance",
  "registration",
  "road_license",
  "inspection",
  "permit",
  "comesa_yellow_card",
  "tra_certificate",
  "fitness_certificate",
  "other",
] as const;

export const DOC_TYPE_LABELS: Record<string, string> = {
  insurance: "Insurance",
  registration: "Registration",
  road_license: "Road License",
  inspection: "Inspection",
  permit: "Permit",
  comesa_yellow_card: "COMESA Yellow Card",
  tra_certificate: "TRA Certificate",
  fitness_certificate: "Fitness Certificate",
  other: "Other",
};
