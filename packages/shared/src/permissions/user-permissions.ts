import type { Role } from "../constants/roles";
import { PROMOTABLE_ROLES } from "../schemas/user.schema";

type PromotableRole = (typeof PROMOTABLE_ROLES)[number];

// Roles each actor may deactivate. Nobody deactivates their own role level or
// above, so an admin can't touch another admin or a super_admin — only a
// super_admin can (and never themselves, see canDeactivateUser).
const DEACTIVATABLE_BY: Partial<Record<Role, readonly Role[]>> = {
  admin: ["driver", "supervisor"],
  super_admin: ["driver", "supervisor", "admin", "super_admin"],
};

// Roles each actor may assign when approving a pending registration. Granting
// a role at or above your own would be self-service privilege escalation (the
// same reason role changes and invitations are super_admin-only).
const ASSIGNABLE_ON_APPROVAL: Partial<Record<Role, readonly PromotableRole[]>> = {
  supervisor: ["driver"],
  admin: ["driver", "supervisor"],
  super_admin: PROMOTABLE_ROLES,
};

export function canDeactivateUser(
  actor: { id: string; role: Role },
  target: { id: string; role: Role },
): boolean {
  if (actor.id === target.id) return false;
  return DEACTIVATABLE_BY[actor.role]?.includes(target.role) ?? false;
}

export function assignableRolesOnApproval(actorRole: Role): readonly PromotableRole[] {
  return ASSIGNABLE_ON_APPROVAL[actorRole] ?? [];
}
