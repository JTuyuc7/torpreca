"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  businessDate,
  type InviteUserInput,
  InviteUserSchema,
  INVITABLE_ROLES,
  PROMOTABLE_ROLES,
  type Role,
  type User,
} from "@torpreca/shared";
import { Circle, MoreVertical, RefreshCw, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuthUser } from "@/app/(protected)/auth-context";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useLiveLocations } from "@/lib/hooks/use-live-locations";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useRoutes } from "@/lib/hooks/use-routes";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUsers } from "@/lib/hooks/use-users";

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-error">{children}</p>;
}

export default function UsersPage() {
  const { t } = useTranslation();
  const STATUS_LABELS: Record<User["status"], string> = t.users.status;
  usePageTitle(t.users.title);
  const {
    users,
    isLoading,
    isRefetching,
    error,
    refetch,
    inviteUser,
    deactivateUser,
    updateUserRole,
    reviewUser,
  } = useUsers();
  // POST /users/invite is super_admin-only on the backend — granting another
  // admin/supervisor account is privilege escalation, so it shouldn't be
  // self-service for a regular admin. Hiding the form for anyone else avoids
  // a dead-end 403.
  const isSuperAdmin = useAuthUser()?.role === "super_admin";
  // Shown once after a successful invite — there's no new row to point at
  // the way createUser's old flow had (the person hasn't set a password
  // yet), so this is the confirmation that something happened.
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);

  // TOR-31 ("Lista de conductores"): instead of a separate screen — this
  // table already covers drivers (see the "Conductores" nav item comment in
  // ../layout.tsx) — drivers get two more columns here: whether they're
  // currently online (same live-tracking WebSocket the map on "/" uses) and
  // the route assigned to them today, if any. Supervisors/admins don't have
  // either concept, so their rows just show "—".
  const { locations } = useLiveLocations();
  const { routes } = useRoutes();
  const onlineDriverIds = new Set(locations.map((l) => l.driverId));
  const today = businessDate();
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
  } = useForm<InviteUserInput>({
    resolver: zodResolver(InviteUserSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", role: INVITABLE_ROLES[0] },
  });

  function onInvite(values: InviteUserInput) {
    setInvitedEmail(null);
    inviteUser.mutate(values, {
      onSuccess: (user) => {
        reset({ name: "", email: "", role: INVITABLE_ROLES[0] });
        setInvitedEmail(user.email);
      },
    });
  }

  const pendingUsers = users?.filter((u) => u.status === "pending") ?? [];
  const otherUsers = users?.filter((u) => u.status !== "pending") ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl text-text">{t.users.title}</h1>
        <p className="text-sm text-outline">{t.users.subtitle}</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      {reviewUser.isError && <ErrorBanner message={reviewUser.error.message} />}
      {deactivateUser.isError && <ErrorBanner message={deactivateUser.error.message} />}
      {updateUserRole.isError && <ErrorBanner message={updateUserRole.error.message} />}
      {inviteUser.isError && <ErrorBanner message={inviteUser.error.message} />}

      {isLoading && (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label={t.users.loadingLabel}>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {users !== undefined && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {pendingUsers.length > 0 && (
            <Section title={t.users.pendingApprovalTitle}>
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
                          {t.users.requestedOn} {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <label htmlFor={`role-${user.id}`} className="text-[10px] text-outline">
                            {t.users.approveAs}
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
                          className="flex h-9 items-center gap-1.5 self-end rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                        >
                          {isReviewing && <Spinner className="h-3.5 w-3.5" />}
                          {t.users.approve}
                        </button>
                        <button
                          type="button"
                          disabled={isReviewing}
                          onClick={() => reviewUser.mutate({ id: user.id, decision: "reject" })}
                          className="flex h-9 items-center gap-1.5 self-end rounded-md border border-error px-3 text-sm font-medium text-error transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                        >
                          {isReviewing && <Spinner className="h-3.5 w-3.5" />}
                          {t.users.reject}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {isSuperAdmin && (
            <Section title={t.users.inviteTitle} description={t.users.inviteDescription}>
              <form
                onSubmit={handleSubmit(onInvite)}
                noValidate
                className="flex flex-wrap items-end gap-3"
              >
                <div className="flex flex-col gap-1">
                  <label htmlFor="name" className="text-xs text-outline">
                    {t.users.nameLabel}
                  </label>
                  <Input id="name" {...register("name")} />
                  {errors.name && <FieldError>{t.common.required}</FieldError>}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="email" className="text-xs text-outline">
                    {t.users.emailLabel}
                  </label>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && <FieldError>{t.users.invalidEmail}</FieldError>}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="role" className="text-xs text-outline">
                    {t.users.roleLabel}
                  </label>
                  <Select id="role" {...register("role")}>
                    {INVITABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </div>
                <button
                  type="submit"
                  disabled={!isValid || inviteUser.isPending}
                  className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {inviteUser.isPending && <Spinner className="h-3.5 w-3.5" />}
                  {inviteUser.isPending ? t.users.sending : t.users.sendInvite}
                </button>
                {invitedEmail && (
                  <p className="w-full text-sm text-primary">
                    {t.users.inviteSent} {invitedEmail}.
                  </p>
                )}
              </form>
            </Section>
          )}

          {otherUsers.length === 0 && pendingUsers.length === 0 && (
            <EmptyState
              icon={UsersIcon}
              title={t.users.noUsersTitle}
              description={
                isSuperAdmin
                  ? t.users.noUsersDescriptionSuperAdmin
                  : t.users.noUsersDescriptionOther
              }
            />
          )}

          {otherUsers.length > 0 && (
            <Section
              title={t.users.allUsersTitle}
              action={
                <button
                  type="button"
                  disabled={isRefetching}
                  onClick={() => refetch()}
                  title={t.users.refresh}
                  aria-label={t.users.refresh}
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
                      <th className="py-2 pr-4">{t.users.tableUser}</th>
                      <th className="py-2 pr-4">{t.users.tableRole}</th>
                      <th className="py-2 pr-4">{t.users.tableOperationalStatus}</th>
                      <th className="py-2 pr-4">{t.users.tableTodaysRoute}</th>
                      <th className="py-2 pr-4">{t.users.tableStatus}</th>
                      <th className="py-2 pr-4">{t.users.tableCreated}</th>
                      <th className="py-2">{t.common.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherUsers.map((user) => {
                      const isDeactivating =
                        deactivateUser.isPending && deactivateUser.variables === user.id;
                      const isOnline = onlineDriverIds.has(user.id);
                      // TOR-126: can't promote/demote to or from super_admin
                      // from the UI (CLAUDE.md — DB-only), and no point
                      // offering it on an already-deactivated account.
                      const canChangeRole =
                        isSuperAdmin && user.role !== "super_admin" && user.status !== "deactivated";
                      const canDeactivate = user.status !== "deactivated";
                      const isUpdatingRole =
                        updateUserRole.isPending && updateUserRole.variables?.id === user.id;
                      return (
                        <tr key={user.id} className="border-b border-outline/10 text-text">
                          <td className="py-2.5 pr-4">
                            {user.role === "driver" ? (
                              <Link
                                href={`/users/${user.id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {user.name}
                              </Link>
                            ) : (
                              <p className="font-medium">{user.name}</p>
                            )}
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
                                {isOnline ? t.users.online : t.users.offline}
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
                            {(canChangeRole || canDeactivate) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={isUpdatingRole || isDeactivating}
                                    aria-label={`${t.users.actionsFor} ${user.name}`}
                                    className="flex h-9 w-9 items-center justify-center rounded-md border border-outline/30 text-outline transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                                  >
                                    {isUpdatingRole || isDeactivating ? (
                                      <Spinner className="h-3.5 w-3.5" />
                                    ) : (
                                      <MoreVertical size={16} />
                                    )}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  {canChangeRole && (
                                    <>
                                      <DropdownMenuLabel>{t.users.changeRole}</DropdownMenuLabel>
                                      {PROMOTABLE_ROLES.filter((r) => r !== user.role).map((r) => (
                                        <DropdownMenuItem
                                          key={r}
                                          onSelect={() => updateUserRole.mutate({ id: user.id, role: r })}
                                        >
                                          {r}
                                        </DropdownMenuItem>
                                      ))}
                                    </>
                                  )}
                                  {canChangeRole && canDeactivate && <DropdownMenuSeparator />}
                                  {canDeactivate && (
                                    <DropdownMenuItem
                                      destructive
                                      onSelect={() => deactivateUser.mutate(user.id)}
                                    >
                                      {t.users.deactivate}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
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