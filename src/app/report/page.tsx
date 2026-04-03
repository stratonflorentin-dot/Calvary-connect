"use client";

import { useSupabase } from '@/components/supabase-provider';
import { useRole } from '@/hooks/use-role';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Wrench } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export default function MaintenanceReportPage() {
  const { user } = useSupabase();
  const { role } = useRole();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user || !role) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate submission delay
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Report Submitted",
        description: "Your maintenance request has been logged and sent to mechanics.",
      });
      (e.target as HTMLFormElement).reset();
    }, 1500);
  };

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-headline tracking-tighter">Maintenance Report</h1>
            <p className="text-muted-foreground">Report vehicle breakdowns or request routine maintenance.</p>
          </div>

          <Card className="border-amber-200 shadow-sm">
            <CardHeader className="bg-amber-50/50 rounded-t-xl border-b border-amber-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-lg text-amber-900">Vehicle Issue</CardTitle>
                  <CardDescription className="text-amber-700/70">Please provide detailed information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="vehicleId">Vehicle License Plate</Label>
                  <Input id="vehicleId" placeholder="e.g. T 123 ABC" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgency">Urgency Level</Label>
                  <Select required defaultValue="medium">
                    <SelectTrigger id="urgency">
                      <SelectValue placeholder="Select urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Routine maintenance needed soon</SelectItem>
                      <SelectItem value="medium">Medium - Fix at earliest convenience</SelectItem>
                      <SelectItem value="high">High - Safety issue or affects performance</SelectItem>
                      <SelectItem value="critical">Critical - Breakdown / Cannot drive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Detailed Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Describe exactly what is wrong, strange noises, apparent damage, etc..." 
                    className="resize-none" 
                    rows={4} 
                    required 
                  />
                </div>

                <Button type="submit" className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Wrench className="size-4" />
                      Submit Maintenance Request
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <BottomTabs role={role} />
    </div>
  );
}
