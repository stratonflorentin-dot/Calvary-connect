import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Provenance log for AI-generated output — distinct from AuditTrailService,
 * which diffs business-entity mutations (old_value/new_value on create/
 * update/approve). This records what the AI was asked, what data it drew on,
 * what it concluded, and how confident it was — always written server-side
 * with the service-role client (never from the browser), same as fuel-fraud
 * detection's own writes.
 */
export interface AIAuditEntry {
  userId?: string;
  flowName: string;
  entityType?: string;
  entityId?: string;
  requestSummary?: string;
  toolsUsed?: string[];
  recordsQueried?: Record<string, any>;
  output: Record<string, any>;
  confidence?: "high" | "medium" | "low";
  model?: string;
}

export class AIAuditService {
  static async log(admin: SupabaseClient, entry: AIAuditEntry): Promise<void> {
    try {
      const { error } = await admin.from("ai_audit_log").insert([{
        user_id: entry.userId ?? null,
        flow_name: entry.flowName,
        entity_type: entry.entityType ?? null,
        entity_id: entry.entityId ?? null,
        request_summary: entry.requestSummary ?? null,
        tools_used: entry.toolsUsed ?? [],
        records_queried: entry.recordsQueried ?? {},
        output: entry.output,
        confidence: entry.confidence ?? null,
        model: entry.model ?? null,
      }]);
      if (error) console.error("[AIAudit] Failed to log AI call:", error);
    } catch (err) {
      console.error("[AIAudit] Error logging AI call:", err);
    }
  }
}
