import type { CreateUserInput, User } from "@torpreca/shared";
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
    active: row.active as boolean,
    deactivatedAt: row.deactivated_at as string | null,
    deactivatedBy: row.deactivated_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface UsersRepository {
  list(onlyActive?: boolean): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  getByAuthUserId(authUserId: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  deactivate(id: string, deactivatedBy: string): Promise<void>;
}

export const usersRepository: UsersRepository = {
  async list(onlyActive = true) {
    let query = supabaseAdmin
      .rpc("get_users_readable", { p_secret_key: env.SECRET_KEY })
      .order("created_at");
    if (onlyActive) query = query.eq("active", true);

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

  async create(input) {
    const { data, error } = await supabaseAdmin
      .rpc("create_user_encrypted", {
        p_auth_user_id: input.authUserId,
        p_name: input.name,
        p_role: input.role,
        p_secret_key: env.SECRET_KEY,
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
        active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: deactivatedBy,
      })
      .eq("id", id);
    if (error) throw error;
  },
};
