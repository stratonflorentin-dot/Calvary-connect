/**
 * Calvary Connect — RBAC Permission Matrix
 *
 * Single source of truth for role-based access control.
 * Used by: UI components (show/hide), API middleware (enforce), Firestore rules (via JWT claims).
 *
 * Roles: CEO | FINANCE | HR | OPERATOR | DRIVER | MECHANIC | CUSTOMER
 * Levels: FULL | READ | CREATE | OWN | NONE
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole =
  | 'CEO'
  | 'ACCOUNTANT'
  | 'HR'
  | 'OPERATOR'
  | 'DRIVER'
  | 'MECHANIC'
  | 'CUSTOMER';

export type PermissionLevel =
  | 'FULL'      // Create, read, update, delete, approve
  | 'READ'      // Read-only
  | 'CREATE'    // Can create and read own records
  | 'OWN'       // Read + update only own records
  | 'APPROVE'   // Read + approve/reject
  | 'NONE';     // No access

export type Module =
  | 'trips'
  | 'fleet'
  | 'finance_expenses'
  | 'finance_income'
  | 'finance_reports'
  | 'inventory'
  | 'maintenance'
  | 'fuel_requests'
  | 'spare_parts'
  | 'users_hr'
  | 'ai_insights'
  | 'audit_logs'
  | 'system_settings'
  | 'customers'
  | 'notifications'
  | 'contracts'
  | 'dispatch'
  | 'map';

// ─── Permission Matrix ───────────────────────────────────────────────────────

export const PERMISSION_MATRIX: Record<Module, Record<UserRole, PermissionLevel>> = {
  trips: {
    CEO:       'FULL',
    ACCOUNTANT: 'READ',
    HR:        'READ',
    OPERATOR:  'FULL',
    DRIVER:    'OWN',
    MECHANIC:  'READ',
    CUSTOMER:  'OWN',
  },
  fleet: {
    CEO:       'FULL',
    ACCOUNTANT: 'READ',
    HR:        'READ',
    OPERATOR:  'FULL',
    DRIVER:    'READ',
    MECHANIC:  'CREATE',
    CUSTOMER:  'NONE',
  },
  finance_expenses: {
    CEO:       'FULL',
    ACCOUNTANT: 'FULL',
    HR:        'NONE',
    OPERATOR:  'CREATE',
    DRIVER:    'CREATE',
    MECHANIC:  'NONE',
    CUSTOMER:  'NONE',
  },
  finance_income: {
    CEO:       'FULL',
    ACCOUNTANT: 'FULL',
    HR:        'NONE',
    OPERATOR:  'NONE',
    DRIVER:    'NONE',
    MECHANIC:  'NONE',
    CUSTOMER:  'NONE',
  },
  finance_reports: {
    CEO:       'FULL',
    ACCOUNTANT: 'FULL',
    HR:        'READ',
    OPERATOR:  'READ',
    DRIVER:    'NONE',
    MECHANIC:  'NONE',
    CUSTOMER:  'NONE',
  },
  inventory: {
    CEO:       'FULL',
    ACCOUNTANT: 'READ',
    HR:        'NONE',
    OPERATOR:  'FULL',
    DRIVER:    'NONE',
    MECHANIC:  'CREATE',
    CUSTOMER:  'NONE',
  },
  maintenance: {
    CEO:       'FULL',
    ACCOUNTANT: 'NONE',
    HR:        'NONE',
    OPERATOR:  'READ',
    DRIVER:    'CREATE',
    MECHANIC:  'FULL',
    CUSTOMER:  'NONE',
  },
  fuel_requests: {
    CEO:       'FULL',
    ACCOUNTANT: 'APPROVE',
    HR:        'NONE',
    OPERATOR:  'APPROVE',
    DRIVER:    'CREATE',
    MECHANIC:  'NONE',
    CUSTOMER:  'NONE',
  },
  spare_parts: {
    CEO:       'FULL',
    ACCOUNTANT: 'NONE',
    HR:        'NONE',
    OPERATOR:  'APPROVE',
    DRIVER:    'NONE',
    MECHANIC:  'CREATE',
    CUSTOMER:  'NONE',
  },
  users_hr: {
    CEO:       'FULL',
    ACCOUNTANT: 'NONE',
    HR:        'FULL',
    OPERATOR:  'NONE',
    DRIVER:    'OWN',
    MECHANIC:  'OWN',
    CUSTOMER:  'NONE',
  },
  ai_insights: {
    CEO:       'FULL',
    ACCOUNTANT: 'READ',
    HR:        'NONE',
    OPERATOR:  'NONE',
    DRIVER:    'NONE',
    MECHANIC:  'NONE',
    CUSTOMER:  'NONE',
  },
  audit_logs: {
    CEO:       'FULL',
    ACCOUNTANT: 'NONE',
    HR:        'NONE',
    OPERATOR:  'NONE',
    DRIVER:    'NONE',
    MECHANIC:  'NONE',
    CUSTOMER:  'NONE',
  },
  system_settings: {
    CEO:       'FULL',
    ACCOUNTANT: 'NONE',
    HR:        'NONE',
    OPERATOR:  'NONE',
    DRIVER:    'NONE',
    MECHANIC:  'NONE',
    CUSTOMER:  'NONE',
  },
  customers: {
    CEO:       'FULL',
    ACCOUNTANT: 'READ',
    HR:        'READ',
    OPERATOR:  'FULL',
    DRIVER:    'NONE',
    MECHANIC:  'NONE',
    CUSTOMER:  'OWN',
  },
  notifications: {
    CEO:       'FULL',
    ACCOUNTANT: 'OWN',
    HR:        'OWN',
    OPERATOR:  'OWN',
    DRIVER:    'OWN',
    MECHANIC:  'OWN',
    CUSTOMER:  'OWN',
  },
  contracts: {
    CEO:       'FULL',
    ACCOUNTANT: 'READ',
    HR:        'NONE',
    OPERATOR:  'READ',
    DRIVER:    'NONE',
    MECHANIC:  'NONE',
    CUSTOMER:  'OWN',
  },
  dispatch: {
    CEO:       'FULL',
    ACCOUNTANT: 'NONE',
    HR:        'NONE',
    OPERATOR:  'FULL',
    DRIVER:    'OWN',
    MECHANIC:  'NONE',
    CUSTOMER:  'NONE',
  },
  map: {
    CEO:       'FULL',
    ACCOUNTANT: 'NONE',
    HR:        'NONE',
    OPERATOR:  'FULL',
    DRIVER:    'OWN',
    MECHANIC:  'READ',
    CUSTOMER:  'NONE',
  },
};

// ─── Permission check helpers ─────────────────────────────────────────────────

/**
 * Returns the permission level a role has for a module.
 */
