import type { CreateUserInput, User, UserStatus } from "@torpreca/shared";
import { env } from "../../core/config/env";
import { supabaseAdmin } from "../../core/db/supabase";

// The only layer that touches supabase-js for this entity. Reads go through the
// `get_users_readable` RPC (decrypts `name`); writes go through `create_user_encrypted`
// (encrypts `name`) — plain insert/select can't touch that column directly.
// Supabase doesn't allow persisting a custom GUC at the role/database level on the
// hosted platform (ALTER DATABASE/ALTER ROLE ... SET both fail with permission denied),
// so the secret key is passed as an RPC argument instead — only the backend's
// service_role key ever calls these functions.
function toUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    authUserId: row.auth_user_id as string,
    name: row.name as string,
    role: row.role as User["role"],
    status: row.status as UserStatus,
    deactivatedAt: row.deactivated_at as string | null,
    deactivatedBy: row.deactivated_by as string | null,
    reviewedAt: row.reviewed_at as string | null,
    reviewedBy: row.reviewed_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface UsersRepository {
  // `undefined`/omitted defaults to "active" (today's behavior); pass "all"
  // for no filter, or an exact status (e.g. "pending", for the dashboard's
  // approval queue).
  list(status?: UserStatus | "all"): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  getByAuthUserId(authUserId: string): Promise<User | null>;
  create(input: CreateUserInput, status?: UserStatus): Promise<User>;
  deactivate(id: string, deactivatedBy: string): Promise<void>;
  review(id: string, decision: "approve" | "reject", reviewedBy: string): Promise<void>;
}

export const usersRepository: UsersRepository = {
  async list(status = "active") {
    let query = supabaseAdmin
      .rpc("get_users_readable", { p_secret_key: env.SECRET_KEY })
      .order("created_at");
    if (status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;
    return data.map(toUser);
  },

  async getById(id) {
    const { data, error } = await supabaseAdmin
      .rpc("get_users_readable", { p_secret_key: env.SECRET_KEY })
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toUser(data as Record<string, unknown>) : null;
  },

  async getByAuthUserId(authUserId) {
    const { data, error } = await supabaseAdmin
      .rpc("get_users_readable", { p_secret_key: env.SECRET_KEY })
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error) throw error;
    return data ? toUser(data as Record<string, unknown>) : null;
  },

  async create(input, status = "active") {
    const { data, error } = await supabaseAdmin
      .rpc("create_user_encrypted", {
        p_auth_user_id: input.authUserId,
        p_name: input.name,
        p_role: input.role,
        p_secret_key: env.SECRET_KEY,
        p_status: status,
      })
      .single();
    if (error) throw error;

    const row = data as Record<string, unknown>;
    return toUser({ ...row, name: input.name });
  },

  async deactivate(id, deactivatedBy) {
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        status: "deactivated",
        deactivated_at: new Date().toISOString(),
        deactivated_by: deactivatedBy,
      })
      .eq("id", id);
    if (error) throw error;
  },

  async review(id, decision, reviewedBy) {
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        status: decision === "approve" ? "active" : "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
      })
      .eq("id", id);
    if (error) throw error;
  },
};
