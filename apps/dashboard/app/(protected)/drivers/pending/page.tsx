"use client";

import type { User } from "@torpreca/shared";
import { useCallback, useEffect, useState } from "react";
import { listPendingUsers, reviewUser } from "@/lib/api/users-client";
import { supabase } from "@/lib/supabase/client";

// Approval queue for driver self-registration (TOR-85 — see Notion "Diseño —
// Auto-registro de conductores (self-signup)"). No badge/counter in the nav
// yet (that's the "future" item the design doc mentions) — this page is the
// first, direct way for an admin/supervisor to unblock a pending driver.

export default function PendingDriversPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tracks which row has a review in flight, so only that row's buttons
  // disable — an admin reviewing several drivers in a row shouldn't have to
  // wait for each one to finish before starting the next.
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Sesión expirada. Recarga la página.");
      return;
    }

    const result = await listPendingUsers(session.access_token);
    if (!result.ok) {
      setError("No se pudieron cargar las solicitudes pendientes.");
      return;
    }
    setUsers(result.users);
  }, []);

  useEffect(() => {
    // eslint-plugin-react-hooks@7's `set-state-in-effect` flags any function
    // called from an effect that (transitively) calls a state setter,
    // regardless of whether that setter runs after an `await` — its linked
    // reading (you-might-not-need-an-effect) covers derived state, not this
    // case. This is the standard "fetch on mount" pattern, not a real
    // cascading-render bug — the setState calls only ever run after
    // supabase.auth.getSession()/fetch resolve, never synchronously during
    // the effect's own render pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleReview(id: string, decision: "approve" | "reject") {
    setReviewingId(id);
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Sesión expirada. Recarga la página.");
      setReviewingId(null);
      return;
    }

    const result = await reviewUser(session.access_token, id, decision);
    if (!result.ok) {
      setError("No se pudo completar la revisión. Intenta de nuevo.");
      setReviewingId(null);
      return;
    }

    // Reviewed rows leave "pending" — drop them from this list locally
    // instead of a full reload.
    setUsers((prev) => prev?.filter((u) => u.id !== id) ?? null);
    setReviewingId(null);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl text-text">Conductores por aprobar</h1>
        <p className="text-sm text-outline">
          Cuentas de conductor creadas por auto-registro, esperando revisión.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {users === null && !error && <p className="text-sm text-outline">Cargando...</p>}

      {users !== null && users.length === 0 && (
        <p className="text-sm text-outline">No hay solicitudes pendientes.</p>
      )}

      {users !== null && users.length > 0 && (
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between rounded-md border border-outline/30 bg-surface px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-text">{user.name}</p>
                <p className="text-xs text-outline">
                  Solicitado el {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={reviewingId === user.id}
                  onClick={() => handleReview(user.id, "approve")}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  disabled={reviewingId === user.id}
                  onClick={() => handleReview(user.id, "reject")}
                  className="rounded-md border border-error px-3 py-1.5 text-sm font-medium text-error transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}