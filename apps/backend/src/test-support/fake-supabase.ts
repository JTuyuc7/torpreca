// Minimal in-memory stand-in for the slice of supabase-js this backend uses
// (`.from().select/insert/update().eq/neq().order().single/maybeSingle()`,
// `.rpc()`, `.auth.getUser()`). Swapped in for `supabaseAdmin` via
// `mock.module("../../core/db/supabase", ...)` so repository and HTTP tests
// run without a real Supabase project. See TOR-75 plan.

export type Row = Record<string, unknown>;

type Filter = { op: "eq" | "neq"; col: string; val: unknown };

type PostgrestResult = { data: unknown; error: { message: string } | null };

export type RpcHandler = (tables: Record<string, Row[]>, args: Record<string, unknown>) => Row[];

class FakeQueryBuilder implements PromiseLike<PostgrestResult> {
  private op: "select" | "insert" | "update" = "select";
  private insertPayload: Row | null = null;
  private updatePayload: Row | null = null;
  private filters: Filter[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private terminal: "single" | "maybeSingle" | null = null;

  constructor(
    private readonly source: Row[],
    private readonly insertDefaults: Row = {},
  ) {}

  select(_columns?: string) {
    return this;
  }

  insert(payload: Row) {
    this.op = "insert";
    this.insertPayload = payload;
    return this;
  }

  update(payload: Row) {
    this.op = "update";
    this.updatePayload = payload;
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push({ op: "eq", col, val });
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push({ op: "neq", col, val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  single() {
    this.terminal = "single";
    return this;
  }

  maybeSingle() {
    this.terminal = "maybeSingle";
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => (f.op === "eq" ? row[f.col] === f.val : row[f.col] !== f.val));
  }

  private applyOrder(rows: Row[]): Row[] {
    if (!this.orderCol) return rows;
    const col = this.orderCol;
    const sorted = [...rows].sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      if (av === bv) return 0;
      return (av as string | number) < (bv as string | number) ? -1 : 1;
    });
    return this.orderAsc ? sorted : sorted.reverse();
  }

  private execute(): PostgrestResult {
    if (this.op === "insert" && this.insertPayload) {
      const now = new Date().toISOString();
      const row: Row = {
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
        ...this.insertDefaults,
        ...this.insertPayload,
      };
      this.source.push(row);
      return this.wrap([row]);
    }

    if (this.op === "update" && this.updatePayload) {
      const now = new Date().toISOString();
      const matched = this.source.filter((row) => this.matches(row));
      for (const row of matched) {
        Object.assign(row, this.updatePayload, { updated_at: now });
      }
      return this.wrap(matched);
    }

    const matched = this.applyOrder(this.source.filter((row) => this.matches(row)));
    return this.wrap(matched);
  }

  private wrap(rows: Row[]): PostgrestResult {
    if (this.terminal === "single") {
      if (rows.length !== 1) {
        return { data: null, error: { message: "fake-supabase: expected exactly one row" } };
      }
      return { data: rows[0], error: null };
    }
    if (this.terminal === "maybeSingle") {
      if (rows.length > 1) {
        return { data: null, error: { message: "fake-supabase: expected at most one row" } };
      }
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  // biome-ignore lint/suspicious/noThenProperty: mirrors supabase-js's PostgrestBuilder (itself thenable) — repositories `await` a query directly without a terminal .single()/.maybeSingle() call.
  then<TResult1 = PostgrestResult, TResult2 = never>(
    onfulfilled?: ((value: PostgrestResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export interface FakeAuthUser {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
}

export interface FakeSupabaseClient {
  from(table: string): FakeQueryBuilder;
  rpc(name: string, args?: Record<string, unknown>): FakeQueryBuilder;
  auth: {
    getUser(
      token: string,
    ): Promise<{ data: { user: FakeAuthUser | null }; error: { message: string } | null }>;
    admin: {
      createUser(
        attrs: Record<string, unknown>,
      ): Promise<{ data: { user: FakeAuthUser | null }; error: { message: string } | null }>;
    };
    resend(attrs: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  };
}

export interface FakeSupabase {
  client: FakeSupabaseClient;
  tables: Record<string, Row[]>;
  reset(seed?: Record<string, Row[]>): void;
  setAuthUser(user: FakeAuthUser | null, error?: { message: string } | null): void;
  // POST /mobile/auth/register's admin.createUser()/resend() calls — tests
  // assert against these instead of a real Supabase Auth project.
  authAdmin: {
    createdUsers: FakeAuthUser[];
    createUserError: { message: string } | null;
    resendCalls: Record<string, unknown>[];
  };
}

export function createFakeSupabase(
  options: { rpcHandlers?: Record<string, RpcHandler>; insertDefaults?: Record<string, Row> } = {},
): FakeSupabase {
  const tables: Record<string, Row[]> = {};
  const rpcHandlers = options.rpcHandlers ?? {};
  const insertDefaults = options.insertDefaults ?? {};
  let authUser: FakeAuthUser | null = null;
  let authError: { message: string } | null = null;
  const authAdmin: FakeSupabase["authAdmin"] = {
    createdUsers: [],
    createUserError: null,
    resendCalls: [],
  };

  const client: FakeSupabaseClient = {
    from(table) {
      if (!tables[table]) tables[table] = [];
      return new FakeQueryBuilder(tables[table], insertDefaults[table]);
    },
    rpc(name, args = {}) {
      const handler = rpcHandlers[name];
      if (!handler) throw new Error(`fake-supabase: no rpc handler registered for "${name}"`);
      return new FakeQueryBuilder(handler(tables, args));
    },
    auth: {
      async getUser() {
        if (authError) return { data: { user: null }, error: authError };
        return { data: { user: authUser }, error: null };
      },
      admin: {
        async createUser(attrs) {
          if (authAdmin.createUserError) {
            return { data: { user: null }, error: authAdmin.createUserError };
          }
          const user: FakeAuthUser = {
            id: crypto.randomUUID(),
            email: attrs.email as string,
            email_confirmed_at: null,
            user_metadata: (attrs.user_metadata as Record<string, unknown>) ?? {},
          };
          authAdmin.createdUsers.push(user);
          return { data: { user }, error: null };
        },
      },
      async resend(attrs) {
        authAdmin.resendCalls.push(attrs);
        return { error: null };
      },
    },
  };

  return {
    client,
    tables,
    authAdmin,
    reset(seed = {}) {
      for (const key of Object.keys(tables)) delete tables[key];
      for (const [key, rows] of Object.entries(seed)) {
        tables[key] = rows.map((row) => ({ ...row }));
      }
      authAdmin.createdUsers = [];
      authAdmin.createUserError = null;
      authAdmin.resendCalls = [];
    },
    setAuthUser(user, error = null) {
      authUser = user;
      authError = error;
    },
  };
}
