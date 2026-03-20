"use client";

import { useState } from 'react';
import { getCeoAiInsights, CeoAiInsightsOutput } from '@/ai/flows/ceo-ai-insights';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, CheckCircle2, AlertCircle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AiInsightPanel() {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<CeoAiInsightsOutput | null>(null);
  const firestore = useFirestore();
  const { user } = useUser();

  const fleetQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'fleet_vehicles') : null, [firestore, user]);
  const tripsQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'trips') : null, [firestore, user]);
  const incomeQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'income') : null, [firestore, user]);
  const expenseQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'expenses') : null, [firestore, user]);
  const inventoryQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'inventory_items') : null, [firestore, user]);
  const locationsQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'driver_locations') : null, [firestore, user]);

  const { data: fleet } = useCollection(fleetQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: income } = useCollection(incomeQuery);
  const { data: expenses } = useCollection(expenseQuery);
  const { data: inventory } = useCollection(inventoryQuery);
  const { data: locations } = useCollection(locationsQuery);

  const generate = async () => {
    setLoading(true);
    try {
      const revenueThisMonth = income?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
      const expensesThisMonth = expenses?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

      const data = {
        activeTripsCount: trips?.filter(t => t.status === 'in_transit').length || 0,
        fleetBreakdown: { 
          available: fleet?.filter(v => v.status === 'Available').length || 0, 
          inUse: fleet?.filter(v => v.status === 'In Use').length || 0, 
          maintenance: fleet?.filter(v => v.status === 'Maintenance').length || 0 
        },
        revenueThisMonth,
        expensesThisMonth,
        netProfit: revenueThisMonth - expensesThisMonth,
        fuelConsumptionLiters: 4200, // Placeholder as consumption log is complex
        pendingMaintenanceCount: 5,
        lowStockCount: inventory?.filter(i => i.quantityAvailable < 10).length || 0,
        onlineDriverCount: locations?.filter(l => l.isOnline).length || 0,
        completedDeliveriesThisMonth: trips?.filter(t => t.status === 'delivered').length || 0,
      };
      const result = await getCeoAiInsights(data);
      setInsight(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-2xl border-none shadow-xl bg-gradient-to-br from-white to-primary/5 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white">
            <Sparkles className="size-4" />
          </div>
          <CardTitle className="text-xl font-headline tracking-tighter">AI Fleet Insights</CardTitle>
        </div>
        <Button 
          onClick={generate} 
          disabled={loading}
          size="sm" 
          variant="outline"
          className="rounded-full border-primary text-primary hover:bg-primary hover:text-white"
        >
          {loading ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4 mr-2" />}
          {insight ? 'Regenerate' : 'Analyze Fleet'}
        </Button>
      </CardHeader>
      
      <CardContent className="pt-4">
        {!insight && !loading && (
          <div className="py-12 flex flex-col items-center text-center space-y-4">
            <div className="size-16 rounded-full bg-accent/20 flex items-center justify-center text-accent">
              <Sparkles className="size-8" />
            </div>
            <div className="max-w-xs">
              <p className="font-headline text-lg">Harness Fleet Intelligence</p>
              <p className="text-sm text-muted-foreground">Click the button above to analyze live data and generate actionable recommendations.</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4 py-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        )}

        {insight && !loading && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="size-5" />
                <h3 className="font-headline text-sm uppercase tracking-widest">Key Highlights</h3>
              </div>
              <ul className="space-y-2">
                {insight.keyHighlights.map((h, i) => (
                  <li key={i} className="text-sm bg-emerald-50 p-3 rounded-xl border border-emerald-100">{h}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="size-5" />
                <h3 className="font-headline text-sm uppercase tracking-widest">Areas of Concern</h3>
              </div>
              <ul className="space-y-2">
                {insight.areasOfConcern.map((c, i) => (
                  <li key={i} className="text-sm bg-amber-50 p-3 rounded-xl border border-amber-100">{c}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-blue-600">
                <Target className="size-5" />
                <h3 className="font-headline text-sm uppercase tracking-widest">Actionable Recommendations</h3>
              </div>
              <ul className="space-y-2">
                {insight.actionableRecommendations.map((r, i) => (
                  <li key={i} className="text-sm bg-blue-50 p-3 rounded-xl border border-blue-100">{r}</li>
                ))}
              </ul>
            </section>
            
            <p className="text-[10px] text-muted-foreground text-center">Last analyzed: {new Date().toLocaleTimeString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
