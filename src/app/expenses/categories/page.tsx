"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChartOfAccountsService, COAAccount } from "@/services/chart-of-accounts-service";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Archive, ArchiveRestore, Loader2, Plus, Tags } from "lucide-react";

const CAN_MANAGE_ROLES = ["CEO", "ADMIN", "ACCOUNTANT"];

interface Category {
  id: string;
  name: string;
  default_account_code: string | null;
  status: "active" | "archived";
}

export default function ExpenseCategoriesPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const canManage = CAN_MANAGE_ROLES.includes(String(role || "").toUpperCase());

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<COAAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [defaultAccountCode, setDefaultAccountCode] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("expense_categories").select("*").order("name");
    setCategories((data as Category[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    ChartOfAccountsService.getAccounts().then((a) =>
      setAccounts(a.filter((x) => x.is_postable !== false && ["COST_OF_SALES", "OPERATING_EXPENSES", "OTHER_EXPENSES"].includes(x.category || ""))),
    );
  }, []);

  const openNew = () => {
    setEditing(null);
    setName("");
    setDefaultAccountCode("");
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setDefaultAccountCode(c.default_account_code || "");
    setDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("expense_categories")
          .update({ name: name.trim(), default_account_code: defaultAccountCode || null })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("expense_categories")
          .insert({ name: name.trim(), default_account_code: defaultAccountCode || null, created_by: user?.id ?? null });
        if (error) throw error;
      }
      toast({ variant: "success", title: editing ? "Category updated" : "Category created" });
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (c: Category) => {
    const nextStatus = c.status === "active" ? "archived" : "active";
    const { error } = await supabase.from("expense_categories").update({ status: nextStatus }).eq("id", c.id);
    if (error) {
      toast({ title: "Couldn't update status", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: nextStatus === "archived" ? "Category archived" : "Category restored" });
    load();
  };

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <Link href="/expenses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
                <ArrowLeft className="size-4" /> Back to Expenses
              </Link>
              <h1 className="text-2xl md:text-3xl font-headline tracking-tighter flex items-center gap-2">
                <Tags className="size-6 text-primary" /> Expense Categories
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Picking a category on the expense form pre-fills its default ledger account — still overridable per expense.
              </p>
            </div>
            {canManage && (
              <Button onClick={openNew} className="gap-2">
                <Plus className="size-4" /> New Category
              </Button>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">No categories yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted border-b border-border">
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-5 py-2">Name</th>
                    <th className="px-4 py-2">Default Account</th>
                    <th className="px-4 py-2">Status</th>
                    {canManage && <th className="px-5 py-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/60">
                      <td className="px-5 py-2.5 font-semibold text-foreground">{c.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {c.default_account_code
                          ? `${c.default_account_code} · ${accounts.find((a) => a.code === c.default_account_code)?.name ?? ""}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                      </td>
                      {canManage && (
                        <td className="px-5 py-2.5 text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toggleArchive(c)}>
                            {c.status === "active" ? <Archive className="size-3.5" /> : <ArchiveRestore className="size-3.5" />}
                            {c.status === "active" ? "Archive" : "Restore"}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fuel" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Default ledger account</Label>
              <Select value={defaultAccountCode} onValueChange={setDefaultAccountCode}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
