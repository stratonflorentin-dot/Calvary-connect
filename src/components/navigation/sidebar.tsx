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
  Receipt,
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
  Zap,
  ClipboardList,
  Fuel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/roles";
import { useLanguage } from "@/hooks/use-language";
import { useSupabase } from "@/components/supabase-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { isPrimaryOwnerEmail } from "@/lib/supabase";
import { getMenuByRole, roleHasTripsAccess } from "@/lib/route-config";
import { resolveUserRole } from "@/lib/user-role-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

// ✅ Move icon map OUTSIDE the component so it's always available
const routeIconMap: Record<string, any> = {
  "/": LayoutDashboard,
  "/trips": Route,
  "/trip-history": ClipboardList,
  "/bookings": CalendarDays,
  "/map": MapPin,
  "/customers": Building2,
  "/sales": Briefcase,
  "/fleet": Truck,
  "/fleet/compliance": Shield,
  "/fuel": Fuel,
  "/service-requests": Wrench,
  "/maintenance": Wrench,
  "/inventory": Package,
  "/parts-requests": Wrench,
  "/fuel-approvals": Truck,
  "/finance": DollarSign,
  "/expenses": Receipt,
  "/income": Calculator,
  "/reports": BarChart2,
  "/users": Users,
  "/drivers": Users,
  "/allowances": Briefcase,
  "/admin/hr/payroll/statutory": BarChart2,
  "/audit": Shield,
  "/ai-insights": Sparkles,
  "/notifications": Bell,
  "/hr/insurance": Shield,
  "/hr/meetings": CalendarDays,
  "/profile": UserIcon,
  "https://logipro.milelepower.co.tz/": Globe
};

