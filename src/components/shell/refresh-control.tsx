"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface RefreshControlProps {
  onRefresh: () => Promise<unknown> | unknown;
  /** Enable an auto-refresh timer for real-time views. Value in seconds. */
  autoSeconds?: number;
  /** Persist auto toggle in localStorage keyed on this identifier. */
  storageKey?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Standard refresh button. Shows the last-refreshed time, an optional
 * auto-refresh toggle (e.g. 30s for the dispatch board), and manages the
 * timer + loading state so the page doesn't have to.
 */
export function RefreshControl({
  onRefresh,
  autoSeconds,
  storageKey,
  compact = false,
  className,
}: RefreshControlProps) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Date>(new Date());
  const [auto, setAuto] = useState<boolean>(() => {
    if (!storageKey || typeof window === "undefined") return false;
    return window.localStorage.getItem(`cv-auto-refresh:${storageKey}`) === "1";
  });
  const [, forceTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
      setLast(new Date());
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(`cv-auto-refresh:${storageKey}`, auto ? "1" : "0");
  }, [auto, storageKey]);

  useEffect(() => {
    if (!auto || !autoSeconds) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(run, autoSeconds * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, autoSeconds]);

  // Tick the "N seconds ago" label once per 15s.
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!compact && (
        <div className="text-[10px] text-muted-foreground text-right leading-tight">
          Updated
          <br />
          <span className="font-bold text-foreground">
            {formatDistanceToNow(last, { addSuffix: true })}
          </span>
        </div>
      )}
      {autoSeconds && (
        <button
          onClick={() => setAuto((v) => !v)}
          className={cn(
            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border transition-colors",
            auto
              ? "border-primary bg-[hsl(var(--primary-soft))] text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
          title={`Auto refresh every ${autoSeconds}s`}
        >
          Auto {autoSeconds}s
        </button>
      )}
      <Button variant="outline" size="sm" onClick={run} disabled={busy} className="h-9 gap-2">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        Refresh
      </Button>
    </div>
  );
}
