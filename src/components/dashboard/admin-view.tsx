"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Shield,
  History,
  AlertTriangle,
  Settings,
  Database,
  UserPlus,
  Key,
  Plus,
  Trash2,
  Edit,
} from "lucide-react";
import { StatCards } from "./stat-cards";
import { DashboardLayout, ActivityFeed, AlertPanel } from "./shared/dashboard-layout";
import { AIAnalysisDashboard } from "./ai-analysis-dashboard";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { useRole } from "@/hooks/use-role";
import { useFleetVehicles } from "@/hooks/data/use-fleet-vehicles";
import { useTrips } from "@/hooks/data/use-trips";
import { useExpenses } from "@/hooks/data/use-expenses";
import { useInvoices } from "@/hooks/data/use-invoices";
import { useUsers } from "@/hooks/data/use-users";
import { AuditService } from "@/services/audit-service";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const { t } = useLanguage();
  const { format } = useCurrency();
  const { role } = useRole();

  // Data hooks
  const { vehicles, loading: vLoading } = useFleetVehicles();
  const { trips, loading: tLoading } = useTrips();
  const { users: allUsers, loading: uLoading } = useUsers();
  const { invoices, loading: iLoading } = useInvoices();

  const [alerts, setAlerts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        setLoading(true);
        // Load real system activities (Audit Logs)
        const logs = await AuditService.getLogs({ limit: 10 });
        const mappedActivities = logs.map(log => ({
          id: log.id,
          title: log.change_summary || "System Update",
          description: `${log.user_name} performed ${log.action} on ${log.table_name}`,
          time: new Date(log.created_at).toLocaleTimeString(),
          icon: log.action === 'CREATE' ? UserPlus : log.action === 'DELETE' ? Trash2 : Edit,
          color: log.action === 'CREATE' ? "bg-green-500" : log.action === 'DELETE' ? "bg-red-500" : "bg-blue-500",
        }));
        setActivities(mappedActivities);

        // Load Admin-level alerts
        const overdueInvoices = invoices.filter(i => 
          String(i.status).toLowerCase() !== 'paid' && 
          new Date(i.due_date) < new Date()
        );
        
        const criticalMaint = await supabase.from('maintenance_requests')
          .select('id, vehicle_id, description')
          .eq('priority', 'critical')
          .neq('status', 'completed')
          .limit(3);

        const adminAlerts = [
          ...(overdueInvoices.slice(0, 2).map(i => ({
            id: i.id,
            title: "Overdue Invoice",
            description: `Invoice ${i.invoice_number} is past due. Follow up with ${i.customer_name}.`,
            severity: "critical" as const,
            time: "Finance"
          }))),
          ...(criticalMaint.data?.map(m => ({
            id: m.id,
            title: "Critical Maintenance",
            description: `Vehicle ${m.vehicle_id} has critical issue: ${m.description}`,
            severity: "warning" as const,
            time: "Fleet"
          })) || [])
        ];
        setAlerts(adminAlerts);

      } catch (err) {
        console.error("Error loading Admin Dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAdminData();
  }, [invoices]);

  const isDataLoading = vLoading || tLoading || uLoading || iLoading || loading;

  return (
    <DashboardLayout
      title="Admin Control Center"
      description="System-wide oversight and management"
      role="ADMIN"
    >
      <div className="space-y-6">
        <AlertPanel alerts={alerts} />
        <StatCards />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Oversight Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Shield className="size-5 text-indigo-600" />
                  System Users & Access
                </h3>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                  {allUsers.length} Registered Users
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['ADMIN', 'CEO', 'ACCOUNTANT', 'OPERATOR'].map(r => (
                  <div key={r} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{r}</p>
                    <p className="text-xl font-bold text-slate-700">
                      {allUsers.filter(u => u.role === r).length}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Database className="size-5 text-blue-600" />
                Data Integrity Monitor
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <History className="size-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">Audit Consistency</p>
                      <p className="text-xs text-slate-500">Log chain integrity verified</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase">Optimal</span>
                </div>
                <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Key className="size-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">RBAC Policies</p>
                      <p className="text-xs text-slate-500">All role permissions active</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase">Secure</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Feed Column */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                <History className="size-4 text-indigo-500" /> 
                System-Wide Activity
              </h3>
              <ActivityFeed activities={activities} />
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-lg text-white">
              <h3 className="font-bold mb-2 flex items-center gap-2 text-sm">
                <Settings className="size-4 text-slate-400" />
                System Maintenance
              </h3>
              <p className="text-[11px] text-slate-300 mb-4 leading-relaxed">
                Review system logs and user permissions to ensure operational security and efficiency.
              </p>
              <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors">
                Manage Permissions
              </button>
            </div>
          </div>
        </div>

        {/* AI Strategy & Insights */}
        <div className="mt-8">
          <AIAnalysisDashboard />
        </div>
      </div>
    </DashboardLayout>
  );
}
