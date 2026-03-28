"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench, Package, History, AlertCircle, CheckCircle2, ArrowRight, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function MechanicView() {
  const { user } = useSupabase();
  const { t } = useLanguage();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Load real maintenance requests from database
        const { data: maintenanceRequests } = await supabase
          .from('maintenance_requests')
          .select('*')
          .order('created_at', { ascending: false });
        
        setRequests(maintenanceRequests || []);
        
      } catch (error) {
        console.error('Error loading maintenance requests:', error);
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [user]);

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;
  const inProgressCount = requests?.filter(r => r.status === 'in_progress').length || 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-headline tracking-tighter">{t.maintenance_hub}</h1>
          <p className="text-muted-foreground text-sm">{t.real_time_health}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/spare-parts">
            <Button variant="default" size="sm" className="rounded-full gap-2 shadow-lg">
              <PlusCircle className="size-4" /> {t.request_parts}
            </Button>
          </Link>
          <Link href="/service-requests">
            <Button variant="outline" size="sm" className="rounded-full gap-2 border-primary text-primary">
              {t.overview} <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-none shadow-sm bg-primary text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest text-primary-foreground/70">{t.tasks_pending}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">{t.in_progress}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <div className="text-3xl font-headline text-blue-500">{inProgressCount}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">{t.quick_action}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/truck-history">
              <Button variant="ghost" className="w-full justify-start gap-2 h-auto py-2 text-xs font-bold text-primary hover:bg-primary/5">
                <History className="size-4" /> {t.check_history}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h2 className="text-xl font-headline tracking-tighter flex items-center gap-2">
            <Wrench className="size-5 text-primary" /> {t.active_queue}
          </h2>
          <div className="space-y-3">
            {requests?.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No active requests found.</p>
            ) : requests?.map(request => (
              <Card key={request.id} className="rounded-xl shadow-sm border overflow-hidden">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-headline text-sm truncate max-w-[200px]">{request.issueDescription}</p>
                    <p className="text-[10px] text-muted-foreground">Truck ID: {request.fleetVehicleId}</p>
                  </div>
                  <Badge className={cn(
                    "text-[10px]",
                    request.status === 'in_progress' ? 'bg-blue-500' : 
                    request.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                  )}>
                    {request.status.toUpperCase()}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-headline tracking-tighter flex items-center gap-2">
            <History className="size-5 text-primary" /> {t.recent_activity}
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="space-y-4">
              {requests?.filter(r => r.status === 'completed').slice(0, 3).map((log, i) => (
                <div key={i} className="flex gap-3 border-b pb-3 last:border-0">
                  <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{log.issueDescription}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">Log: {log.serviceLog}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">{new Date(log.completedAt).toLocaleDateString()}</span>
                      <Badge variant="outline" className="text-[8px] h-4">{log.truckConditionAfterService}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {requests?.filter(r => r.status === 'completed').length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 italic">No recent completion logs found.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