const CATEGORY_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  sales: "Sales",
  logistics: "Shipments",
  fleet: "Fleet",
  inventory: "Inventory",
  finance: "Accounting",
  reports: "Reports",
  people: "HR",
  system: "Settings"
};

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { signOut, user, uploadAvatar } = useSupabase();
  const [storedRole, setStoredRole] = useState<UserRole | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [serviceRequestCount, setServiceRequestCount] = useState(0);
  const [partsRequestCount, setPartsRequestCount] = useState(0);
  const [meetingCount, setMeetingCount] = useState(0);

  const canUseRolePreview = user?.role === "ADMIN" || user?.role === "CEO" || isPrimaryOwnerEmail(user?.email);
  const menuOwnerEmail = isPrimaryOwnerEmail(user?.email) ? user?.email : undefined;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image smaller than 2MB.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      await uploadAvatar(file);
      toast({ title: "Photo Updated", description: "Your profile picture has been updated." });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("fleet_command_role") as UserRole | null;
    setStoredRole(saved);
    const handleStorageChange = () => {
      const updated = localStorage.getItem("fleet_command_role") as UserRole | null;
      setStoredRole(updated);
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("roleChanged", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("roleChanged", handleStorageChange);
    };
  }, []);

  const effectiveRole = canUseRolePreview ? resolveUserRole(String(storedRole || role || "ADMIN"), "ADMIN") : resolveUserRole(String(role || ""), "OPERATOR");
  const menuItems = getMenuByRole(effectiveRole, false, t, menuOwnerEmail, false);

  useEffect(() => {
    const fetchBadgeCounts = async () => {
      if (!user?.id) return;

      try {
        const [notificationsRes, maintenanceRes, serviceRequestsRes, partsRequestsRes, meetingsRes] = await Promise.all([
          supabase
            .from("notifications")
            .select("id", { count: "exact" })
            .eq("user_id", user.id)
            .eq("is_read", false),
          supabase
            .from("maintenance_requests")
            .select("id", { count: "exact" })
            .eq("status", "pending"),
          supabase
            .from("maintenance_requests")
            .select("id", { count: "exact" })
            .in("status", ["pending", "in_review"]),
          supabase
            .from("parts_requests")
            .select("id", { count: "exact" })
            .eq("status", "pending"),
          supabase
            .from("meetings")
            .select("id", { count: "exact" })
            .in("status", ["scheduled", "in_progress"]),
        ]);

        setNotificationCount(notificationsRes.data?.length || 0);
        setMaintenanceCount(maintenanceRes.data?.length || 0);
        setServiceRequestCount(serviceRequestsRes.data?.length || 0);
        setPartsRequestCount(partsRequestsRes.data?.length || 0);
        setMeetingCount(meetingsRes.data?.length || 0);
      } catch (error) {
        console.error("Failed to fetch sidebar badge counts:", error);
      }
    };

    fetchBadgeCounts();
  }, [user?.id]);

  const groupedMenu = menuItems.reduce((acc, item) => {
    if (!item.category) return acc;
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <>
      <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-sidebar text-white shadow-lg"><Menu className="size-5" /></button>
      {mobileMenuOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`flex flex-col w-64 fixed inset-y-0 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 border-r border-gray-200 dark:border-slate-800 z-50 transition-all duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 pb-4">
          <h1 className="font-headline text-2xl font-extrabold tracking-tighter text-[#0369A1] dark:text-blue-400 uppercase flex items-center gap-2">
            <div className="bg-[#0369A1] dark:bg-blue-600 text-white p-1 rounded-md"><Zap className="size-5" /></div>
            Calvary
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold mt-1">Connect Panel</p>
        </div>

        <nav className="flex-1 px-4 space-y-8 overflow-y-auto no-scrollbar pb-10">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const items = groupedMenu[key];
            if (!items || items.length === 0) return null;
            return (
              <div key={key} className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold px-4">{label}</p>
                <div className="space-y-1">
                  {items.map(item => (
                    <div key={item.path} className="relative group/nav">
                      <Link href={item.path} target={item.path.startsWith('http') ? '_blank' : undefined} rel={item.path.startsWith('http') ? 'noopener noreferrer' : undefined} className={cn("flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all group", pathname === item.path ? "bg-[#e0f2fe] dark:bg-blue-950/40 text-[#0369A1] dark:text-blue-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-[#0369A1] dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900/50")}>
                        {(() => { const Icon = routeIconMap[item.path] || LayoutDashboard; return <Icon className={cn("size-5", pathname === item.path ? "text-[#0369A1] dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-[#0369A1] dark:group-hover:text-blue-400")} />; })()}
                        <span>{item.label}</span>
                        {item.path === "/notifications" && notificationCount > 0 && (
                          <Badge variant="secondary" className="ml-auto h-6 rounded-full text-xs px-2 py-0.5">
                            {notificationCount}
                          </Badge>
                        )}
                        {item.path === "/maintenance" && maintenanceCount > 0 && (
                          <Badge variant="secondary" className="ml-auto h-6 rounded-full text-xs px-2 py-0.5">
                            {maintenanceCount}
                          </Badge>
                        )}
                        {item.path === "/service-requests" && serviceRequestCount > 0 && (
                          <Badge variant="secondary" className="ml-auto h-6 rounded-full text-xs px-2 py-0.5">
                            {serviceRequestCount}
                          </Badge>
                        )}
                        {item.path === "/parts-requests" && partsRequestCount > 0 && (
                          <Badge variant="secondary" className="ml-auto h-6 rounded-full text-xs px-2 py-0.5">
                            {partsRequestCount}
                          </Badge>
                        )}
                        {item.path === "/hr/meetings" && meetingCount > 0 && (
                          <Badge variant="secondary" className="ml-auto h-6 rounded-full text-xs px-2 py-0.5">
                            {meetingCount}
                          </Badge>
                        )}
                      </Link>

                      {/* Quick Nav Axis for Financial Ledger */}
                      {(item.path === "/finance" || item.path === "/finance/professional-accounting") && (
                        <Link
                          href="/"
                          className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/nav:opacity-100 transition-all p-1.5 hover:bg-slate-200 rounded-lg text-[#0369A1] hover:text-[#0284c7]"
                          title="Quick Return to Dashboard"
                        >
                          <LayoutDashboard className="size-4" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 backdrop-blur-md">
          <div className="px-4 py-3 flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl mb-4 group relative border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
            <Avatar className="size-10 border border-gray-200 dark:border-slate-800"><AvatarImage src={user?.avatar} /><AvatarFallback className="bg-[#0369A1] dark:bg-blue-600 text-white">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{user?.name || "Super Admin"}</p>
              <p className="text-[10px] text-[#0369A1] dark:text-blue-400 font-bold uppercase tracking-wider">{effectiveRole}</p>
            </div>
            <label className="absolute -top-1 -right-1 size-6 bg-[#0369A1] dark:bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-all shadow-md border-2 border-white dark:border-slate-800"><Camera className="size-3" /><input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} /></label>
          </div>
          <button className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 transition-all group" onClick={signOut}><LogOut className="size-5 group-hover:rotate-12 transition-transform" /><span>{t.logout}</span></button>
        </div>
      </aside>
    </>
  );
}
