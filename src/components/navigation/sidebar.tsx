"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Truck,
  Route,
  DollarSign,
  BarChart2,
  Users,
  Package,
  MapPin,
  Sparkles,
  Bell,
  Wrench,
  Calculator,
  LogOut,
  History,
  Home,
  Shield,
  Camera,
  User as UserIcon,
  Briefcase,
  Building2,
  CalendarDays,
  Globe,
  Thermometer,
  Anchor,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/roles";
import { useLanguage } from "@/hooks/use-language";
import { useSupabase } from "@/components/supabase-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ADMIN_EMAIL } from "@/lib/supabase";
import { getMenuByRole, roleHasTripsAccess } from "@/lib/route-config";
import { resolveUserRole } from "@/lib/user-role-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";

// ✅ Move icon map OUTSIDE the component so it's always available
const routeIconMap: Record<string, any> = {
  "/": LayoutDashboard,
  "/fleet": Truck,
  "/trips": Route,
  "/bookings": CalendarDays,
  "/customers": Building2,
  "/sales": Briefcase,
  "/finance": DollarSign,
  "/income": Calculator,
  "/fuel-approvals": Truck,
  "/allowances": Users,
  "/reports": BarChart2,
  "/monthly-report": BarChart2,
  "/users": Users,
  "/inventory": Package,
  "/parts-requests": Wrench,
  "/spare-parts": Package,
  "/service-requests": Wrench,
  "/truck-history": History,
  "/map": MapPin,
  "/proof": Home,
  "/report": History,
  "/ai-insights": Sparkles,
  "/audit": Shield,
  "/notifications": Bell,
  "/profile": UserIcon,
};

