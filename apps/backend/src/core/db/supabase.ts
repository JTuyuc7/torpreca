import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";

// service_role key: bypasses RLS by design. The only client the backend should use.
// Never expose this client or the key outside the repository layer.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});