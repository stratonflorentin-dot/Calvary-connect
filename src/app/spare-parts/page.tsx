"use client";

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { SupabaseService } from '@/services/supabase-service';
import { IndustryRoleShell } from '@/components/role-shell/industry-role-shell';
import { IndustryShell } from '@/components/industry/shell';
import { IndustryCard } from '@/components/industry/card';
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from '@/components/industry/table';
import { IndustryTag } from '@/components/industry/tag';
import { IndustryButton } from '@/components/industry/button';
import {
  IndustryDialog,
  IndustryDialogTrigger,
  IndustryDialogContent,
  IndustryDialogTitle,
} from '@/components/industry/dialog';
import { Package, Plus } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

const MECHANIC_PAGES = [
  { label: "Service queue", href: "/mechanic/service-queue" },
  { label: "Spare parts", href: "/spare-parts" },
  { label: "Service history", href: "/mechanic/service-history" },
  { label: "Schedule", href: "/mechanic/schedule" },
];

const fieldClass = "w-full text-[14px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[7px] outline-none focus-visible:border-[var(--ci-accent)]";

function urgencyVariant(urgency: string): "danger" | "warning" | "neutral" {
  if (urgency === "High") return "danger";
  if (urgency === "Medium") return "warning";
  return "neutral";
}

function statusVariant(status: string): "accent" | "danger" | "warning" {
  if (status === "approved") return "accent";
  if (status === "rejected") return "danger";
  return "warning";
}

export default function MechanicSparePartsPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const { t } = useLanguage();
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const loadParts = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const { data: requests, error } = await supabase
          .from('parts_requests')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setParts(requests || []);
      } catch (error) {
        console.error('Error loading spare parts:', error);
      } finally {
        setLoading(false);
      }
    };
    loadParts();
  }, [user]);

  const handleCreateRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    try {
      await SupabaseService.createPartsRequest({
        part_name: formData.get('name') as string,
        quantity_requested: Number(formData.get('quantity')),
        urgency: formData.get('urgency') as string,
        reason: formData.get('reason') as string,
        status: 'pending',
        requested_by: user.id
      } as any);

      const { data: updatedRequests } = await supabase
        .from('parts_requests')
        .select('*')
        .order('created_at', { ascending: false });

      setParts(updatedRequests || []);
      setOpen(false);
      e.currentTarget.reset();
    } catch (error) {
      console.error('Error requesting part:', error);
    }
  };

  if (role && role !== 'MECHANIC') {
    return (
      <IndustryShell className="min-h-screen flex items-center justify-center">
        <IndustryCard className="max-w-md text-center">
          <h1 className="text-[22px]" style={{ fontFamily: "var(--font-barlow-condensed)", fontWeight: 600, color: "#8c1d18" }}>Access denied</h1>
          <p className="text-[13px] text-[var(--ci-text-secondary)] mt-1">You do not have permission to view mechanic spare parts.</p>
        </IndustryCard>
      </IndustryShell>
    );
  }

  return (
    <IndustryRoleShell roleLabel="Mechanic" pages={MECHANIC_PAGES}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">Track your requested components and service approvals.</p>
        <IndustryDialog open={open} onOpenChange={setOpen}>
          <IndustryDialogTrigger asChild>
            <IndustryButton variant="primary" className="gap-1.5">
              <Plus className="size-4" /> {t.request_parts}
            </IndustryButton>
          </IndustryDialogTrigger>
          <IndustryDialogContent open={open}>
            <IndustryDialogTitle>{t.request_parts}</IndustryDialogTitle>
            <form onSubmit={handleCreateRequest} className="flex flex-col gap-3 mt-2">
              <div>
                <label htmlFor="name" className="ci-lbl block mb-1">{t.part_name}</label>
                <input id="name" name="name" placeholder="E.g. Full Trailer Repaint or Alternator" required className={fieldClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="quantity" className="ci-lbl block mb-1">{t.quantity}</label>
                  <input id="quantity" name="quantity" type="number" defaultValue="1" required className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="urgency" className="ci-lbl block mb-1">{t.urgency}</label>
                  <select id="urgency" name="urgency" defaultValue="Medium" required className={fieldClass}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High (Immediate)</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="reason" className="ci-lbl block mb-1">{t.reason}</label>
                <textarea id="reason" name="reason" placeholder="Explain why this is needed..." required rows={3} className={fieldClass} />
              </div>
              <IndustryButton type="submit" variant="primary" className="w-full">{t.submit_request}</IndustryButton>
            </form>
          </IndustryDialogContent>
        </IndustryDialog>
      </div>

      <IndustryCard>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Item/Service</IndustryTh>
              <IndustryTh align="right">Quantity</IndustryTh>
              <IndustryTh>Urgency</IndustryTh>
              <IndustryTh>Status</IndustryTh>
              <IndustryTh align="right">Sent</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><IndustryTd className="text-center text-[var(--ci-text-tertiary)]">Loading requests…</IndustryTd></tr>
            ) : parts.length === 0 ? (
              <tr><IndustryTd className="text-center text-[var(--ci-text-tertiary)]">No requests made yet.</IndustryTd></tr>
            ) : (
              parts.map((r) => (
                <IndustryTr key={r.id}>
                  <IndustryTd>
                    <span className="flex items-center gap-2">
                      <Package className="size-3.5 text-[var(--ci-text-tertiary)]" />
                      {r.part_name}
                    </span>
                  </IndustryTd>
                  <IndustryTd align="right" mono>{r.quantity_requested}</IndustryTd>
                  <IndustryTd><IndustryTag variant={urgencyVariant(r.urgency)}>{r.urgency}</IndustryTag></IndustryTd>
                  <IndustryTd><IndustryTag variant={statusVariant(r.status)}>{String(r.status).toUpperCase()}</IndustryTag></IndustryTd>
                  <IndustryTd align="right" mono>{new Date(r.created_at).toLocaleDateString()}</IndustryTd>
                </IndustryTr>
              ))
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>
    </IndustryRoleShell>
  );
}