const getIconForRoute = (path: string) => routeIconMap[path] || LayoutDashboard;

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { signOut, user, uploadAvatar } = useSupabase();
  const isAdminEmail = 
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || 
    user?.email?.toLowerCase() === 'calvaryadmin466@gmail.com' ||
    user?.role === 'ADMIN' ||
    user?.role === 'CEO';

  // ✅ Track stored role reactively
  const [storedRole, setStoredRole] = useState<UserRole | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await uploadAvatar(file);
      toast({
        title: "Photo Updated",
        description: "Your profile picture has been updated.",
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    // Read initial value
    const saved = localStorage.getItem("fleet_command_role") as UserRole | null;
    setStoredRole(saved);

    // ✅ Listen for changes when role is switched elsewhere in the app
    const handleStorageChange = () => {
      const updated = localStorage.getItem(
        "fleet_command_role",
      ) as UserRole | null;
      setStoredRole(updated);
    };

    window.addEventListener("storage", handleStorageChange);

    // ✅ Also listen for custom event (for same-tab changes)
    window.addEventListener("roleChanged", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("roleChanged", handleStorageChange);
    };
  }, []);

  const effectiveRole = isAdminEmail
    ? resolveUserRole(String(storedRole || role || "ADMIN"), "ADMIN")
    : resolveUserRole(String(role || ""), "OPERATOR");

  const showTripShortcuts = roleHasTripsAccess(effectiveRole);
  // This allows them to view all features without restriction
  const menuItems = getMenuByRole(
    effectiveRole,
    false,
    t,
    user?.email,
    false, // ✅ Never restrict the menu for the admin/owner
  );

  interface NavItem {
    label: string;
    icon: any;
    href: string;
  }

  const navItems: NavItem[] = menuItems.map((route) => ({
    label: route.label,
    icon: getIconForRoute(route.path),
    href: route.path,
  }));

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-sidebar text-white shadow-lg"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop always visible, Mobile conditional */}
      <aside className={`
        flex flex-col w-60 fixed inset-y-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-50
        transition-transform duration-300 ease-in-out
        md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
      <div className="p-6 flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl tracking-tighter text-white">
            Calvary
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-medium">
            Connect
          </p>
        </div>
        <NotificationBell />
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent">
        {/* Main Navigation */}
        <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold px-3 mb-2">
          Main Menu
        </p>
        {navItems.map((item: NavItem) => (
          <Link
            key={item.href} // ✅ Use href as key, not label (labels can duplicate)
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
              pathname === item.href
                ? "bg-primary text-white"
                : "hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-white",
            )}
          >
            <item.icon
              className={cn(
                "size-5 transition-colors",
                pathname === item.href
                  ? "text-white"
                  : "text-sidebar-foreground/50 group-hover:text-white",
              )}
            />
            <span>{item.label}</span>
          </Link>
        ))}

        {showTripShortcuts && (
        <>
        {/* Service Types - Calvary Feature */}
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold px-3 mb-2">
            Services
          </p>
          <div className="space-y-1">
            <Link
              href="/trips?type=cross-border"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-sidebar-accent transition-colors group"
            >
              <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sidebar-foreground/70 group-hover:text-white">
                Cross-Border
              </span>
            </Link>
            <Link
              href="/trips?type=cold-chain"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-sidebar-accent transition-colors group"
            >
              <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                <Thermometer className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sidebar-foreground/70 group-hover:text-white">
                Cold Chain
              </span>
            </Link>
            <Link
              href="/trips?type=heavy-cargo"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-sidebar-accent transition-colors group"
            >
              <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sidebar-foreground/70 group-hover:text-white">
                Heavy Cargo
              </span>
            </Link>
          </div>
        </div>

        {/* Border Routes - Calvary Feature */}
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold px-3 mb-2">
            Border Routes
          </p>
          <div className="grid grid-cols-2 gap-1 px-2">
            <Link
              href="/trips?border=DRC"
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-sidebar-accent transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-sidebar-foreground/60">
                Kasumbalesa
              </span>
            </Link>
            <Link
              href="/trips?border=ZMB"
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-sidebar-accent transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-sidebar-foreground/60">
                Tunduma
              </span>
            </Link>
            <Link
              href="/trips?border=KEN"
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-sidebar-accent transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-sidebar-foreground/60">Sirari</span>
            </Link>
            <Link
              href="/trips?border=RWA"
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-sidebar-accent transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <span className="text-xs text-sidebar-foreground/60">Rusumo</span>
            </Link>
            <Link
              href="/trips?border=UGA"
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-sidebar-accent transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-cyan-500" />
              <span className="text-xs text-sidebar-foreground/60">
                Mutukula
              </span>
            </Link>
            <Link
              href="/trips?border=BDI"
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-sidebar-accent transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-pink-500" />
              <span className="text-xs text-sidebar-foreground/60">
                Kabanga
              </span>
            </Link>
          </div>
        </div>

        {/* Quick Stats - Calvary Feature */}
        <div className="mt-4 px-3">
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold mb-2">
            Fleet Status
          </p>
          <div className="bg-sidebar-accent/30 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-lg font-bold text-white">--</p>
                <p className="text-[10px] text-sidebar-foreground/50">
                  Active Trips
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-primary">--</p>
                <p className="text-[10px] text-sidebar-foreground/50">
                  Vehicles
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-500">--</p>
                <p className="text-[10px] text-sidebar-foreground/50">
                  Cross-Border
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-cyan-500">--</p>
                <p className="text-[10px] text-sidebar-foreground/50">
                  Cold Chain
                </p>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-4">
        {/* Profile / Avatar Section */}
        <div className="px-3 py-2 flex items-center gap-3 bg-sidebar-accent/30 rounded-xl group relative">
          <div className="relative">
            <Avatar className="size-10 border border-sidebar-border">
              <AvatarImage src={user?.avatar} alt={user?.name || ""} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {user?.name?.charAt(0).toUpperCase() || (
                  <UserIcon className="size-5" />
                )}
              </AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -right-1 size-5 bg-primary text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/80 transition-colors shadow-sm">
              <Camera className="size-3" />
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={isUploading}
              />
            </label>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">
              {user?.name || "User"}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider font-medium truncate">
              {effectiveRole}
            </p>
          </div>
        </div>

        <button
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:bg-destructive hover:text-white transition-all"
          onClick={signOut}
        >
          <LogOut className="size-5" />
          <span>{t.logout}</span>
        </button>
      </div>
    </aside>
    </>
  );
}
