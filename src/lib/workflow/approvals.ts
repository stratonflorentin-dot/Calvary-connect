/**
 * Approval routing rules.
 *
 * Amount-based thresholds decide which role must sign off on a request.
 * The engine uses these when a transition is marked `requiresApproval`.
 *
 * Thresholds are in TZS. Adjust in one place; every module inherits.
 */

import type { UserRole } from "@/types/roles";
import type { EntityKind } from "./state-machines";

export interface ApprovalLevel {
  /** Applied when amount ≤ maxAmount (or when maxAmount is null for the tail). */
  maxAmount: number | null;
  /** Roles that can approve at this level. First match wins. */
  approverRoles: UserRole[];
  /** Human label shown on the request card. */
  label: string;
}

const TZS = (v: number) => v; // documentation helper

/**
 * Fuel + generic expense approvals share the same tiers.
 */
const spendTiers: ApprovalLevel[] = [
  {
    maxAmount: TZS(100_000),
    approverRoles: ["OPERATOR", "ADMIN", "CEO"],
    label: "Supervisor",
  },
  {
    maxAmount: TZS(1_000_000),
    approverRoles: ["ACCOUNTANT", "ADMIN", "CEO"],
    label: "Accountant",
  },
  {
    maxAmount: TZS(5_000_000),
    approverRoles: ["ADMIN", "CEO"],
    label: "Manager",
  },
  {
    maxAmount: null,
    approverRoles: ["CEO"],
    label: "CEO",
  },
];

export const approvalRules: Partial<Record<EntityKind, ApprovalLevel[]>> = {
  fuel_request: spendTiers,
  expense: spendTiers,
};

export function resolveApprovalLevel(
  kind: EntityKind,
  amount: number,
): ApprovalLevel | null {
  const tiers = approvalRules[kind];
  if (!tiers) return null;
  for (const tier of tiers) {
    if (tier.maxAmount === null || amount <= tier.maxAmount) return tier;
  }
  return tiers[tiers.length - 1];
}

export function canRoleApprove(
  kind: EntityKind,
  amount: number,
  role: UserRole | undefined,
): boolean {
  if (!role) return false;
  const level = resolveApprovalLevel(kind, amount);
  if (!level) return false;
  return level.approverRoles.includes(role);
}

/**
 * SLA in hours per entity kind. Requests older than this show as overdue
 * in the approvals inbox and dispatch board.
 */
export const slaHours: Record<EntityKind, number> = {
  trip: 24,
  maintenance_request: 48,
  fuel_request: 4,
  expense: 24,
  leave_request: 72,
  fuel_anomaly: 48,
  // Purchase orders have no requiresApproval transitions (role-gated only),
  // so this isn't consulted by the approvals-inbox flow — present only to
  // satisfy the Record<EntityKind, number> shape.
  purchase_order: 48,
};

export function isOverdue(kind: EntityKind, createdAt: string | Date): boolean {
  const created = new Date(createdAt).getTime();
  const ageHours = (Date.now() - created) / (1000 * 60 * 60);
  return ageHours > slaHours[kind];
}

export function hoursSince(createdAt: string | Date): number {
  const created = new Date(createdAt).getTime();
  return Math.max(0, (Date.now() - created) / (1000 * 60 * 60));
}
