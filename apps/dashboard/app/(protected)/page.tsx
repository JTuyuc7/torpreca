"use client";

import { usePageTitle } from "@/lib/hooks/use-page-title";

// Placeholder for TOR-12 ("Panel principal: métricas + mapa Mapbox en vivo")
// — not built yet. The sidebar keeps this nav item disabled ("Próx."), but
// the route itself is still reachable directly, so it gets a real on-brand
// placeholder instead of leaving the create-next-app starter content here.
export default function HomePage() {
  usePageTitle("Panel principal");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl text-text">Panel principal</h1>
      <p className="text-sm text-outline">Próximamente — métricas y mapa en vivo.</p>
    </div>
  );
}