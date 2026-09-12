"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreateVehicleSchema, VEHICLE_CATEGORIES, type Vehicle, type VehicleCategory, z } from "@torpreca/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldHint } from "@/components/ui/field-hint";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useVehicles } from "@/lib/hooks/use-vehicles";

const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  motorcycle: "Moto",
  light_vehicle: "Vehículo liviano",
  truck: "Camión",
};

// `capacity` is re-declared with a preprocess step instead of reusing
// CreateVehicleSchema.capacity as-is, paired with `valueAsNumber: true` on
// the input below (not a custom `setValueAs`) — react-hook-form 7.87 +
// React 19 has a real bug where register(field, { setValueAs }) on an
// untouched type="number" input hands the resolver the raw DOM node instead
// of its value, breaking validation silently (formState.isValid gets stuck
// at false with an empty errors object — no crash, no visible cause).
// valueAsNumber is a built-in, well-tested option that doesn't hit this path;
// it turns an empty field into NaN, which this preprocess step maps to null
// before the nullable() check runs.
const VehicleFormSchema = CreateVehicleSchema.extend({
  capacity: z.preprocess(
    (v) => (typeof v === "number" && Number.isNaN(v) ? null : v),
    CreateVehicleSchema.shape.capacity,
  ),
});
type VehicleFormValues = z.infer<typeof VehicleFormSchema>;

// z.preprocess types its input as `unknown` (by design — that's the whole
// point of a preprocess step), which doesn't line up with react-hook-form's
// Resolver<TFieldValues> expecting the same shape on both sides. The actual
// runtime input is always `number | null` here (either a DOM NaN from
// valueAsNumber, or already-valid form state) — safe to assert.
const vehicleResolver = zodResolver(VehicleFormSchema) as Resolver<VehicleFormValues>;

const EMPTY_VEHICLE_FORM: VehicleFormValues = {
  plate: "",
  model: "",
  capacity: null,
  category: VEHICLE_CATEGORIES[0],
  notes: "",
};

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-error">{children}</p>;
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-primary text-white" : "bg-outline/15 text-outline"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

