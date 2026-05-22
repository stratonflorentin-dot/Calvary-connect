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
import { toast } from "@/hooks/use-toast";

// ✅ Move icon map OUTSIDE the component so it's always available
const routeIconMap:Record<string,any>={
  "/":LayoutDashboard,
  "/trips":Route,
  "/bookings":CalendarDays,
  "/map":MapPin,
  "/customers":Building2,
  "/sales":Briefcase,
  "/fleet":Truck,
  "/service-requests":Wrench,
  "/inventory":Package,
  "/parts-requests":Wrench,
  "/fuel-approvals":Truck,
  "/finance":DollarSign,
  "/expenses":Receipt,
  "/income":Calculator,
  "/reports":BarChart2,
  "/users":Users,
  "/drivers":Users,
  "/allowances":Briefcase,
  "/audit":Shield,
  "/ai-insights":Sparkles,
  "/notifications":Bell,
  "/profile":UserIcon
};

const CATEGORY_LABELS:Record<string,string>={
  dashboard:"Overview",
  logistics:"Logistics & Dispatch",
  fleet:"Fleet & Assets",
  finance:"Financial Operations",
  people:"Human Resources",
  system:"Administration"
};

export function Sidebar({ role }:{ role:UserRole }){
  const pathname=usePathname();
  const { t }=useLanguage();
  const { signOut, user, uploadAvatar }=useSupabase();
  const [storedRole, setStoredRole]=useState<UserRole|null>(null);
  const [isUploading, setIsUploading]=useState(false);
  const [mobileMenuOpen, setMobileMenuOpen]=useState(false);

  const canUseRolePreview=user?.role==="ADMIN"||user?.role==="CEO"||isPrimaryOwnerEmail(user?.email);
  const menuOwnerEmail=isPrimaryOwnerEmail(user?.email)?user?.email:undefined;

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

  useEffect(()=>{
    const saved=localStorage.getItem("fleet_command_role") as UserRole|null;
    setStoredRole(saved);
    const handleStorageChange=()=>{
      const updated=localStorage.getItem("fleet_command_role") as UserRole|null;
      setStoredRole(updated);
    };
    window.addEventListener("storage",handleStorageChange);
    window.addEventListener("roleChanged",handleStorageChange);
    return ()=>{
      window.removeEventListener("storage",handleStorageChange);
      window.removeEventListener("roleChanged",handleStorageChange);
    };
  },[]);

  const effectiveRole=canUseRolePreview?resolveUserRole(String(storedRole||role||"ADMIN"),"ADMIN"):resolveUserRole(String(role||""),"OPERATOR");
  const menuItems=getMenuByRole(effectiveRole,false,t,menuOwnerEmail,false);

  const groupedMenu=menuItems.reduce((acc,item)=>{
    if(!item.category) return acc;
    if(!acc[item.category]) acc[item.category]=[];
    acc[item.category].push(item);
    return acc;
  },{} as Record<string,any[]>);

  return (
    <>
      <button onClick={()=>setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-sidebar text-white shadow-lg"><Menu className="size-5"/></button>
      {mobileMenuOpen&&<div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={()=>setMobileMenuOpen(false)}/>}
      <aside className={`flex flex-col w-64 fixed inset-y-0 bg-[#1a1a2e] text-white border-r border-white/5 z-50 transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen?'translate-x-0':'-translate-x-full'}`}>
        <div className="p-8">
          <h1 className="font-headline text-2xl font-extrabold tracking-tighter text-white uppercase">Calvary</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 font-bold">Connect Fleet</p>
        </div>

        <nav className="flex-1 px-4 space-y-8 overflow-y-auto no-scrollbar pb-10">
          {Object.entries(CATEGORY_LABELS).map(([key,label])=>{
            const items=groupedMenu[key];
            if(!items||items.length===0) return null;
            return (
              <div key={key} className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold px-4">{label}</p>
                <div className="space-y-1">
                  {items.map(item=>(
                    <div key={item.path} className="relative group/nav">
                      <Link href={item.path} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",pathname===item.path?"bg-[#2952A3] text-white shadow-lg shadow-blue-900/20":"text-white/50 hover:text-white hover:bg-white/5")}>
                        {(() => { const Icon = routeIconMap[item.path] || LayoutDashboard; return <Icon className={cn("size-5",pathname===item.path?"text-cyan-400":"text-white/30 group-hover:text-cyan-400")}/>; })()}
                        <span>{item.label}</span>
                      </Link>
                      
                      {/* Quick Nav Axis for Financial Ledger */}
                      {item.path === "/finance" && (
                        <Link 
                          href="/" 
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/nav:opacity-100 transition-all p-1.5 hover:bg-white/10 rounded-lg text-cyan-400 hover:text-cyan-300"
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

        <div className="p-4 border-t border-white/5 bg-white/5 backdrop-blur-md">
          <div className="px-4 py-3 flex items-center gap-3 bg-white/5 rounded-2xl mb-4 group relative border border-white/5">
            <Avatar className="size-10 border border-white/10 ring-2 ring-cyan-400/20"><AvatarImage src={user?.avatar}/><AvatarFallback className="bg-[#2952A3] text-white">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{user?.name||"Staff Member"}</p>
              <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">{effectiveRole}</p>
            </div>
            <label className="absolute -top-1 -right-1 size-6 bg-cyan-500 text-[#1a1a2e] rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-all shadow-lg border-2 border-[#1a1a2e]"><Camera className="size-3"/><input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading}/></label>
          </div>
          <button className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all group" onClick={signOut}><LogOut className="size-5 group-hover:rotate-12 transition-transform"/><span>{t.logout}</span></button>
        </div>
      </aside>
    </>
  );
}
