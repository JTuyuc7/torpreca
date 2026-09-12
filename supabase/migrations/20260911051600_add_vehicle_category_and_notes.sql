-- TOR-44: "Gestión de vehículos" screen needs a category (moto/vehículo
-- liviano/camión) to distinguish fleet types, and a free-text notes field
-- for maintenance/condition observations.

CREATE TYPE public.vehicle_category AS ENUM ('motorcycle', 'light_vehicle', 'truck');

-- DEFAULT so this is safe against any existing row (none expected in
-- practice — this screen didn't exist before now — but harmless either way).
-- The default is a backfill convenience only: CreateVehicleSchema/
-- UpdateVehicleSchema require the app to always send a real value going forward.
ALTER TABLE public.vehicles
  ADD COLUMN category public.vehicle_category NOT NULL DEFAULT 'light_vehicle',
  ADD COLUMN notes text;