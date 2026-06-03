"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  UserCog,
  Truck,
  Wrench,
  Calculator,
  Users,
  Crown,
  Briefcase,
  Package,
} from "lucide-react";
import { useSupabase } from "@/components/supabase-provider";
import { UserRole } from "@/types/roles";
import { isPrimaryOwnerEmail } from "@/lib/supabase";
import { ROLE_DEFAULT_ROUTES } from "@/lib/route-config";

const ROLE_ICONS = {
  ADMIN: Shield,
  CEO: Crown,
  OPERATOR: UserCog,
  DRIVER: Truck,
  MECHANIC: Wrench,
  ACCOUNTANT: Calculator,
  HR: Users,
  SALESMAN: Briefcase,
  WAREHOUSE_STAFF: Package,
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  CEO: "CEO",
  OPERATOR: "Fleet Operator",
  DRIVER: "Driver",
  MECHANIC: "Mechanic",
  ACCOUNTANT: "Accountant",
  HR: "HR Manager",
  SALESMAN: "Sales Representative",
  WAREHOUSE_STAFF: "Warehouse Staff",
};

export function RoleSelector() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { user, role, changeRole } = useSupabase();

  // Debug logging
  console.log("[RoleSelector] user:", user?.email, "role:", role);

  // Only show for admins/owners
  if (!user) {
    return null;
  }

  const isAdmin =
    isPrimaryOwnerEmail(user.email) ||
    user.role === 'ADMIN' ||
    user.role === 'CEO';

  if (!isAdmin) {
    console.log("[RoleSelector] hiding: not admin");
    return null;
  }

  const currentRole = (role as UserRole) || "ADMIN";
  const CurrentIcon = ROLE_ICONS[currentRole] || Shield;

  const handleRoleChange = (newRole: UserRole) => {
    console.log(`[RoleSelector] Changing role from ${currentRole} to ${newRole}`);

    changeRole(newRole);

    // Get default route for the new role
    const defaultRoute = ROLE_DEFAULT_ROUTES[newRole];
    console.log(`[RoleSelector] Navigating to ${defaultRoute}`);

    // Close dropdown and use Next.js router for navigation (no full reload)
    setOpen(false);
    router.push(defaultRoute);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg bg-primary text-white hover:bg-primary/90 z-50"
        >
          <CurrentIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
          Switch Role (Current: {ROLE_LABELS[currentRole]})
        </div>
        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => {
          const Icon = ROLE_ICONS[r];
          return (
            <DropdownMenuItem
              key={r}
              onClick={() => handleRoleChange(r)}
              className={r === currentRole ? "bg-accent" : ""}
            >
              <Icon className="mr-2 h-4 w-4" />
              {ROLE_LABELS[r]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
