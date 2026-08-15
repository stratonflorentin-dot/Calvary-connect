"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { applyTransition, availableTransitions } from "@/lib/workflow/engine";
import type { EntityKind, Transition } from "@/lib/workflow/state-machines";
import type { UserRole } from "@/types/roles";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { hoverLift, pressScale, TRANSITION } from "@/lib/animations";

interface TransitionButtonsProps {
  kind: EntityKind;
  entity: { id: string; status?: string; [k: string]: any };
  actorId: string;
  actorRole?: UserRole;
  onDone?: (nextEntity: any) => void;
  size?: "sm" | "md";
  layout?: "row" | "stack";
  /** Target states to omit from the button list (e.g. one that needs a custom modal). */
  exclude?: string[];
}

const intentClasses: Record<NonNullable<Transition["intent"]>, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  success:
    "bg-success text-success-foreground hover:bg-success/90 shadow-sm",
  danger:
    "border border-destructive/30 bg-card text-destructive hover:bg-destructive/10",
  neutral:
    "border border-border bg-card text-foreground hover:bg-muted",
};

export function TransitionButtons({
  kind,
  entity,
  actorId,
  actorRole,
  onDone,
  size = "md",
  layout = "row",
  exclude,
}: TransitionButtonsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const currentStatus = String(entity.status ?? "").toLowerCase();
  const all = availableTransitions(kind, currentStatus, actorRole);
  const list = exclude ? all.filter((t) => !exclude.includes(t.to)) : all;

  if (list.length === 0) return null;

  const trigger = async (t: Transition) => {
    let reason: string | undefined;
    if (t.requireReason) {
      const answer = window.prompt(`Reason for "${t.label}"?`);
      if (!answer) return;
      reason = answer;
    }
    setBusy(t.to);
    const result = await applyTransition({
      kind,
      entityId: entity.id,
      toState: t.to,
      actorId,
      actorRole,
      payload: { reason },
    });
    setBusy(null);

    if (!result.ok) {
      toast({
        title: t.label + " failed",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      variant: "success",
      title: t.label,
      description:
        result.sideEffects.length > 0
          ? `Done — ${result.sideEffects.map((s) => s.replace(/_/g, " ")).join(", ")}.`
          : "Status updated.",
    });
    onDone?.(result.entity);
  };

  return (
    <div className={cn(layout === "row" ? "flex flex-wrap gap-2" : "flex flex-col gap-2")}>
      <AnimatePresence mode="popLayout">
        {list.map((t) => {
          const cls = intentClasses[t.intent ?? "neutral"];
          return (
            <motion.button
              key={t.to + "|" + t.label}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={TRANSITION.micro}
              whileHover={busy === null ? hoverLift : undefined}
              whileTap={busy === null ? pressScale : undefined}
              onClick={() => trigger(t)}
              disabled={busy !== null}
              title={t.description}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50",
                size === "sm" ? "text-xs px-3 py-1.5" : "text-sm px-4 py-2",
                cls,
              )}
            >
              {busy === t.to && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t.label}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
