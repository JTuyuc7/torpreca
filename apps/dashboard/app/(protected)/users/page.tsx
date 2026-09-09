"use client";

import { PROMOTABLE_ROLES, type Role, type User } from "@torpreca/shared";
import { useState } from "react";
import { useAuthUser } from "@/app/(protected)/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useUsers } from "@/lib/hooks/use-users";

// Roles assignable from the manual creation form — "driver" is excluded:
// drivers only ever arrive via mobile self-registration (POST
// /mobile/auth/register), landing "pending" and showing up in the queue
// below instead. super_admin is also excluded (CLAUDE.md: "super_admin no se
// puede crear desde la UI — solo desde la DB"). Existing rows of either role
// still show up in the table.
const ASSIGNABLE_ROLES: Role[] = ["supervisor", "admin"];

const STATUS_LABELS: Record<User["status"], string> = {
  pending: "Pendiente",
  active: "Activo",
  rejected: "Rechazado",
  deactivated: "Desactivado",
};

// Shared by every section card below so the page reads as one system instead
// of loosely stacked blocks — the exact gap the user flagged between
// "Conductores por aprobar" and the table underneath it.
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-outline/20 bg-surface p-5">
      <div>
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description && <p className="text-xs text-outline">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function UsersPage() {
  const { users, isLoading, error, createUser, deactivateUser, reviewUser } = useUsers();
  // POST /users (link an existing Supabase Auth user to a new profile) is
  // super_admin-only on the backend — granting another admin/supervisor
  // account is privilege escalation, so it shouldn't be self-service for a
  // regular admin. Hiding the form for anyone else avoids a dead-end 403.
  const isSuperAdmin = useAuthUser()?.role === "super_admin";

  // Role each pending row will be approved as — defaults to "driver" (what
  // self-registration always sets), but lets an admin promote to
  // supervisor/admin right at approval time instead of a separate step.
  const [pendingRoles, setPendingRoles] = useState<Record<string, Role>>({});

  const [authUserId, setAuthUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(ASSIGNABLE_ROLES[0]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createUser.mutate(
      { authUserId, name, email, role },
      {
        onSuccess: () => {
          setAuthUserId("");
          setName("");
          setEmail("");
          setRole(ASSIGNABLE_ROLES[0]);
        },
      },
    );
  }

  const pendingUsers = users?.filter((u) => u.status === "pending") ?? [];
  const otherUsers = users?.filter((u) => u.status !== "pending") ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl text-text">Gestión de usuarios</h1>
        <p className="text-sm text-outline">Conductores, supervisores y administradores.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {reviewUser.isError && (
        <p role="alert" className="text-sm text-error">
          {reviewUser.error.message}
        </p>
      )}
      {deactivateUser.isError && (
        <p role="alert" className="text-sm text-error">
          {deactivateUser.error.message}
        </p>
      )}

      {isLoading && (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando usuarios">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {users !== undefined && pendingUsers.length > 0 && (
        <Section title="Conductores por aprobar">
          <ul className="flex flex-col gap-2">
            {pendingUsers.map((user) => {
              const selectedRole = pendingRoles[user.id] ?? "driver";
              const isReviewing = reviewUser.isPending && reviewUser.variables?.id === user.id;
              return (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline/30 bg-background px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{user.name}</p>
                    <p className="text-xs text-outline">{user.email}</p>
                    <p className="text-xs text-outline">
                      Solicitado el {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`role-${user.id}`} className="text-[10px] text-outline">
                        Aprobar como
                      </label>
                      <select
                        id={`role-${user.id}`}
                        value={selectedRole}
                        onChange={(e) =>
                          setPendingRoles((prev) => ({ ...prev, [user.id]: e.target.value as Role }))
                        }
                        disabled={isReviewing}
                        className="h-9 rounded-md border border-outline/30 bg-surface px-2 text-sm text-text"
                      >
                        {PROMOTABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={isReviewing}
                      onClick={() =>
                        reviewUser.mutate({ id: user.id, decision: "approve", role: selectedRole })
                      }
                      className="flex h-9 items-center gap-1.5 self-end rounded-md bg-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {isReviewing && <Spinner className="h-3.5 w-3.5" />}
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={isReviewing}
                      onClick={() => reviewUser.mutate({ id: user.id, decision: "reject" })}
                      className="flex h-9 items-center gap-1.5 self-end rounded-md border border-error px-3 text-sm font-medium text-error transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {isReviewing && <Spinner className="h-3.5 w-3.5" />}
                      Rechazar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {users !== undefined && isSuperAdmin && (
        <Section title="Agregar usuario" description="Supervisores y administradores — vincula un Auth User ID ya creado en Supabase.">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="authUserId" className="text-xs text-outline">
                Auth User ID (Supabase)
              </label>
              <input
                id="authUserId"
                required
                value={authUserId}
                onChange={(e) => setAuthUserId(e.target.value)}
                className="h-9 rounded-md border border-outline/30 bg-background px-2 text-sm text-text"
                placeholder="uuid"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="name" className="text-xs text-outline">
                Nombre
              </label>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 rounded-md border border-outline/30 bg-background px-2 text-sm text-text"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-xs text-outline">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 rounded-md border border-outline/30 bg-background px-2 text-sm text-text"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="role" className="text-xs text-outline">
                Rol
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="h-9 rounded-md border border-outline/30 bg-background px-2 text-sm text-text"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={createUser.isPending}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {createUser.isPending && <Spinner className="h-3.5 w-3.5" />}
              {createUser.isPending ? "Creando..." : "Crear usuario"}
            </button>
            {createUser.isError && (
              <p role="alert" className="w-full text-sm text-error">
                {createUser.error.message}
              </p>
            )}
          </form>
        </Section>
      )}

      {users !== undefined && otherUsers.length === 0 && pendingUsers.length === 0 && (
        <p className="text-sm text-outline">No hay usuarios registrados.</p>
      )}

      {otherUsers.length > 0 && (
        <Section title="Todos los usuarios">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline/30 text-xs text-outline">
                <th className="py-2">Usuario</th>
                <th className="py-2">Rol</th>
                <th className="py-2">Estado</th>
                <th className="py-2">Creado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {otherUsers.map((user) => {
                const isDeactivating =
                  deactivateUser.isPending && deactivateUser.variables === user.id;
                return (
                  <tr key={user.id} className="border-b border-outline/10 text-text">
                    <td className="py-2.5">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-outline">{user.email}</p>
                    </td>
                    <td className="py-2.5">{user.role}</td>
                    <td className="py-2.5">{STATUS_LABELS[user.status]}</td>
                    <td className="py-2.5">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5">
                      {user.status !== "deactivated" && (
                        <button
                          type="button"
                          disabled={isDeactivating}
                          onClick={() => deactivateUser.mutate(user.id)}
                          className="flex h-9 items-center gap-1.5 rounded-md border border-error px-3 text-sm font-medium text-error transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                        >
                          {isDeactivating && <Spinner className="h-3.5 w-3.5" />}
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}