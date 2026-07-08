"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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
  Receipt,
  Shield,
  Camera,
  User as UserIcon,
  Briefcase,
  Building2,
  CalendarDays,
  Globe,
  Navigation,
  Menu,
  X,
  Zap,
  ClipboardList,
  Fuel,
  ChevronLeft,
  ChevronRight,
  ArrowUpCircle,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/roles";
import { useLanguage } from "@/hooks/use-language";
import { useSupabase } from "@/components/supabase-provider";
import { isPrimaryOwnerEmail } from "@/lib/supabase";
import {
  NAVIGATION_CATEGORY_LABELS,
  NAVIGATION_CATEGORY_ORDER,
  getNavigationMenuByRole,
} from "@/lib/route-config";
import { resolveUserRole } from "@/lib/user-role-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useSidebar } from "@/hooks/use-sidebar";

// ✅ Move icon map OUTSIDE the component so it's always available
const routeIconMap: Record<string, any> = {
  "/": LayoutDashboard,
  "/trips": Route,
  "/dispatch": Navigation,
  "/chat": MessageSquare,
  "/route-optimizer": Route,
  "/track": Globe,
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

export function Sidebar({ role }: { role?: UserRole | null }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { signOut, user, uploadAvatar } = useSupabase();
  const [storedRole, setStoredRole] = useState<UserRole | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [serviceRequestCount, setServiceRequestCount] = useState(0);
  const [partsRequestCount, setPartsRequestCount] = useState(0);
  const [meetingCount, setMeetingCount] = useState(0);

  // Use our new sidebar hook for state management
  const { isOpen, isCollapsed, toggle, open, close, toggleCollapse } = useSidebar();

  // Ref for quick return scroll behavior
  const lastScrollY = useRef(0);
  const canUseRolePreview = user?.role === "ADMIN" || user?.role === "CEO" || isPrimaryOwnerEmail(user?.email);
  const menuOwnerEmail = isPrimaryOwnerEmail(user?.email) ? user?.email : undefined;

  // Quick return behavior - show/hide sidebar on scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        // Scrolling down - hide sidebar on small screens or collapse on larger
        if (window.innerWidth < 768) {
          close();
        }
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up - show sidebar
        if (window.innerWidth < 768) {
          open();
        }
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [open, close]);

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
  const menuItems = getNavigationMenuByRole(effectiveRole, false, t, menuOwnerEmail, false);

  useEffect(() => {
    const fetchBadgeCounts = async () => {
      if (!user?.id) return;

      try {
        // Helper to get count from any table query, even if it fails
        const safeCount = async (query: any) => {
          try {
            const { data, error } = await query;
            if (error) {
              console.warn('Sidebar badge query error:', error.message);
              return 0;
            }
            return data?.length || 0;
          } catch (e) {
            console.warn('Sidebar badge query threw:', e);
            return 0;
          }
        };

        const [notificationsRes, maintenanceRes, serviceRequestsRes, partsRequestsRes, meetingsRes] = await Promise.all([
          safeCount(
            supabase
              .from("notifications")
              .select("id", { count: "exact" })
              .eq("user_id", user.id)
              .eq("read", false)
          ),
          safeCount(
            supabase
              .from("maintenance_requests")
              .select("id", { count: "exact" })
              .eq("status", "pending")
          ),
          safeCount(
            supabase
              .from("maintenance_requests")
              .select("id", { count: "exact" })
              .in("status", ["pending", "in_review"])
          ),
          safeCount(
            supabase
              .from("parts_requests")
              .select("id", { count: "exact" })
              .eq("status", "pending")
          ),
          safeCount(
            supabase
              .from("meetings")
              .select("id", { count: "exact" })
              .in("status", ["scheduled", "in_progress"])
          ),
        ]);

        setNotificationCount(notificationsRes);
        setMaintenanceCount(maintenanceRes);
        setServiceRequestCount(serviceRequestsRes);
        setPartsRequestCount(partsRequestsRes);
        setMeetingCount(meetingsRes);
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

  // Quick return button - scroll to top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={toggle}
        className="md:hidden fixed top-4 left-4 z-[60] p-2.5 rounded-xl bg-primary text-background shadow-lg hover:bg-primary/90 transition-all duration-200"
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Mobile overlay */}
      {isOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={close} />}

      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col fixed inset-y-0 z-50 transition-all duration-300 ease-out",
        "bg-slate-950 text-slate-300 border-r border-slate-800 shadow-xl",
        isCollapsed ? "w-20" : "w-64",
        // Mobile transition
        "md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className={cn("p-6 flex items-center justify-between", isCollapsed && "p-4 justify-center")}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2">
                <div className="bg-indigo-600 text-white p-1.5 rounded-xl shadow-[0_0_12px_rgba(79,70,229,0.5)]">
                  <Zap className="size-5" />
                </div>
                <h1 className="font-headline text-xl font-extrabold tracking-tighter text-white uppercase">
                  Calvary
                </h1>
              </div>
              <Button variant="ghost" size="icon" onClick={toggleCollapse} className="text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <ChevronLeft className="size-5" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={toggleCollapse} className="text-indigo-400 hover:bg-white/10 transition-colors">
              <ChevronRight className="size-5" />
            </Button>
          )}
        </div>
        {!isCollapsed && <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold px-6 -mt-2 mb-4">Command Panel</p>}

        <nav className="flex-1 px-2 space-y-6 overflow-y-auto no-scrollbar pb-10">
          {NAVIGATION_CATEGORY_ORDER.map((key) => {
            const label = NAVIGATION_CATEGORY_LABELS[key];
            const items = groupedMenu[key];
            if (!items || items.length === 0) return null;
            return (
              <div key={key} className="space-y-2">
                {!isCollapsed && <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-4">{label}</p>}
                <div className="space-y-1">
                  {items.map(item => {
                    const Icon = routeIconMap[item.path] || LayoutDashboard;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        target={item.path.startsWith('http') ? '_blank' : undefined}
                        rel={item.path.startsWith('http') ? 'noopener noreferrer' : undefined}
                        onClick={() => {
                          if (window.innerWidth < 768) close();
                        }}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 mx-1 rounded-xl text-sm font-medium transition-all group",
                          pathname === item.path
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/50"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                        )}
                      >
                        <Icon className={cn(
                          "size-5 flex-shrink-0",
                          pathname === item.path
                            ? "text-white"
                            : "text-slate-500 group-hover:text-slate-300"
                        )} />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                        {/* Badges only show when not collapsed */}
                        {!isCollapsed && item.path === "/notifications" && notificationCount > 0 && (
                          <Badge className="ml-auto h-5 rounded-full text-[10px] px-1.5 py-0 bg-rose-500 text-white border-0">
                            {notificationCount}
                          </Badge>
                        )}
                        {!isCollapsed && item.path === "/maintenance" && maintenanceCount > 0 && (
                          <Badge className="ml-auto h-5 rounded-full text-[10px] px-1.5 py-0 bg-amber-500 text-white border-0">
                            {maintenanceCount}
                          </Badge>
                        )}
                        {!isCollapsed && item.path === "/service-requests" && serviceRequestCount > 0 && (
                          <Badge className="ml-auto h-5 rounded-full text-[10px] px-1.5 py-0 bg-amber-500 text-white border-0">
                            {serviceRequestCount}
                          </Badge>
                        )}
                        {!isCollapsed && item.path === "/parts-requests" && partsRequestCount > 0 && (
                          <Badge variant="secondary" className="ml-auto h-6 rounded-full text-xs px-2 py-0.5">
                            {partsRequestCount}
                          </Badge>
                        )}
                        {!isCollapsed && item.path === "/hr/meetings" && meetingCount > 0 && (
                          <Badge variant="secondary" className="ml-auto h-6 rounded-full text-xs px-2 py-0.5">
                            {meetingCount}
                          </Badge>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">
          {/* Quick Return Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToTop}
            className="w-full mb-2 text-indigo-400 hover:bg-white/10 transition-colors"
          >
            <ArrowUpCircle className="size-4 mr-2" />
            {!isCollapsed && "Back to Top"}
          </Button>

          <div className={cn(
            "px-3 py-3 flex items-center gap-3 bg-slate-900 rounded-2xl mb-2 group relative border border-slate-800 shadow-lg transition-colors",
            isCollapsed && "justify-center px-0"
          )}>
            <Avatar className="size-10 border border-slate-700">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-indigo-600 text-white text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-200 truncate">{user?.name || "Super Admin"}</p>
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{effectiveRole}</p>
              </div>
            )}
            {!isCollapsed && (
              <label className="absolute -top-1 -right-1 size-6 bg-indigo-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-all shadow-md border-2 border-slate-900">
                <Camera className="size-3" />
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} />
              </label>
            )}
          </div>
          <button
            className={cn(
              "flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-bold transition-all group",
              "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
              isCollapsed && "justify-center px-0"
            )}
            onClick={signOut}
          >
            <LogOut className="size-5 group-hover:rotate-12 transition-transform" />
            {!isCollapsed && <span>{t.logout}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
