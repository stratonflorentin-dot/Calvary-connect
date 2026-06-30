"use client";

import { motion } from "framer-motion";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { useLanguage } from "@/hooks/use-language";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Truck,
  Navigation,
  DollarSign,
  Users,
  Package,
  MapPin,
  Plus,
  Trash2,
  Edit,
  Search,
  Filter,
  Calendar,
  BarChart2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Settings,
  Bell,
  Sparkles,
  Eye,
  FileText,
  Upload,
  Download,
  RefreshCw,
  Shield,
  Briefcase,
  Building2,
  CalendarDays,
  Globe,
  Thermometer,
  Anchor,
  Route,
  LayoutDashboard,
  Wrench,
  Calculator,
  LogOut,
  Camera,
  User as UserIcon,
  ChevronRight,
  MoreVertical,
  ArrowRight,
  Container,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  role: string;
  showQuickActions?: boolean;
  onAddItem?: () => void;
  hideSidebar?: boolean;
}

export function DashboardLayout({
  children,
  title,
  description,
  role,
  showQuickActions = true,
  onAddItem,
  hideSidebar = true,
}: DashboardLayoutProps) {
  const { user, signOut } = useSupabase();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateRange, setDateRange] = useState("today");
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className={cn("flex min-h-screen w-full overflow-hidden bg-background text-foreground", !hideSidebar && "h-screen")}>
      {!hideSidebar && <Sidebar role={role as any} />}
      <main className={cn("flex-1 flex flex-col overflow-hidden", !hideSidebar && "md:ml-60")}>
        {/* Top Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur md:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-border bg-muted text-muted-foreground">{role}</Badge>
                <Badge className="border-success/20 bg-success/10 text-success">Live Operations</Badge>
              </div>
              <h1 className="mt-2 text-xl font-semibold tracking-normal text-foreground sm:text-2xl">{title}</h1>
              {description && (
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="h-9 w-full min-w-[180px] border-input bg-background pl-8 lg:w-[260px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-[132px] border-input bg-background">
                <Filter className="size-3 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
              </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="h-9 w-[132px] border-input bg-background">
                <Calendar className="size-3 mr-2" />
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
              </Select>
              <Button
              variant="ghost"
              size="icon"
              className="relative border border-input bg-background"
              onClick={() => setShowNotifications(true)}
            >
              <Bell className="size-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
              </Button>
              <Button
              variant="ghost"
              size="icon"
              className="border border-input bg-background"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="size-5" />
              </Button>
              <div className="hidden items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 lg:flex">
                <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                  {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                </div>
                <div className="max-w-[150px]">
                  <p className="truncate text-xs font-semibold text-card-foreground">{user?.name || "User"}</p>
                  <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{user?.role || role}</p>
                </div>
              </div>
              <Button variant="outline" className="gap-2 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={signOut}>
                <LogOut className="size-4" />
                <span className="hidden sm:inline">{t.logout || "Logout"}</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  trend?: number;
  link?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  trend,
  link,
}: StatCardProps) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ 
        y: -4, 
        scale: 1.015,
        boxShadow: "0 12px 20px -8px rgba(0,0,0,0.08)"
      }}
      transition={{ 
        type: "spring",
        stiffness: 260,
        damping: 18
      }}
      className="app-surface p-4 cursor-pointer transition-colors flex flex-col justify-between h-full min-h-[120px]"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={cn("p-2 rounded-lg shrink-0", bgColor)}>
          <Icon className={cn("size-5", color)} />
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0",
              trend >= 0
                ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
            )}
          >
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-foreground truncate tracking-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-extrabold mt-1 truncate">
          {title}
        </p>
      </div>
    </motion.div>
  );

  if (link) {
    return <Link href={link}>{content}</Link>;
  }

  return content;
}

interface DataTableProps {
  columns: {
    key: string;
    label: string;
    render?: (row: any) => React.ReactNode;
  }[];
  data: any[];
  onDelete?: (id: string) => void;
  onEdit?: (row: any) => void;
  onView?: (row: any) => void;
}

export function DataTable({
  columns,
  data,
  onDelete,
  onEdit,
  onView,
}: DataTableProps) {
  return (
    <div className="app-table-shell">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
              >
                {col.label}
              </TableHead>
            ))}
            {(onDelete || onEdit || onView) && (
              <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Actions
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={row.id || index} className="hover:bg-muted/50">
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {col.render ? col.render(row) : row[col.key]}
                </TableCell>
              ))}
              {(onDelete || onEdit || onView) && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {onView && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => onView(row)}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                    )}
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => onEdit(row)}
                      >
                        <Edit className="size-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-red-500 hover:text-red-700"
                        onClick={() => onDelete(row.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const listContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const listItemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <motion.div 
      variants={listContainerVariants}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {activities.map((activity) => (
        <motion.div
          key={activity.id}
          variants={listItemVariants}
          whileHover={{ x: 4, backgroundColor: "rgba(0, 0, 0, 0.015)" }}
          className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all duration-200"
        >
          <div
            className={cn(
              "size-8 rounded-full flex items-center justify-center shrink-0",
              activity.color,
            )}
          >
            <activity.icon className="size-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{activity.title}</p>
            <p className="text-xs text-muted-foreground">
              {activity.description}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground whitespace-nowrap">
            {activity.time}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}

interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  time: string;
}

export function AlertPanel({ alerts }: { alerts: AlertItem[] }) {
  return (
    <motion.div 
      variants={listContainerVariants}
      initial="hidden"
      animate="show"
      className="space-y-3"
    >
      {alerts.map((alert) => (
        <motion.div
          key={alert.id}
          variants={listItemVariants}
          whileHover={{ scale: 1.01 }}
          className={cn(
            "p-3 rounded-xl border-l-4",
            alert.severity === "critical"
              ? "bg-destructive/10 border-l-destructive"
              : alert.severity === "warning"
                ? "bg-warning/10 border-l-warning"
                : "bg-info/10 border-l-info",
          )}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className={cn(
                "size-4 mt-0.5 shrink-0",
                alert.severity === "critical"
                  ? "text-destructive"
                  : alert.severity === "warning"
                    ? "text-warning"
                    : "text-info",
              )}
            />
            <div>
              <p className="text-sm font-bold">{alert.title}</p>
              <p className="text-xs text-muted-foreground">
                {alert.description}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
              {alert.time}
            </span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
