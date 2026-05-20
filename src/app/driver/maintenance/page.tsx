"use client";

import { useEffect, useState } from "react";
import { DriverShell } from "@/components/driver/driver-shell";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { uploadToBucket } from "@/lib/storage-upload";
import { createNotification } from "@/services/notification-service";

type MaintenanceRow = Record<string, unknown>;

function rowStatus(r: MaintenanceRow): string {
  const s = String(r.status || "pending").toLowerCase().replace(/_/g, " ");
  const map: Record<string, string> = {
    pending: "Pending",
    "in progress": "In Review",
    in_review: "In Review",
    approved: "Approved",
    completed: "Completed",
  };
  return map[s.replace(/\s/g, "_")] || map[s] || s;
}

function rowIssue(r: MaintenanceRow): string {
  return String(r.issue_description || r.description || r.part_name || "—");
}

export default function DriverMaintenancePage() {
  const { user } = useSupabase();
  const [requests, setRequests] = useState<MaintenanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [urgency, setUrgency] = useState("medium");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("maintenance_requests")
      .select("*")
      .or(`driver_id.eq.${user.id},user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const issue = String(form.get("issue") || "");
    const plate = String(form.get("plate") || "");

    const photoUrls: string[] = [];
    for (const file of photos) {
      const url = await uploadToBucket(
        "vehicle-documents",
        "maintenance",
        file,
      );
      if (url) photoUrls.push(url);
    }

    let vehicleId: string | null = null;
    if (plate) {
      const { data: vehicles } = await supabase
        .from("vehicles")
        .select("id")
        .ilike("plate_number", `%${plate}%`)
        .limit(1);
      vehicleId = vehicles?.[0]?.id || null;
    }

    const payload: Record<string, unknown> = {
      driver_id: user.id,
      user_id: user.id,
      vehicle_id: vehicleId,
      issue_description: issue,
      description: issue,
      priority: urgency.toUpperCase(),
      urgency,
      status: "pending",
      photo_urls: photoUrls.length ? photoUrls : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reported_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("maintenance_requests").insert([payload]);
    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const { data: mechanics } = await supabase
      .from("user_profiles")
      .select("id")
      .in("role", ["MECHANIC", "ADMIN", "CEO"]);
    await Promise.all(
      (mechanics || []).map((m) =>
        createNotification({
          userId: m.id,
          category: "maintenance_update",
          title: "New maintenance request",
          message: `Driver submitted: ${issue.slice(0, 80)}`,
          severity: "warning",
        }),
      ),
    );

    toast({ title: "Request submitted", description: "Mechanics have been notified." });
    (e.target as HTMLFormElement).reset();
    setPhotos([]);
    load();
  };

  return (
    <DriverShell
      title="Maintenance"
      description="Report truck issues, upload photos, and track repair status."
    >
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="plate">Vehicle plate</Label>
              <Input id="plate" name="plate" placeholder="e.g. T 123 ABC" required />
            </div>
            <div>
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="issue">Describe the issue</Label>
              <Textarea id="issue" name="issue" required rows={4} />
            </div>
            <div>
              <Label>Vehicle photos</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(ev) =>
                  setPhotos(Array.from(ev.target.files || []))
                }
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              <Wrench className="size-4" />
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="font-semibold mb-3">Maintenance history</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests yet.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={String(r.id)}>
              <CardContent className="py-4">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-medium">{rowIssue(r)}</p>
                    {r.mechanic_notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Mechanic: {String(r.mechanic_notes)}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">{rowStatus(r)}</Badge>
                </div>
                {Array.isArray(r.photo_urls) && r.photo_urls.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {(r.photo_urls as string[]).map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="h-16 w-16 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DriverShell>
  );
}