export function getPermission(role: UserRole, module: Module): PermissionLevel {
  return PERMISSION_MATRIX[module]?.[role] ?? 'NONE';
}

/**
 * Returns true if the role can perform any read on the module.
 */
export function canRead(role: UserRole, module: Module): boolean {
  const level = getPermission(role, module);
  return level !== 'NONE';
}

/**
 * Returns true if the role can write (create/update/delete) on the module.
 */
export function canWrite(role: UserRole, module: Module): boolean {
  const level = getPermission(role, module);
  return level === 'FULL' || level === 'CREATE';
}

/**
 * Returns true if the role has full admin access on the module.
 */
export function canAdmin(role: UserRole, module: Module): boolean {
  return getPermission(role, module) === 'FULL';
}

/**
 * Returns true if the role can approve/reject items in the module.
 */
export function canApprove(role: UserRole, module: Module): boolean {
  const level = getPermission(role, module);
  return level === 'FULL' || level === 'APPROVE';
}

/**
 * Returns true if the role can only access their own records.
 */
export function isOwnOnly(role: UserRole, module: Module): boolean {
  return getPermission(role, module) === 'OWN';
}

/**
 * Returns an array of modules a role can access at all.
 */
export function getAccessibleModules(role: UserRole): Module[] {
  return (Object.keys(PERMISSION_MATRIX) as Module[]).filter(
    (module) => getPermission(role, module) !== 'NONE'
  );
}
