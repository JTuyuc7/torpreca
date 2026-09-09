import type { CreateUserInput, Role, User } from "@torpreca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, deactivateUser, listAllUsers, reviewUser } from "@/lib/api/users-client";
import { getAccessToken } from "@/lib/supabase/access-token";

const usersQueryKey = ["users"] as const;

// Extracted out of app/(protected)/users/page.tsx (TOR-42) so the screen is
// just JSX + this hook — reusable if a second screen ever needs the same
// user list/mutations, and testable without rendering the page.
export function useUsers() {
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await listAllUsers(token);
      if (!result.ok) throw new Error("No se pudieron cargar los usuarios.");
      return result.users;
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const token = await getAccessToken();
      const result = await createUser(token, input);
      if (!result.ok) {
        throw new Error(
          result.status === 409
            ? "Ya existe un usuario con ese authUserId."
            : "No se pudo crear el usuario. Verifica el authUserId.",
        );
      }
      return result.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData<User[]>(usersQueryKey, (prev) => (prev ? [user, ...prev] : [user]));
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      const result = await deactivateUser(token, id);
      if (!result.ok) throw new Error("No se pudo desactivar el usuario.");
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<User[]>(usersQueryKey, (prev) =>
        prev?.map((u) => (u.id === id ? { ...u, status: "deactivated" as const } : u)),
      );
    },
  });

  const reviewUserMutation = useMutation({
    mutationFn: async (vars: { id: string; decision: "approve" | "reject"; role?: Role }) => {
      const token = await getAccessToken();
      const result = await reviewUser(token, vars.id, vars.decision, vars.role);
      if (!result.ok) throw new Error("No se pudo completar la revisión. Intenta de nuevo.");
      return result.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData<User[]>(usersQueryKey, (prev) =>
        prev?.map((u) => (u.id === user.id ? user : u)),
      );
    },
  });

  return {
    users: usersQuery.data,
    isLoading: usersQuery.isLoading,
    error: usersQuery.error?.message ?? null,
    createUser: createUserMutation,
    deactivateUser: deactivateUserMutation,
    reviewUser: reviewUserMutation,
  };
}