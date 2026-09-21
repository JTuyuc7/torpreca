"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreateVehicleSchema, VEHICLE_CATEGORIES, type Vehicle, z } from "@torpreca/shared";
import { Plus, Truck } from "lucide-react";
import { useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldHint } from "@/components/ui/field-hint";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useVehicles } from "@/lib/hooks/use-vehicles";

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
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-primary text-on-primary" : "bg-outline/15 text-outline"
      }`}
    >
      {active ? t.vehiculos.active : t.vehiculos.inactive}
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
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1">
          <label htmlFor="plate" className="text-xs text-outline">
            {t.vehiculos.plateLabel}
          </label>
          <FieldHint text={t.vehiculos.plateHint} />
        </span>
        <Input id="plate" {...register("plate")} placeholder={t.vehiculos.platePlaceholder} />
        {errors.plate && <FieldError>{t.common.required}</FieldError>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="model" className="text-xs text-outline">
          {t.vehiculos.modelLabel}
        </label>
        <Input id="model" {...register("model")} placeholder={t.vehiculos.modelPlaceholder} />
        {errors.model && <FieldError>{t.vehiculos.modelRequired}</FieldError>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-xs text-outline">
          {t.vehiculos.categoryLabel}
        </label>
        <Select id="category" {...register("category")}>
          {VEHICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.vehiculos.categories[c]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1">
          <label htmlFor="capacity" className="text-xs text-outline">
            {t.vehiculos.capacityLabel}
          </label>
          <FieldHint text={t.vehiculos.capacityHint} align="right" />
        </span>
        <Input id="capacity" type="number" min={1} {...register("capacity", { valueAsNumber: true })} />
        {errors.capacity && <FieldError>{t.vehiculos.capacityInvalid}</FieldError>}
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <span className="flex items-center gap-1">
          <label htmlFor="notes" className="text-xs text-outline">
            {t.vehiculos.notesLabel}
          </label>
          <FieldHint text={t.vehiculos.notesHint} />
        </span>
        <Textarea
          id="notes"
          rows={3}
          {...register("notes")}
          className="w-full resize-y"
          placeholder={t.vehiculos.notesPlaceholder}
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
  const { t } = useTranslation();
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
          <DialogTitle>{t.vehiculos.addDialogTitle}</DialogTitle>
          <DialogDescription>{t.vehiculos.addDialogDescription}</DialogDescription>
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
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={!isValid || createVehicle.isPending}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {createVehicle.isPending && <Spinner className="h-3.5 w-3.5" />}
              {createVehicle.isPending ? t.vehiculos.saving : t.vehiculos.saveVehicle}
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
  const { t } = useTranslation();
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
              <DialogTitle>{t.vehiculos.editDialogTitle}</DialogTitle>
              <DialogDescription>
                {t.vehiculos.editDialogPlate} {vehicle.plate}.
              </DialogDescription>
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
                  {vehicle.active ? t.vehiculos.deactivate : t.vehiculos.reactivate}
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => onOpenChange(false)}
                  className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!isValid || isSaving}
                  className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving && <Spinner className="h-3.5 w-3.5" />}
                  {t.common.save}
                </button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {vehicle.active ? t.vehiculos.deactivateConfirmTitle : t.vehiculos.reactivateConfirmTitle}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-text">
              {vehicle.active ? (
                <>
                  {t.vehiculos.deactivateConfirmBody} <strong>{vehicle.plate}</strong>
                  {t.vehiculos.deactivateConfirmBodySuffix}
                </>
              ) : (
                <>
                  {t.vehiculos.reactivateConfirmBody} <strong>{vehicle.plate}</strong>
                  {t.vehiculos.reactivateConfirmBodySuffix}
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
                {t.common.cancel}
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
                {vehicle.active ? t.vehiculos.confirmDeactivate : t.vehiculos.confirmReactivate}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function VehiculosPage() {
  const { t } = useTranslation();
  usePageTitle(t.vehiculos.title);
  const { vehicles, isLoading, error, refetch, createVehicle, updateVehicle, deactivateVehicle } =
    useVehicles();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl text-text">{t.vehiculos.title}</h1>
          <p className="text-sm text-outline">{t.vehiculos.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 cursor-pointer"
        >
          <Plus size={15} />
          {t.vehiculos.addVehicle}
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      {updateVehicle.isError && <ErrorBanner message={updateVehicle.error.message} />}
      {deactivateVehicle.isError && <ErrorBanner message={deactivateVehicle.error.message} />}

      {isLoading && (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label={t.vehiculos.loadingLabel}>
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {vehicles !== undefined && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {vehicles.length === 0 && (
            <EmptyState
              icon={Truck}
              title={t.vehiculos.noVehiclesTitle}
              description={t.vehiculos.noVehiclesDescription}
              action={{ label: t.vehiculos.addFirstVehicle, onClick: () => setCreateOpen(true) }}
            />
          )}

          {vehicles.length > 0 && (
            <Section title={t.vehiculos.allVehiclesTitle}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-outline/30 text-xs text-outline">
                      <th className="py-2 pr-4">{t.vehiculos.tablePlate}</th>
                      <th className="py-2 pr-4">{t.vehiculos.tableModel}</th>
                      <th className="py-2 pr-4">{t.vehiculos.tableCategory}</th>
                      <th className="py-2 pr-4">{t.vehiculos.tableCapacity}</th>
                      <th className="py-2 pr-4">{t.vehiculos.tableNotes}</th>
                      <th className="py-2 pr-4">{t.vehiculos.tableStatus}</th>
                      <th className="py-2">{t.vehiculos.tableActions}</th>
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
                        <td className="py-3 pr-4">{t.vehiculos.categories[vehicle.category]}</td>
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
                            {t.common.edit}
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