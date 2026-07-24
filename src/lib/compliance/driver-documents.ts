import { FileText, HeartPulse, Globe } from "lucide-react";

/**
 * Driver document types tracked for expiry.
 *
 * The DB columns already exist (added in migration 003) but were never
 * wired to any UI. Status for each is computed via the shared
 * `complianceStatus()`/`daysRemaining()` primitives in `./status` — do not
 * reimplement thresholds here (unlike `vehicle-compliance-tracker.tsx`,
 * which duplicates its own thresholds independently of `./status`).
 */
export const DRIVER_DOCUMENT_TYPES = [
  { key: "license_expiry", label: "Driving License", icon: FileText, critical: true },
  { key: "medical_cert_expiry", label: "Medical Certificate", icon: HeartPulse, critical: true },
  { key: "cross_border_pass_expiry", label: "Cross-Border Pass", icon: Globe, critical: false },
] as const;

export type DriverDocumentKey = (typeof DRIVER_DOCUMENT_TYPES)[number]["key"];
