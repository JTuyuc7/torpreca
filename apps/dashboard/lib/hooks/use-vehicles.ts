import { useQuery } from "@tanstack/react-query";
import { listActiveVehicles } from "@/lib/api/vehicles-client";
import { getAccessToken } from "@/lib/supabase/access-token";

// Read-only for now (TOR-30 only needs the list for the assignment dropdown
// in "Gestión de rutas") — mutations arrive with the full CRUD screen, TOR-44.
export function useVehicles() {
  const vehiclesQuery = useQuery({
    queryKey: ["vehicles"] as const,
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await listActiveVehicles(token);
      if (!result.ok) throw new Error("No se pudieron cargar los vehículos.");
      return result.vehicles;
    },
  });

  return {
    vehicles: vehiclesQuery.data,
    isLoading: vehiclesQuery.isLoading,
    error: vehiclesQuery.error?.message ?? null,
  };
}