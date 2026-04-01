"use client";

import { useRole } from '@/hooks/use-role';
import { UserRole } from '@/types/roles';
import { Settings, User, Shield, Wrench, Calculator, Users, Truck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_ICONS = {
  CEO: User,
  ADMIN: Shield,
  OPERATOR: Truck,
  DRIVER: Truck,
  MECHANIC: Wrench,
  ACCOUNTANT: Calculator,
  HR: Users,
};

export function RoleSelector() {
  const { role, changeRole } = useRole();

  if (!role) return null;

  const CurrentIcon = ROLE_ICONS[role as keyof typeof ROLE_ICONS];

  return (
    <div className="fixed bottom-24 right-4 z-[9999] md:bottom-8">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="size-14 rounded-full bg-primary text-white shadow-xl flex items-center justify-center hover:scale-110 transition-transform border-4 border-white">
            <CurrentIcon className="size-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="p-2 border-b">
            <p className="text-sm font-medium">Switch Role</p>
            <p className="text-xs text-muted-foreground">Current: {role}</p>
          </div>
          <DropdownMenuRadioGroup value={role} onValueChange={(v) => changeRole(v as UserRole)}>
            <DropdownMenuRadioItem value="CEO" className="flex items-center gap-2">
              <User className="size-4" />
              <div>
                <div className="font-medium">CEO</div>
                <div className="text-xs text-muted-foreground">Full access</div>
              </div>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ADMIN" className="flex items-center gap-2">
              <Shield className="size-4" />
              <div>
                <div className="font-medium">Admin</div>
                <div className="text-xs text-muted-foreground">System administration</div>
              </div>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="OPERATOR" className="flex items-center gap-2">
              <Truck className="size-4" />
              <div>
                <div className="font-medium">Operator</div>
                <div className="text-xs text-muted-foreground">Fleet operations</div>
              </div>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="DRIVER" className="flex items-center gap-2">
              <Truck className="size-4" />
              <div>
                <div className="font-medium">Driver</div>
                <div className="text-xs text-muted-foreground">Trip management</div>
              </div>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="MECHANIC" className="flex items-center gap-2">
              <Wrench className="size-4" />
              <div>
                <div className="font-medium">Mechanic</div>
                <div className="text-xs text-muted-foreground">Maintenance</div>
              </div>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ACCOUNTANT" className="flex items-center gap-2">
              <Calculator className="size-4" />
              <div>
                <div className="font-medium">Accountant</div>
                <div className="text-xs text-muted-foreground">Financial data</div>
              </div>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="HR" className="flex items-center gap-2">
              <Users className="size-4" />
              <div>
                <div className="font-medium">HR Manager</div>
                <div className="text-xs text-muted-foreground">Employee management</div>
              </div>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
