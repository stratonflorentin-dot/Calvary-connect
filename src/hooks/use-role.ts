"use client";

import { useEffect, useCallback } from 'react';
import { UserRole } from '@/types/roles';
import { useSupabase } from '@/components/supabase-provider';
import { isPrimaryOwnerEmail } from '@/lib/supabase';
import { resolveUserRole } from '@/lib/user-role-utils';

// Department-based permission mapping
export const DEPARTMENT_PERMISSIONS = {
  // Sales Department
  SALES: {
    roles: ['CEO', 'ADMIN', 'SALESMAN'],
    modules: ['leads', 'customers', 'quotations', 'contracts', 'bookings', 'opportunities', 'rate_sheets'],
    actions: ['create', 'read', 'update', 'delete', 'approve', 'convert']
  },
  // Operations Department
  OPERATIONS: {
    roles: ['CEO', 'ADMIN', 'OPERATOR'],
    modules: ['bookings', 'trips', 'vehicles', 'drivers', 'pod', 'maintenance'],
    actions: ['create', 'read', 'update', 'delete', 'approve', 'verify']
  },
  // Finance Department
  FINANCE: {
    roles: ['CEO', 'ADMIN', 'ACCOUNTANT'],
    modules: ['invoices', 'payments', 'journal_entries', 'expenses', 'revenue', 'tax_reports', 'general_ledger'],
    actions: ['create', 'read', 'update', 'delete', 'approve', 'reconcile']
  },
  // HR Department
  HR: {
    roles: ['CEO', 'ADMIN', 'HR'],
    modules: ['employees', 'allowances', 'payroll', 'users'],
    actions: ['create', 'read', 'update', 'delete', 'approve']
  },
  // Warehouse Department
  WAREHOUSE: {
    roles: ['CEO', 'ADMIN', 'WAREHOUSE_STAFF'],
    modules: ['inventory', 'parts', 'warehouse'],
    actions: ['create', 'read', 'update', 'delete']
  },
  // Mechanics
  MECHANICS: {
    roles: ['CEO', 'ADMIN', 'MECHANIC'],
    modules: ['maintenance', 'vehicles', 'parts'],
    actions: ['read', 'update', 'create']
  }
};

export function useRole() {
  const { user, role: contextRole, changeRole: supabaseChangeRole, isLoading } = useSupabase();

  // Enhanced console logging for role changes
  useEffect(() => {
    if (!user && !contextRole) return;
    console.log('[useRole] contextRole:', contextRole, 'user.role:', user?.role, 'email:', user?.email);
  }, [contextRole, user?.role, user?.email]);

  // The actual user role from database (never changes with impersonation)
  const actualRole = user?.role ? resolveUserRole(user.role) : null;
  const isAdmin =
    actualRole === 'ADMIN' ||
    actualRole === 'CEO' ||
    isPrimaryOwnerEmail(user?.email);

  const currentRole = contextRole
    ? resolveUserRole(contextRole)
    : actualRole;

  const changeRole = (newRole: UserRole) => {
    if (!isAdmin) return;
    supabaseChangeRole(newRole);
  };

  // Permission check: ADMIN has full access regardless of impersonated role
  const hasPermission = useCallback((requiredRoles: UserRole[]) => {
    // ADMIN always has full access
    if (isAdmin) return true;
    // Otherwise check if current role is in required roles
    if (!currentRole) return false;
    return requiredRoles.includes(currentRole);
  }, [isAdmin, currentRole]);

  // Check if user can access a page/feature
  const canAccess = useCallback((allowedRoles: UserRole[]) => {
    if (isAdmin) return true;
    if (!currentRole) return false;
    return allowedRoles.includes(currentRole);
  }, [isAdmin, currentRole]);

  // Department-based permission check
  const hasDepartmentAccess = useCallback((department: keyof typeof DEPARTMENT_PERMISSIONS) => {
    if (isAdmin) return true;
    if (!currentRole) return false;
    
    const deptPermissions = DEPARTMENT_PERMISSIONS[department];
    return deptPermissions.roles.includes(currentRole);
  }, [isAdmin, currentRole]);

  // Module access check within department
  const canAccessModule = useCallback((module: string, action?: string) => {
    if (isAdmin) return true;
    if (!currentRole) return false;

    // Find which department has this module
    for (const [deptName, deptPermissions] of Object.entries(DEPARTMENT_PERMISSIONS)) {
      if (deptPermissions.modules.includes(module)) {
        // Check if role is in department
        if (!deptPermissions.roles.includes(currentRole)) return false;
        // Check if action is allowed
        if (action && !deptPermissions.actions.includes(action)) return false;
        return true;
      }
    }
    return false;
  }, [isAdmin, currentRole]);

  // Get user's departments
  const getUserDepartments = useCallback(() => {
    if (isAdmin) return Object.keys(DEPARTMENT_PERMISSIONS);
    if (!currentRole) return [];

    const departments: string[] = [];
    for (const [deptName, deptPermissions] of Object.entries(DEPARTMENT_PERMISSIONS)) {
      if (deptPermissions.roles.includes(currentRole)) {
        departments.push(deptName);
      }
    }
    return departments;
  }, [isAdmin, currentRole]);

  return {
    role: currentRole,
    actualRole,
    isAdmin,
    changeRole,
    isInitialized: !isLoading,
    isLoading,
    hasPermission,
    canAccess,
    hasDepartmentAccess,
    canAccessModule,
    getUserDepartments
  };
}
