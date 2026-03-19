"use client";

import { useRole } from '@/hooks/use-role';
import { UserRole } from '@/types/roles';
import { Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RoleSelector() {
  const { role, changeRole } = useRole();

  if (!role) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[9999] md:bottom-8">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="size-12 rounded-full bg-primary text-white shadow-xl flex items-center justify-center hover:rotate-90 transition-transform">
            <Settings className="size-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuRadioGroup value={role} onValueChange={(v) => changeRole(v as UserRole)}>
            <DropdownMenuRadioItem value="CEO">CEO</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="OPERATIONS">Operations</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="DRIVER">Driver</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="MECHANIC">Mechanic</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ACCOUNTANT">Accountant</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
