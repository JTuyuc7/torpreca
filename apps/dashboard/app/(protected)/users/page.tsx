"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreateUserSchema, PROMOTABLE_ROLES, type Role, type User, z } from "@torpreca/shared";
import { Circle, RefreshCw, Users as UsersIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuthUser } from "@/app/(protected)/auth-context";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useLiveLocations } from "@/lib/hooks/use-live-locations";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useRoutes } from "@/lib/hooks/use-routes";
import { useUsers } from "@/lib/hooks/use-users";

// Roles assignable from the manual creation form — "driver" is excluded:
// drivers only ever arrive via mobile self-registration (POST
// /mobile/auth/register), landing "pending" and showing up in the queue
// below instead. super_admin is also excluded (CLAUDE.md: "super_admin no se
// puede crear desde la UI — solo desde la DB"). Existing rows of either role
// still show up in the table. `as const` (not just `Role[]`) so it can feed
// z.enum below — a plain array of the union type isn't narrow enough for it.
const ASSIGNABLE_ROLES = ["supervisor", "admin"] as const;

// Narrows CreateUserSchema's `role` (the full ROLES enum) down to just the
// two roles this form is allowed to submit — reuses the backend's exact
// field validation (uuid/email/min-length) instead of re-declaring it.
const CreateUserFormSchema = CreateUserSchema.extend({ role: z.enum(ASSIGNABLE_ROLES) });
type CreateUserFormValues = z.infer<typeof CreateUserFormSchema>;

const STATUS_LABELS: Record<User["status"], string> = {
  pending: "Pendiente",
  active: "Activo",
  rejected: "Rechazado",
  deactivated: "Desactivado",
};

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-error">{children}</p>;
}