// Shared field layout for both the create and edit forms — one column per
// field on wide screens, stacked on narrow ones, so the two forms read as
// the same component even though they used to be a horizontal row (create)
// and a table row (edit) with unrelated spacing rules.
function VehicleFormFields({
  register,
  errors,
}: {
  register: ReturnType<typeof useForm<VehicleFormValues>>["register"];
  errors: ReturnType<typeof useForm<VehicleFormValues>>["formState"]["errors"];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1">
          <label htmlFor="plate" className="text-xs text-outline">
            Placa
          </label>
          <FieldHint text="Placa de circulación del vehículo, tal como aparece en la tarjeta de circulación." />
        </span>
        <Input id="plate" {...register("plate")} placeholder="P-123ABC" />
        {errors.plate && <FieldError>Requerida.</FieldError>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="model" className="text-xs text-outline">
          Modelo
        </label>
        <Input id="model" {...register("model")} placeholder="Ej. NPR, Hilux" />
        {errors.model && <FieldError>Requerido.</FieldError>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-xs text-outline">
          Categoría
        </label>
        <Select id="category" {...register("category")}>
          {VEHICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1">
          <label htmlFor="capacity" className="text-xs text-outline">
            Capacidad
          </label>
          <FieldHint text="Unidades que puede transportar (ej. cajas o pasajeros). Déjalo vacío si no aplica." align="right" />
        </span>
        <Input id="capacity" type="number" min={1} {...register("capacity", { valueAsNumber: true })} />
        {errors.capacity && <FieldError>Debe ser mayor a 0.</FieldError>}
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <span className="flex items-center gap-1">
          <label htmlFor="notes" className="text-xs text-outline">
            Notas
          </label>
          <FieldHint text="Observaciones internas: mantenimiento pendiente, estado, restricciones, etc. Opcional." />
        </span>
        <Textarea
          id="notes"
          rows={3}
          {...register("notes")}
          className="w-full resize-y"
          placeholder="Ej. revisión de frenos pendiente"
        />
      </div>
    </div>
  );
}

function CreateVehicleDialog({
  open,
  onOpenChange,
  createVehicle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createVehicle: ReturnType<typeof useVehicles>["createVehicle"];
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<VehicleFormValues>({
    resolver: vehicleResolver,
    mode: "onChange",
    defaultValues: EMPTY_VEHICLE_FORM,
  });

  function onSubmit(values: VehicleFormValues) {
    createVehicle.mutate(values, {
      onSuccess: () => {
        reset(EMPTY_VEHICLE_FORM);
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset(EMPTY_VEHICLE_FORM);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar vehículo</DialogTitle>
          <DialogDescription>
            Registra una nueva unidad de la flota. Placa y modelo son obligatorios; capacidad y notas son
            opcionales.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
          <VehicleFormFields register={register} errors={errors} />
          {createVehicle.isError && <FieldError>{createVehicle.error.message}</FieldError>}
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValid || createVehicle.isPending}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {createVehicle.isPending && <Spinner className="h-3.5 w-3.5" />}
              {createVehicle.isPending ? "Guardando..." : "Guardar vehículo"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VehicleEditDialog({
  vehicle,
  onOpenChange,
  updateVehicle,
  deactivateVehicle,
}: {
  vehicle: Vehicle;
  onOpenChange: (open: boolean) => void;
  updateVehicle: ReturnType<typeof useVehicles>["updateVehicle"];
  deactivateVehicle: ReturnType<typeof useVehicles>["deactivateVehicle"];
}) {
  // Remounted per vehicle (parent keys this component by vehicle.id), so
  // this local state always starts fresh — no effect needed to reset it
  // when a different vehicle is opened for editing.
  const [mode, setMode] = useState<"edit" | "confirm-toggle">("edit");

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<VehicleFormValues>({
    resolver: vehicleResolver,
    mode: "onChange",
    defaultValues: {
      plate: vehicle.plate,
      model: vehicle.model,
      capacity: vehicle.capacity,
      category: vehicle.category,
      notes: vehicle.notes ?? "",
    },
  });

  const isSaving = updateVehicle.isPending && updateVehicle.variables?.id === vehicle.id;
  const isToggling =
    (deactivateVehicle.isPending && deactivateVehicle.variables === vehicle.id) ||
    (updateVehicle.isPending &&
      updateVehicle.variables?.id === vehicle.id &&
      "active" in updateVehicle.variables.input);

  function onSubmit(values: VehicleFormValues) {
    updateVehicle.mutate({ id: vehicle.id, input: values }, { onSuccess: () => onOpenChange(false) });
  }

  function onConfirmToggle() {
    if (vehicle.active) {
      deactivateVehicle.mutate(vehicle.id, { onSuccess: () => onOpenChange(false) });
    } else {
      updateVehicle.mutate(
        { id: vehicle.id, input: { active: true } },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        {mode === "edit" ? (
          <>
            <DialogHeader>
              <DialogTitle>Editar vehículo</DialogTitle>
              <DialogDescription>Placa {vehicle.plate}.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
              <VehicleFormFields register={register} errors={errors} />
              <DialogFooter>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setMode("confirm-toggle")}
                  className={`mr-auto flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer ${
                    vehicle.active ? "border-error text-error" : "border-outline text-text"
                  }`}
                >
                  {vehicle.active ? "Desactivar" : "Reactivar"}
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => onOpenChange(false)}
                  className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isValid || isSaving}
                  className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving && <Spinner className="h-3.5 w-3.5" />}
                  Guardar
                </button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{vehicle.active ? "Desactivar vehículo" : "Reactivar vehículo"}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-text">
              {vehicle.active ? (
                <>
                  ¿Confirmas que quieres desactivar <strong>{vehicle.plate}</strong>? Dejará de estar
                  disponible para asignar a rutas nuevas.
                </>
              ) : (
                <>
                  ¿Confirmas que quieres reactivar <strong>{vehicle.plate}</strong>? Volverá a estar
                  disponible para asignar a rutas.
                </>
              )}
            </p>
            <DialogFooter>
              <button
                type="button"
                disabled={isToggling}
                onClick={() => setMode("edit")}
                className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isToggling}
                onClick={onConfirmToggle}
                // Not a solid bg-error fill with white text: --error in dark
                // mode is a pale pink meant to read as text/border on a dark
                // surface, not as a button background — same border+text
                // treatment as the toggle button above it, which is
                // theme-safe by construction.
                className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer ${
                  vehicle.active ? "border-error bg-error/10 text-error" : "border-primary bg-primary/10 text-primary"
                }`}
              >
                {isToggling && <Spinner className="h-3.5 w-3.5" />}
                {vehicle.active ? "Sí, desactivar" : "Sí, reactivar"}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function VehiculosPage() {
  usePageTitle("Gestión de vehículos");
  const { vehicles, isLoading, error, refetch, createVehicle, updateVehicle, deactivateVehicle } =
    useVehicles();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl text-text">Gestión de vehículos</h1>
          <p className="text-sm text-outline">Flota disponible para asignar a rutas.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
        >
          <Plus size={15} />
          Agregar vehículo
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      {updateVehicle.isError && <ErrorBanner message={updateVehicle.error.message} />}
      {deactivateVehicle.isError && <ErrorBanner message={deactivateVehicle.error.message} />}

      {isLoading && (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando vehículos">
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {vehicles !== undefined && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {vehicles.length === 0 && (
            <p className="text-sm text-outline">No hay vehículos registrados.</p>
          )}

          {vehicles.length > 0 && (
            <Section title="Todos los vehículos">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-outline/30 text-xs text-outline">
                      <th className="py-2 pr-4">Placa</th>
                      <th className="py-2 pr-4">Modelo</th>
                      <th className="py-2 pr-4">Categoría</th>
                      <th className="py-2 pr-4">Capacidad</th>
                      <th className="py-2 pr-4">Notas</th>
                      <th className="py-2 pr-4">Estado</th>
                      <th className="py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((vehicle) => (
                      <tr
                        key={vehicle.id}
                        className="border-b border-outline/10 text-text transition-colors hover:bg-outline/5"
                      >
                        <td className="py-3 pr-4 font-medium">{vehicle.plate}</td>
                        <td className="py-3 pr-4">{vehicle.model}</td>
                        <td className="py-3 pr-4">{CATEGORY_LABELS[vehicle.category]}</td>
                        <td className="py-3 pr-4">{vehicle.capacity ?? "—"}</td>
                        <td
                          className="max-w-[12rem] truncate py-3 pr-4 text-outline"
                          title={vehicle.notes ?? undefined}
                        >
                          {vehicle.notes || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <ActiveBadge active={vehicle.active} />
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => setEditingVehicle(vehicle)}
                            className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}

      <CreateVehicleDialog open={createOpen} onOpenChange={setCreateOpen} createVehicle={createVehicle} />

      {editingVehicle && (
        <VehicleEditDialog
          key={editingVehicle.id}
          vehicle={editingVehicle}
          onOpenChange={(open) => !open && setEditingVehicle(null)}
          updateVehicle={updateVehicle}
          deactivateVehicle={deactivateVehicle}
        />
      )}
    </div>
  );
}