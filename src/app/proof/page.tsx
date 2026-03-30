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
import { Upload, FileImage, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export default function DeliveryProofPage() {
  const { user } = useSupabase();
  const { role } = useRole();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user || !role) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate upload delay
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Proof Uploaded",
        description: "Your delivery proof has been secured and attached to the trip.",
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
            <h1 className="text-2xl font-headline tracking-tighter">Delivery Proof</h1>
            <p className="text-muted-foreground">Upload confirmation documents and photos for completed trips.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Submit New Proof</CardTitle>
              <CardDescription>Attach files to verify successful delivery</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="tripId">Trip Reference / ID</Label>
                  <Input id="tripId" placeholder="e.g. TRP-2024-001" required />
                </div>
                
                <div className="space-y-2">
                  <Label>Proof Document / Photo</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                    <Upload className="size-8 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">SVG, PNG, JPG or PDF (max. 5MB)</p>
                    <Input type="file" className="hidden" id="file-upload" accept="image/*,.pdf" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (Optional)</Label>
                  <Textarea id="notes" placeholder="Any remarks regarding the delivery condition..." className="resize-none" rows={3} />
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Submit Proof
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
