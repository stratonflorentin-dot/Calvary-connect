"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export function ExternalPanel({ title, eyebrow, onClose, children }: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl">
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-0.5 text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8" onClick={onClose} aria-label={`Close ${title}`}>
          <X className="h-4 w-4" />
        </Button>
      </header>
      <div className="max-h-[min(65vh,34rem)] overflow-y-auto p-4">{children}</div>
    </section>
  );
}

export function ExternalPanelSkeleton({ title }: { title: string }) {
  return <section className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-card/95 p-4 shadow-xl" role="status" aria-label={`Loading ${title}`}>
    <div className="mb-4 h-4 w-36 animate-pulse rounded bg-muted" />
    <div className="mb-3 h-28 animate-pulse rounded-xl bg-muted" />
    <div className="space-y-2">{[0, 1, 2].map((row) => <div key={row} className="h-9 animate-pulse rounded-lg bg-muted" />)}</div>
  </section>;
}

export async function getExternal<T>(url: string): Promise<{ data?: T; fetchedAt?: string; source?: string; effectiveDate?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { error: "Sign in to load external data." };
    const response = await fetch(url, { headers: { authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok || result.success !== true) return { error: result.error?.message ?? `Request failed (${response.status})` };
    return { data: result.data as T, fetchedAt: result.meta?.fetchedAt, source: result.meta?.source, effectiveDate: result.meta?.effectiveDate };
  } catch {
    return { error: "Could not load external data." };
  }
}

export function UpdatedAt({ value }: { value?: string }) {
  if (!value) return null;
  return <p className="text-[11px] text-muted-foreground">Updated {new Date(value).toLocaleString()}</p>;
}
