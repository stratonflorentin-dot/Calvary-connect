import type { UserRole } from "@/types/roles";

const KNOWN_ROLES: UserRole[] = [
  "CEO",
  "ADMIN",
  "OPERATOR",
  "DRIVER",
  "MECHANIC",
  "ACCOUNTANT",
  "HR",
  "SALESMAN",
  "WAREHOUSE_STAFF",
];

export function isValidRole(role: string): role is UserRole {
  return KNOWN_ROLES.includes(role as UserRole);
}

/** Normalizes DB or UI strings (e.g. "salesman", " Salesman ") to canonical UserRole. */
export function normalizeRole(role: string): UserRole | null {
  const upperRole = role.trim().toUpperCase();
  if (isValidRole(upperRole)) {
    return upperRole;
  }
  return null;
}

export function resolveUserRole(raw: unknown, fallback: UserRole = "OPERATOR"): UserRole {
  return normalizeRole(String(raw ?? "")) ?? fallback;
}
