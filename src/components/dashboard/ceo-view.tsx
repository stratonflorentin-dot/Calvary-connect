"use client";

import { StatCards } from './stat-cards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line
} from 'recharts';
import { Badge } from '@/components/ui/badge';

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
  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline tracking-tighter text-foreground">CEO Dashboard</h1>
          <p className="text-muted-foreground text-sm font-sans">Overview of fleet operations and financial metrics.</p>
        </div>
      </header>

      <StatCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-headline">Revenue vs Expenses</CardTitle>
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
            <CardTitle className="text-lg font-headline">Fuel Consumption (L)</CardTitle>
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
          <CardTitle className="text-lg font-headline">Active Fleet Overview</CardTitle>
          <Badge variant="outline" className="border-primary text-primary">Live Updates</Badge>
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
              {[
                { name: 'Mercedes Axor', type: 'Heavy Duty', plate: 'G-2883', cond: 'Good', status: 'In Use' },
                { name: 'Scania R500', type: 'Container', plate: 'T-9921', cond: 'Fair', status: 'Maintenance' },
                { name: 'Volvo FH16', type: 'Heavy Duty', plate: 'K-1122', cond: 'Good', status: 'Available' },
                { name: 'MAN TGX', type: 'Trailer', plate: 'M-4452', cond: 'Poor', status: 'Available' },
              ].map((truck, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium">{truck.name}</td>
                  <td className="px-6 py-4">{truck.type}</td>
                  <td className="px-6 py-4 font-mono">{truck.plate}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      truck.cond === 'Good' ? 'bg-emerald-100 text-emerald-700' : 
                      truck.cond === 'Fair' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    )}>{truck.cond}</span>
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
