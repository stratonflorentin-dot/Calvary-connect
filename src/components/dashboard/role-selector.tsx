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
  HardHat,
  Wrench,
  Calculator,
  Users,
  Crown,
} from "lucide-react";
import { useSupabase } from "@/components/supabase-provider";
import { UserRole } from "@/types/roles";
import { ADMIN_EMAIL } from "@/lib/supabase";
import { ROLE_DEFAULT_ROUTES } from "@/lib/route-config";

const ROLE_ICONS = {
  ADMIN: Shield,
  CEO: Crown,
  OPERATOR: UserCog,
  DRIVER: Truck,
  MECHANIC: Wrench,
  ACCOUNTANT: Calculator,
  HR: Users,
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  CEO: "CEO",
  OPERATOR: "Fleet Operator",
  DRIVER: "Driver",
  MECHANIC: "Mechanic",
  ACCOUNTANT: "Accountant",
  HR: "HR Manager",
};

export function RoleSelector() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { user, role, changeRole } = useSupabase();

  // Debug logging
  console.log("[RoleSelector] user:", user?.email, "role:", role, "ADMIN_EMAIL:", ADMIN_EMAIL);

  // Only show for the specific admin email
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    console.log("[RoleSelector] hiding: not admin");
    return null;
  }

  const currentRole = (role as UserRole) || "ADMIN";
  const CurrentIcon = ROLE_ICONS[currentRole] || Shield;

  const handleRoleChange = (newRole: UserRole) => {
    console.log(`[RoleSelector] Changing role from ${currentRole} to ${newRole}`);

    // Save role
    changeRole(newRole);
    localStorage.setItem("fleet_command_role", newRole);

    // Get default route for the new role
    const defaultRoute = ROLE_DEFAULT_ROUTES[newRole];
    console.log(`[RoleSelector] Redirecting to ${defaultRoute}`);

    // Close dropdown and redirect
    setOpen(false);
    window.location.href = defaultRoute;
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
        {(Object.keys(ROLE_ICONS) as UserRole[]).map((r) => {
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
