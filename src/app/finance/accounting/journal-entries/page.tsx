"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClipboardList, ArrowLeft } from "lucide-react";

export default function JournalEntriesPage() {
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
            <ClipboardList className="size-5" /> Journal Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Journal entries page - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
