"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Wrench, ArrowLeft } from "lucide-react";

export default function MaintenanceCostsPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="size-5" /> Maintenance Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Maintenance costs page - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