export default function UsersPage() {
  usePageTitle("Gestión de usuarios");
  const { users, isLoading, isRefetching, error, refetch, createUser, deactivateUser, reviewUser } =
    useUsers();
  // POST /users (link an existing Supabase Auth user to a new profile) is
  // super_admin-only on the backend — granting another admin/supervisor
  // account is privilege escalation, so it shouldn't be self-service for a
  // regular admin. Hiding the form for anyone else avoids a dead-end 403.
  const isSuperAdmin = useAuthUser()?.role === "super_admin";

  // TOR-31 ("Lista de conductores"): instead of a separate screen — this
  // table already covers drivers (see the "Conductores" nav item comment in
  // ../layout.tsx) — drivers get two more columns here: whether they're
  // currently online (same live-tracking WebSocket the map on "/" uses) and
  // the route assigned to them today, if any. Supervisors/admins don't have
  // either concept, so their rows just show "—".
  const { locations } = useLiveLocations();
  const { routes } = useRoutes();
  const onlineDriverIds = new Set(locations.map((l) => l.driverId));
  const today = new Date().toISOString().slice(0, 10);
  const todaysRouteCodeByDriver = new Map(
    (routes ?? []).filter((r) => r.date === today).map((r) => [r.driverId, r.code]),
  );

  // Role each pending row will be approved as — defaults to "driver" (what
  // self-registration always sets), but lets an admin promote to
  // supervisor/admin right at approval time instead of a separate step.
  const [pendingRoles, setPendingRoles] = useState<Record<string, Role>>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(CreateUserFormSchema),
    mode: "onChange",
    defaultValues: { authUserId: "", name: "", email: "", role: ASSIGNABLE_ROLES[0] },
  });

  function onCreate(values: CreateUserFormValues) {
    createUser.mutate(values, {
      onSuccess: () =>
        reset({ authUserId: "", name: "", email: "", role: ASSIGNABLE_ROLES[0] }),
    });
  }

  const pendingUsers = users?.filter((u) => u.status === "pending") ?? [];
  const otherUsers = users?.filter((u) => u.status !== "pending") ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl text-text">Gestión de usuarios</h1>
        <p className="text-sm text-outline">Conductores, supervisores y administradores.</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      {reviewUser.isError && <ErrorBanner message={reviewUser.error.message} />}
      {deactivateUser.isError && <ErrorBanner message={deactivateUser.error.message} />}

      {isLoading && (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando usuarios">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {users !== undefined && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {pendingUsers.length > 0 && (
            <Section title="Conductores por aprobar">
              <ul className="flex flex-col gap-2">
                {pendingUsers.map((user) => {
                  const selectedRole = pendingRoles[user.id] ?? "driver";
                  const isReviewing =
                    reviewUser.isPending && reviewUser.variables?.id === user.id;
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
                          <Select
                            id={`role-${user.id}`}
                            value={selectedRole}
                            onChange={(e) =>
                              setPendingRoles((prev) => ({
                                ...prev,
                                [user.id]: e.target.value as Role,
                              }))
                            }
                            disabled={isReviewing}
                          >
                            {PROMOTABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <button
                          type="button"
                          disabled={isReviewing}
                          onClick={() =>
                            reviewUser.mutate({
                              id: user.id,
                              decision: "approve",
                              role: selectedRole,
                            })
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

          {isSuperAdmin && (
            <Section
              title="Agregar usuario"
              description="Supervisores y administradores — vincula un Auth User ID ya creado en Supabase."
            >
              <form
                onSubmit={handleSubmit(onCreate)}
                noValidate
                className="flex flex-wrap items-end gap-3"
              >
                <div className="flex flex-col gap-1">
                  <label htmlFor="authUserId" className="text-xs text-outline">
                    Auth User ID (Supabase)
                  </label>
                  <Input id="authUserId" {...register("authUserId")} placeholder="uuid" />
                  {errors.authUserId && <FieldError>ID inválido (debe ser un UUID).</FieldError>}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="name" className="text-xs text-outline">
                    Nombre
                  </label>
                  <Input id="name" {...register("name")} />
                  {errors.name && <FieldError>Requerido.</FieldError>}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="email" className="text-xs text-outline">
                    Email
                  </label>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && <FieldError>Correo inválido.</FieldError>}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="role" className="text-xs text-outline">
                    Rol
                  </label>
                  <Select id="role" {...register("role")}>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </div>
                <button
                  type="submit"
                  disabled={!isValid || createUser.isPending}
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

          {otherUsers.length === 0 && pendingUsers.length === 0 && (
            <EmptyState
              icon={UsersIcon}
              title="No hay usuarios registrados."
              description={
                isSuperAdmin
                  ? "Los conductores aparecen aquí cuando se registran desde la app móvil. Como super_admin también podés vincular una cuenta de supervisor o administrador con el formulario de arriba."
                  : "Los conductores aparecen aquí cuando se registran desde la app móvil, y un super_admin puede vincular cuentas de supervisor o administrador."
              }
            />
          )}

          {otherUsers.length > 0 && (
            <Section
              title="Todos los usuarios"
              action={
                <button
                  type="button"
                  disabled={isRefetching}
                  onClick={() => refetch()}
                  title="Actualizar"
                  aria-label="Actualizar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-outline/30 text-outline transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={14} className={isRefetching ? "animate-spin" : undefined} />
                </button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-outline/30 text-xs text-outline">
                      <th className="py-2 pr-4">Usuario</th>
                      <th className="py-2 pr-4">Rol</th>
                      <th className="py-2 pr-4">Estado operativo</th>
                      <th className="py-2 pr-4">Ruta de hoy</th>
                      <th className="py-2 pr-4">Estado</th>
                      <th className="py-2 pr-4">Creado</th>
                      <th className="py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherUsers.map((user) => {
                      const isDeactivating =
                        deactivateUser.isPending && deactivateUser.variables === user.id;
                      const isOnline = onlineDriverIds.has(user.id);
                      return (
                        <tr key={user.id} className="border-b border-outline/10 text-text">
                          <td className="py-2.5 pr-4">
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-outline">{user.email}</p>
                          </td>
                          <td className="py-2.5 pr-4">{user.role}</td>
                          <td className="py-2.5 pr-4">
                            {user.role === "driver" ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Circle
                                  size={8}
                                  className={isOnline ? "fill-primary text-primary" : "fill-outline text-outline"}
                                />
                                {isOnline ? "En línea" : "Fuera de línea"}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            {user.role === "driver" ? (todaysRouteCodeByDriver.get(user.id) ?? "—") : "—"}
                          </td>
                          <td className="py-2.5 pr-4">{STATUS_LABELS[user.status]}</td>
                          <td className="py-2.5 pr-4">{new Date(user.createdAt).toLocaleDateString()}</td>
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
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}