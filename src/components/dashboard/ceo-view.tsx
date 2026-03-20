
"use client";

import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, limit, orderBy } from 'firebase/firestore';
import { StatCards } from './stat-cards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

const revenueData = [
  { name: 'Jan', income: 4000, expenses: 2400 },
  { name: 'Feb', income: 3000, expenses: 1398 },
  { name: 'Mar', income: 2000, expenses: 9800 },
  { name: 'Apr', income: 2780, expenses: 3908 },
  { name: 'May', income: 1890, expenses: 4800 },
  { name: 'Jun', income: 2390, expenses: 3800 },
];

const fuelData = [
  { name: 'Jan', liters: 400 },
  { name: 'Feb', liters: 300 },
  { name: 'Mar', liters: 600 },
  { name: 'Apr', liters: 800 },
  { name: 'May', liters: 500 },
  { name: 'Jun', liters: 700 },
];

export function CeoView() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { t } = useLanguage();

  const fleetQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'fleet_vehicles'), limit(5));
  }, [firestore, user]);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'maintenance_requests'), 
      orderBy('reportedAt', 'desc'), 
      limit(3)
    );
  }, [firestore, user]);

  const { data: fleet } = useCollection(fleetQuery);
  const { data: recentIssues } = useCollection(maintenanceQuery);

  const activeAlerts = recentIssues?.filter(issue => issue.status === 'pending' && issue.severity === 'Critical') || [];

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline tracking-tighter text-foreground">{t.command_dashboard}</h1>
          <p className="text-muted-foreground text-sm font-sans">{t.strategic_overview}</p>
        </div>
      </header>

      <StatCards />

      {activeAlerts.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {activeAlerts.map(alert => (
            <Card key={alert.id} className="border-none bg-rose-50 border-l-4 border-l-rose-500 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-rose-500 flex items-center justify-center text-white animate-pulse">
                    <AlertTriangle className="size-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-700 uppercase tracking-widest">{t.critical_alert}</p>
                    <p className="text-sm font-medium">{alert.issueDescription}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-rose-600">
                      <Clock className="size-3" />
                      {new Date(alert.reportedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <Badge variant="destructive" className="bg-rose-600">{t.immediate_action}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-headline">{t.revenue_vs_expenses}</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend />
                <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-headline">{t.fuel_consumption}</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fuelData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="liters" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm border-none bg-white overflow-hidden">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="text-lg font-headline">{t.active_fleet}</CardTitle>
          <Badge variant="outline" className="border-primary text-primary">{t.live_updates}</Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-y">
              <tr className="text-left font-headline uppercase tracking-widest text-[11px] text-muted-foreground">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Plate</th>
                <th className="px-6 py-4">Condition</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fleet?.map((truck) => (
                <tr key={truck.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium">{truck.name}</td>
                  <td className="px-6 py-4">{truck.type}</td>
                  <td className="px-6 py-4 font-mono">{truck.plateNumber}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      truck.condition === 'Good' ? 'bg-emerald-100 text-emerald-700' : 
                      truck.condition === 'Fair' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    )}>{truck.condition}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={cn(
                      truck.status === 'Available' ? 'bg-emerald-500' : 
                      truck.status === 'In Use' ? 'bg-amber-500 animate-pulse-slow' : 'bg-rose-500'
                    )}>{truck.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
