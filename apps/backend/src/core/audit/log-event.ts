import type { CreateAuditLogInput } from "@torpreca/shared";
import { supabaseAdmin } from "../db/supabase";

export async function logEvent(input: CreateAuditLogInput): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    user_id: input.userId,
    role: input.role,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId,
    ip: input.ip,
    metadata: input.metadata,
  });

  // Don't fail the request if logging fails — but leave a trace in the console.
  if (error) console.error("audit_logs insert failed:", error);
}
