"use client";

import { useEffect, useState } from "react";
import { AuditTrailService, type AuditEntityType } from "@/services/audit-trail-service";
import { formatDistanceToNow } from "date-fns";
import {
  CircleCheck,
  CircleX,
  Clock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Undo2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityFeedProps {
  entityType: AuditEntityType;
  entityId: string;
  limit?: number;
  className?: string;
}

const actionMeta: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  create: { icon: Plus, color: "text-emerald-600 bg-emerald-50", label: "Created" },
  update: { icon: Pencil, color: "text-sky-600 bg-sky-50", label: "Updated" },
  delete: { icon: Trash2, color: "text-red-600 bg-red-50", label: "Deleted" },
  approve: { icon: CircleCheck, color: "text-emerald-600 bg-emerald-50", label: "Approved" },
  reject: { icon: CircleX, color: "text-red-600 bg-red-50", label: "Rejected" },
  convert: { icon: Undo2, color: "text-indigo-600 bg-indigo-50", label: "Converted" },
  verify: { icon: ShieldCheck, color: "text-emerald-600 bg-emerald-50", label: "Verified" },
  view: { icon: User, color: "text-slate-500 bg-slate-50", label: "Viewed" },
};

export function ActivityFeed({ entityType, entityId, limit = 25, className }: ActivityFeedProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await AuditTrailService.getEntityLogs(entityType, entityId, limit);
      if (!cancelled) {
        setLogs(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, limit]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Clock className="w-4 h-4 animate-pulse" /> Loading activity…
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ol className={cn("relative border-l-2 border-slate-100 pl-6 space-y-4", className)}>
      {logs.map((log) => {
        const meta = actionMeta[log.action] ?? actionMeta.update;
        const Icon = meta.icon;
        return (
          <li key={log.id} className="relative">
            <span
              className={cn(
                "absolute -left-[34px] top-0 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white",
                meta.color,
              )}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold text-slate-700">{meta.label}</span>
              <span className="text-xs text-muted-foreground">
                {log.timestamp
                  ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })
                  : ""}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-0.5">{log.description}</p>
            {log.user_id && (
              <p className="text-xs text-muted-foreground mt-0.5">
                by <span className="font-mono">{log.user_id.slice(0, 8)}</span>
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
