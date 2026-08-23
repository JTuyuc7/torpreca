import { AUDIT_EVENTS } from "../constants/audit-events";
import { z } from "../zod";

export const AuditLogSchema = z.object({
  id: z.uuid(),
  userId: z.uuid().nullable(),
  role: z.string().nullable(),
  action: z.enum(AUDIT_EVENTS),
  entity: z.string().nullable(),
  entityId: z.uuid().nullable(),
  ip: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// Shape passed to core/audit/log-event.ts when recording an event.
export const CreateAuditLogSchema = AuditLogSchema.pick({
  userId: true,
  role: true,
  action: true,
  entity: true,
  entityId: true,
  ip: true,
  metadata: true,
});

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;
