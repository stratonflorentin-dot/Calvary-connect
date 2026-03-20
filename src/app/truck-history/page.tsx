
"use client";

import { useState } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Wrench, Route, Calendar, ShieldCheck, History, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TruckHistoryPage() {
  const { role } = useRole();
  const firestore = useFirestore();
  const { user } = useUser();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  // 1. Query all vehicles for the dropdown
  const fleetQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'fleet_vehicles');
  }, [firestore, user]);

  const { data: fleet } = useCollection(fleetQuery);

  // 2. Query Maintenance History for selected vehicle
  const maintenanceQuery = useMemoFirebase(() => {
    if (!firestore || !selectedVehicleId) return null;
    return query(
      collection(firestore, 'maintenance_requests'),
      where('fleetVehicleId', '==', selectedVehicleId),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    );
  }, [firestore, selectedVehicleId]);

  // 3. Query Trip History for selected vehicle
  const tripsQuery = useMemoFirebase(() => {
    if (!firestore || !selectedVehicleId) return null;
    return query(
      collection(firestore, 'trips'),
      where('fleetVehicleId', '==', selectedVehicleId),
      where('status', '==', 'delivered'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, selectedVehicleId]);

  const { data: maintenanceLogs } = useCollection(maintenanceQuery);
  const { data: tripLogs } = useCollection(tripsQuery);

  const selectedVehicle = fleet?.find(v => v.id === selectedVehicleId);

  if (!['CEO', 'OPERATIONS', 'MECHANIC'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Truck Lifecycle History</h1>
            <p className="text-muted-foreground text-sm font-sans">Audit maintenance logs and trip history per asset.</p>
          </div>
          
          <div className="w-full md:w-64">
            <Select onValueChange={(val) => setSelectedVehicleId(val)}>
              <SelectTrigger className="bg-white rounded-xl shadow-sm border-none h-12">
                <SelectValue placeholder="Select a Vehicle" />
              </SelectTrigger>
              <SelectContent>
                {fleet?.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name} ({v.plateNumber})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {!selectedVehicleId ? (
          <div className="h-96 flex flex-col items-center justify-center text-center space-y-4 bg-muted/20 rounded-3xl border border-dashed">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <History className="size-10" />
            </div>
            <div>
              <p className="font-headline text-lg">No Vehicle Selected</p>
              <p className="text-sm text-muted-foreground">Choose a truck from the dropdown to view its full operational history.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Sidebar Stats */}
            <div className="space-y-6">
              <Card className="rounded-3xl border-none shadow-sm bg-primary text-white">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-widest opacity-70">Asset Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-headline">{selectedVehicle?.name}</h2>
                    <p className="font-mono text-sm opacity-80">{selectedVehicle?.plateNumber}</p>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs">Current Condition</span>
                    <Badge className="bg-white text-primary font-bold">{selectedVehicle?.condition}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Operational Status</span>
                    <Badge variant="outline" className="border-white text-white">{selectedVehicle?.status}</Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card className="rounded-2xl border-none shadow-sm bg-white p-4">
                  <Wrench className="size-5 text-primary mb-2" />
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Services</p>
                  <p className="text-2xl font-headline">{maintenanceLogs?.length || 0}</p>
                </Card>
                <Card className="rounded-2xl border-none shadow-sm bg-white p-4">
                  <Route className="size-5 text-emerald-500 mb-2" />
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Trips Done</p>
                  <p className="text-2xl font-headline">{tripLogs?.length || 0}</p>
                </Card>
              </div>
            </div>

            {/* Main Timeline */}
            <div className="xl:col-span-2 space-y-6">
              <h2 className="text-xl font-headline flex items-center gap-2">
                <History className="size-5 text-primary" /> Operational Timeline
              </h2>

              <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                {/* Combined Logs Sorted by Date (Simplified implementation: Maintenance followed by Trips) */}
                <div className="space-y-8">
                  <section className="space-y-4">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground ml-12 md:text-center md:ml-0">Maintenance Logs</h3>
                    {maintenanceLogs?.map((log) => (
                      <TimelineItem 
                        key={log.id}
                        type="maintenance"
                        title="Service Completed"
                        date={new Date(log.completedAt).toLocaleDateString()}
                        description={log.serviceLog}
                        tag={`Condition: ${log.truckConditionAfterService}`}
                        icon={<Wrench className="size-4" />}
                        color="primary"
                      />
                    ))}
                    {maintenanceLogs?.length === 0 && <p className="text-center text-xs text-muted-foreground italic">No maintenance logs found.</p>}
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground ml-12 md:text-center md:ml-0">Trip History</h3>
                    {tripLogs?.map((trip) => (
                      <TimelineItem 
                        key={trip.id}
                        type="trip"
                        title={`Delivery: ${trip.originLocation} to ${trip.destinationLocation}`}
                        date={new Date(trip.createdAt).toLocaleDateString()}
                        description={trip.notes || 'No trip notes.'}
                        tag="Delivered"
                        icon={<Route className="size-4" />}
                        color="emerald"
                      />
                    ))}
                    {tripLogs?.length === 0 && <p className="text-center text-xs text-muted-foreground italic">No trip records found.</p>}
                  </section>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TimelineItem({ type, title, date, description, tag, icon, color }: any) {
  return (
    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
      {/* Icon Circle */}
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full border border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10",
        color === 'primary' ? 'bg-primary text-white' : 'bg-emerald-500 text-white'
      )}>
        {icon}
      </div>
      {/* Card Content */}
      <div className="w-[calc(100%-4rem)] md:w-[45%] p-4 rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <time className="font-mono text-[10px] font-bold text-slate-500">{date}</time>
          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter">{tag}</Badge>
        </div>
        <div className="text-sm font-headline text-slate-900 mb-1">{title}</div>
        <div className="text-xs text-slate-500 line-clamp-2 italic">{description}</div>
      </div>
    </div>
  );
}
