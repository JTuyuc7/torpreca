// Shared card wrapper so every screen's sections read as one system instead
// of loosely stacked blocks. Extracted from app/(protected)/users/page.tsx
// (TOR-42) when "Gestión de rutas" (TOR-30) became the second screen to need it.
export function Section({
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