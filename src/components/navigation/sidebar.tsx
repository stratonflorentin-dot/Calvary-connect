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
  Instagram,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/roles";
import { useLanguage } from "@/hooks/use-language";
import { useSupabase } from "@/components/supabase-provider";
import {
  NAVIGATION_CATEGORY_LABELS,
  NAVIGATION_CATEGORY_ORDER,
  getNavigationMenuByRole,
} from "@/lib/route-config";
import { resolveUserRole } from "@/lib/user-role-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
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
  "/chat/instagram": Instagram,
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
  "/driver/trips": Route,
  "/proof": Camera,
  "/driver/fuel": Fuel,
  "/driver/expenses": Receipt,
  "/driver/maintenance": Wrench,
  "/driver/profile": UserIcon,
  "https://logipro.milelepower.co.tz/": Globe
};

/** The routes worth a slot in the phone bottom bar, in priority order.
 *  Only routes the current role can actually see are used, so the driver
 *  paths never surface for manager roles and vice versa. */
const BOTTOM_NAV_PRIORITY = ["/", "/trips", "/driver/trips", "/fleet", "/chat", "/proof", "/finance", "/map", "/maintenance"];

export function Sidebar({ role }: { role?: UserRole | null }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { signOut, user, uploadAvatar } = useSupabase();
  const { isOpen, isCollapsed, toggle, close, toggleCollapse } = useSidebar();

  const canUseRolePreview = user?.role === "ADMIN" || user?.role === "CEO";
  const menuOwnerEmail: string | undefined = undefined;

  const [isUploading, setIsUploading] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [instagramUnreadCount, setInstagramUnreadCount] = useState(0);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [serviceRequestCount, setServiceRequestCount] = useState(0);
  const [partsRequestCount, setPartsRequestCount] = useState(0);
  const [meetingCount, setMeetingCount] = useState(0);

  const effectiveRole = canUseRolePreview ? resolveUserRole(String(role || "ADMIN"), "ADMIN") : resolveUserRole(String(role || ""), "OPERATOR");
  const menuItems = getNavigationMenuByRole(effectiveRole, false, t, menuOwnerEmail, false);

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

  // notifications.user_id is a uuid — the legacy offline-admin session uses a
  // synthetic id that would 400 the query.
  const isDbUser = (id?: string | null) =>
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

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

        const [notificationsRes, instagramUnreadRes, maintenanceRes, serviceRequestsRes, partsRequestsRes, meetingsRes] = await Promise.all([
          isDbUser(user.id)
            ? safeCount(
                supabase
                  .from("notifications")
                  .select("id", { count: "exact" })
                  .eq("user_id", user.id)
                  .eq("read", false)
              )
            : Promise.resolve(0),
          // RLS already scopes this to inbox-role users, so it naturally
          // returns 0 for anyone without access rather than needing a
          // client-side role check here too.
          safeCount(
            supabase
              .from("instagram_conversations")
              .select("id", { count: "exact" })
              .eq("is_read", false)
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
        setInstagramUnreadCount(instagramUnreadRes);
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

  // Phone bottom bar: the first four destinations this role can see, in
  // priority order, plus a Menu button that opens the full drawer.
  const bottomNavItems = BOTTOM_NAV_PRIORITY
    .map((path) => menuItems.find((m) => m.path === path))
    .filter(Boolean)
    .slice(0, 4) as { path: string; label: string }[];

  return (
    <>
      {/* ── Mobile top app bar (data attribute drives global content padding) ── */}
      <header
        data-mobile-topbar
        className="md:hidden fixed top-0 inset-x-0 z-40 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] border-b border-[hsl(var(--sidebar-border))] shadow-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="h-14 px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={toggle}
              aria-label={isOpen ? "Close navigation" : "Open navigation"}
              className="p-2 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] p-1 rounded-lg shrink-0">
                <Zap className="size-4" />
              </div>
              <span className="font-headline text-base font-extrabold tracking-tighter text-white uppercase truncate">
                Calvary
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="text-[hsl(var(--sidebar-foreground))] hover:text-white [&_button]:hover:bg-white/10 [&_svg]:size-4">
              <NotificationBell />
            </div>
            <Link href="/profile" aria-label="Profile">
              <Avatar className="size-8 border border-white/20">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-[hsl(var(--sidebar-primary))] text-white text-xs">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile bottom navigation ── */}
      <nav
        data-mobile-bottomnav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[hsl(var(--sidebar-background))] border-t border-[hsl(var(--sidebar-border))] shadow-[0_-4px_16px_rgba(0,0,0,0.25)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="h-16 grid grid-cols-5">
          {bottomNavItems.map((item) => {
            const Icon = routeIconMap[item.path] || LayoutDashboard;
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors",
                  active
                    ? "text-white"
                    : "text-[hsl(var(--sidebar-muted))] hover:text-white",
                )}
              >
                <span className={cn(
                  "flex items-center justify-center size-8 rounded-xl transition-colors",
                  active && "bg-[hsl(var(--sidebar-primary))] shadow-md",
                )}>
                  <Icon className="size-4.5" />
                </span>
                <span className="truncate max-w-[64px]">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={toggle}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors",
              isOpen ? "text-white" : "text-[hsl(var(--sidebar-muted))] hover:text-white",
            )}
          >
            <span className={cn(
              "flex items-center justify-center size-8 rounded-xl transition-colors",
              isOpen && "bg-[hsl(var(--sidebar-accent))]",
            )}>
              <Menu className="size-4.5" />
            </span>
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* Mobile overlay (above the bars, below the drawer) */}
      {isOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-[45]" onClick={close} />}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col fixed inset-y-0 z-50 transition-all duration-300 ease-out",
          "bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] border-r border-[hsl(var(--sidebar-border))] shadow-xl",
          isCollapsed ? "w-20" : "w-64",
          // Mobile transition - fully hidden on mobile when closed
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className={cn("p-6 flex items-center justify-between", isCollapsed && "p-4 justify-center")}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2">
                <div className="bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] p-1.5 rounded-xl shadow-[0_0_12px_hsl(var(--sidebar-primary)/0.5)]">
                  <Zap className="size-5" />
                </div>
                <h1 className="font-headline text-xl font-extrabold tracking-tighter text-white uppercase">
                  Calvary
                </h1>
              </div>
              <div className="flex items-center gap-1">
                <div className="text-[hsl(var(--sidebar-foreground))] hover:text-white [&_button]:hover:bg-white/10 [&_svg]:size-4">
                  <NotificationBell />
                </div>
                <Button variant="ghost" size="icon" onClick={toggleCollapse} className="text-[hsl(var(--sidebar-muted))] hover:text-white hover:bg-white/10 transition-colors">
                  <ChevronLeft className="size-5" />
                </Button>
              </div>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={toggleCollapse} className="text-indigo-400 hover:bg-white/10 transition-colors">
              <ChevronRight className="size-5" />
            </Button>
          )}
        </div>
        {!isCollapsed && <p className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--sidebar-muted))] font-bold px-6 -mt-2 mb-4">Command Panel</p>}

        <nav className="flex-1 px-2 space-y-6 overflow-y-auto no-scrollbar pb-10">
          {NAVIGATION_CATEGORY_ORDER.map((key) => {
            const label = NAVIGATION_CATEGORY_LABELS[key];
            const items = groupedMenu[key];
            if (!items || items.length === 0) return null;
            return (
              <div key={key} className="space-y-2">
                {!isCollapsed && <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--sidebar-muted))] font-bold px-4">{label}</p>}
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
                            ? "bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-md shadow-black/40"
                            : "text-[hsl(var(--sidebar-foreground))] hover:text-white hover:bg-[hsl(var(--sidebar-accent))]"
                        )}
                      >
                        <Icon className={cn(
                          "size-5 flex-shrink-0",
                          pathname === item.path
                            ? "text-white"
                            : "text-[hsl(var(--sidebar-muted))] group-hover:text-white"
                        )} />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                        {/* Badges only show when not collapsed */}
                        {!isCollapsed && item.path === "/notifications" && notificationCount > 0 && (
                          <Badge className="ml-auto h-5 rounded-full text-[10px] px-1.5 py-0 bg-rose-500 text-white border-0">
                            {notificationCount}
                          </Badge>
                        )}
                        {!isCollapsed && item.path === "/chat/instagram" && instagramUnreadCount > 0 && (
                          <Badge className="ml-auto h-5 rounded-full text-[10px] px-1.5 py-0 bg-rose-500 text-white border-0">
                            {instagramUnreadCount}
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

        <div className="p-3 border-t border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))]/40 backdrop-blur-md">
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
            "px-3 py-3 flex items-center gap-3 bg-[hsl(var(--sidebar-accent))] rounded-2xl mb-2 group relative border border-[hsl(var(--sidebar-border))] shadow-lg transition-colors",
            isCollapsed && "justify-center px-0"
          )}>
            <Avatar className="size-10 border border-slate-700">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-[hsl(var(--sidebar-primary))] text-white text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[hsl(var(--sidebar-primary-foreground))] truncate">{user?.name || "Super Admin"}</p>
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{effectiveRole}</p>
              </div>
            )}
            {!isCollapsed && (
              <label className="absolute -top-1 -right-1 size-6 bg-[hsl(var(--sidebar-primary))] text-white rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-all shadow-md border-2 border-[hsl(var(--sidebar-background))]">
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
