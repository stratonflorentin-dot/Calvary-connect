"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { toast } from "@/hooks/use-toast";
import { PageShell, PageHeader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Settings2, Pencil, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Rule = {
  rule_code: string;
  name: string;
  description: string | null;
  severity: "low" | "medium" | "high";
  weight: number;
  threshold: Record<string, number>;
  enabled: boolean;
  effective_date: string;
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-muted text-muted-foreground",
};

export default function FuelFraudRulesPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState<{ severity: string; weight: string; threshold: string }>({ severity: "medium", weight: "1", threshold: "{}" });
  const [saving, setSaving] = useState(false);

  const canManage = ["CEO", "ADMIN", "OPERATOR"].includes(role ?? "");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("fuel_fraud_rules").select("*").order("rule_code");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRules(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleEnabled = async (rule: Rule) => {
    if (!canManage) return;
    const { error } = await supabase
      .from("fuel_fraud_rules")
      .update({ enabled: !rule.enabled, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
      .eq("rule_code", rule.rule_code);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setRules((prev) => prev.map((r) => (r.rule_code === rule.rule_code ? { ...r, enabled: !r.enabled } : r)));
  };

  const openEdit = (rule: Rule) => {
    setEditing(rule);
    setForm({ severity: rule.severity, weight: String(rule.weight), threshold: JSON.stringify(rule.threshold ?? {}, null, 2) });
  };

  const save = async () => {
    if (!editing) return;
    let threshold: Record<string, number>;
    try {
      threshold = JSON.parse(form.threshold || "{}");
    } catch {
      toast({ title: "Invalid threshold", description: "Threshold must be valid JSON.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("fuel_fraud_rules")
      .update({
        severity: form.severity,
        weight: Number(form.weight) || 1,
        threshold,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("rule_code", editing.rule_code);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Rule updated", description: editing.name });
    setEditing(null);
    load();
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Fleet"
        title="Fuel Fraud Rule Configuration"
        subtitle="Enable/disable rules and tune their severity, weight, and thresholds"
        icon={Settings2}
        crumbs={[{ label: "Fleet", href: "/fleet" }, { label: "Fuel Anomalies", href: "/fleet/fuel-anomalies" }, { label: "Rules" }]}
        actions={
          <Link href="/fleet/fuel-anomalies">
            <Button variant="outline"><ArrowLeft className="size-4 mr-2" /> Back</Button>
          </Link>
        }
      />

      {!canManage && (
        <Card className="mb-4">
          <CardContent className="p-4 text-sm text-muted-foreground">
            You can view rule configuration but only CEO/ADMIN/OPERATOR can change it.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead className="text-center">Enabled</TableHead>
                {canManage && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.rule_code}>
                    <TableCell>
                      <p className="font-medium text-sm">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                    </TableCell>
                    <TableCell><Badge className={cn(SEVERITY_STYLES[rule.severity], "capitalize")}>{rule.severity}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-sm">{rule.weight}</TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">{JSON.stringify(rule.threshold)}</code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={rule.enabled} onCheckedChange={() => toggleEnabled(rule)} disabled={!canManage} />
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Weight (contribution to combined risk score)</Label>
              <Input type="number" step="0.5" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Threshold (JSON)</Label>
              <textarea
                className="w-full h-32 rounded-lg border border-input bg-card px-3 py-2 text-xs font-mono text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
