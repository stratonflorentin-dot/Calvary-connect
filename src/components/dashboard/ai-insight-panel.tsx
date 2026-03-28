"use client";

import { useState } from 'react';
import { getCeoAiInsights, CeoAiInsightsOutput } from '@/ai/flows/ceo-ai-insights';
import { useSupabase } from '@/components/supabase-provider';
import { useRole } from '@/hooks/use-role';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, CheckCircle2, AlertCircle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/hooks/use-language';

export function AiInsightPanel() {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<CeoAiInsightsOutput | null>(null);
  const { user } = useSupabase();
  const { role } = useRole();
  const { t } = useLanguage();

  const generate = async () => {
    setLoading(true);
    try {
      // Load comprehensive real data for analysis
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthStart = `${currentMonth}-01`;
      const monthEnd = `${currentMonth}-31`;
      
      // Real fleet data
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('plate_number, status, mileage, created_at');
      
      // Real trips data for current month
      const { data: currentTrips } = await supabase
        .from('trips')
        .select('*')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);
      
      // Real expenses data for current month
      const { data: currentExpenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);
      
      // Real driver data
      const { data: drivers } = await supabase
        .from('user_profiles')
        .select('id, created_at')
        .eq('role', 'driver');
      
      // Real maintenance data
      const { data: maintenanceRequests } = await supabase
        .from('maintenance_requests')
        .select('*')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);
      
      // Calculate real metrics
      const totalVehicles = vehicles?.length || 0;
      const activeVehicles = vehicles?.filter(v => v.status === 'active')?.length || 0;
      const completedTrips = currentTrips?.filter(t => t.status === 'completed')?.length || 0;
      const totalRevenue = currentTrips?.reduce((sum, trip) => sum + (trip.revenue || trip.price || 0), 0) || 0;
      const totalExpenses = currentExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
      const netProfit = totalRevenue - totalExpenses;
      const totalDrivers = drivers?.length || 0;
      const maintenanceCount = maintenanceRequests?.length || 0;
      
      // Analyze vehicle utilization
      const vehicleUtilization = totalVehicles > 0 ? (completedTrips / totalVehicles) * 100 : 0;
      
      // Analyze expense categories
      const expenseCategories = currentExpenses?.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + (exp.amount || 0);
        return acc;
      }, {} as Record<string, number>) || {};
      
      // Generate insights based only on real data
      const insights: CeoAiInsightsOutput = {
        summary: `Fleet Analysis: ${totalVehicles} vehicles, ${completedTrips} completed trips, ${netProfit >= 0 ? 'profitable' : 'loss'} of ${Math.abs(netProfit)}`,
        opportunities: [],
        risks: [],
        recommendations: []
      };
      
      // Add opportunities based on real data
      if (vehicleUtilization < 50 && totalVehicles > 0) {
        insights.opportunities.push(`Low vehicle utilization (${vehicleUtilization.toFixed(1)}%) - consider increasing trip assignments`);
      }
      
      if (totalRevenue > 0 && netProfit > 0) {
        insights.opportunities.push(`Profitable operations (${netProfit} profit) - consider scaling successful routes`);
      }
      
      // Add risks based on real data
      if (netProfit < 0) {
        insights.risks.push(`Operating loss of ${Math.abs(netProfit)} - requires immediate cost review`);
      }
      
      if (maintenanceCount > totalVehicles * 0.3) {
        insights.risks.push(`High maintenance volume (${maintenanceCount} requests) - may indicate vehicle aging issues`);
      }
      
      // Add recommendations based on real data
      if (totalVehicles === 0) {
        insights.recommendations.push('Add vehicles to your fleet to begin operations');
      }
      
      if (completedTrips === 0 && totalVehicles > 0) {
        insights.recommendations.push('Create and assign trips to generate revenue');
      }
      
      if (totalExpenses > 0 && netProfit < 0) {
        insights.recommendations.push('Review and optimize expense categories to improve profitability');
      }
      
      // If no specific insights, provide factual summary
      if (insights.opportunities.length === 0 && insights.risks.length === 0 && insights.recommendations.length === 0) {
        insights.recommendations.push('Continue monitoring fleet performance metrics');
      }
      
      setInsight(insights);
    } catch (error) {
      console.error('Error generating AI insights:', error);
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
          <CardTitle className="text-xl font-headline tracking-tighter">{t.ai_insights}</CardTitle>
        </div>
        <Button 
          onClick={generate} 
          disabled={loading || !role}
          size="sm" 
          variant="outline"
          className="rounded-full border-primary text-primary hover:bg-primary hover:text-white"
        >
          {loading ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4 mr-2" />}
          {insight ? 'Regenerate' : t.analyze_fleet}
        </Button>
      </CardHeader>
      
      <CardContent className="pt-4">
        {!insight && !loading && (
          <div className="py-12 flex flex-col items-center text-center space-y-4">
            <div className="size-16 rounded-full bg-accent/20 flex items-center justify-center text-accent">
              <Sparkles className="size-8" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">AI Fleet Analysis</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Get intelligent insights about your fleet performance, opportunities, and risks powered by AI.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <div className="pt-4 space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        )}

        {insight && !loading && (
          <div className="space-y-6">
            <div className="p-4 bg-primary/5 rounded-xl border-l-4 border-primary">
              <p className="text-sm leading-relaxed">{insight.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <Target className="size-4" />
                  <h4 className="font-semibold text-sm">Opportunities</h4>
                </div>
                <ul className="space-y-2">
                  {insight.opportunities.map((opp, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{opp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="size-4" />
                  <h4 className="font-semibold text-sm">Risks</h4>
                </div>
                <ul className="space-y-2">
                  {insight.risks.map((risk, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="size-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-600">
                <Sparkles className="size-4" />
                <h4 className="font-semibold text-sm">Recommendations</h4>
              </div>
              <ul className="space-y-2">
                {insight.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm p-2 bg-blue-50 rounded-lg">
                    <CheckCircle2 className="size-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
