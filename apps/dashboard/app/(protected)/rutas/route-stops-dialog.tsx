"use client";

import type { Route, Stop } from "@torpreca/shared";
import { ArrowDown, ArrowUp, MapPin, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { AddressSearch } from "@/components/ui/address-search";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useStops } from "@/lib/hooks/use-stops";
import { useTranslation } from "@/lib/i18n/use-translation";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

// Same operating-area default as the live map in app/(protected)/page.tsx —
// only biases the address search results toward the city, doesn't restrict them.
const SEARCH_PROXIMITY = { lng: -90.5069, lat: 14.6349 };

type Place = { lat: number; lng: number; address: string };

const iconButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-md border border-outline text-text transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

// TOR-137 — "Paradas" of a route, opened from its row in the /rutas table.
// Drivers only see a route's stops in the mobile app, and until now nothing
// in the dashboard could create them — every route was born empty. Editing is
// only offered while the route is `pending` (the backend enforces it with a
// 409 too); afterwards the same dialog is a read-only view of the stops.
export function RouteStopsDialog({ route }: { route: Route }) {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const { stops, isLoading, error, refetch, createStop, updateStop, deleteStop, reorderStops } =
    useStops(route.id, open);

  const readOnly = route.status !== "pending";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Bumped to remount <AddressSearch>, which keeps its own input text.
  const [searchKey, setSearchKey] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const saving = createStop.isPending || updateStop.isPending;
  const mutationError =
    createStop.error?.message ??
    updateStop.error?.message ??
    deleteStop.error?.message ??
    reorderStops.error?.message ??
    null;

  function resetForm() {
    setEditingId(null);
    setCustomerName("");
    setInstructions("");
    setPlace(null);
    setSubmitted(false);
    setSearchKey((k) => k + 1);
  }

  function startEditing(stop: Stop) {
    setEditingId(stop.id);
    setCustomerName(stop.customerName);
    setInstructions(stop.instructions ?? "");
    setPlace({ lat: stop.lat, lng: stop.lng, address: stop.address });
    setSubmitted(false);
    setSearchKey((k) => k + 1);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const name = customerName.trim();
    if (!name || !place) return;

    const input = {
      customerName: name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      instructions: instructions.trim() || null,
    };

    if (editingId) {
      updateStop.mutate({ id: editingId, input }, { onSuccess: resetForm });
    } else {
      createStop.mutate(input, { onSuccess: resetForm });
    }
  }

  function move(index: number, delta: -1 | 1) {
    if (!stops) return;
    const ids = stops.map((s) => s.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
    reorderStops.mutate(ids);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          resetForm();
          setConfirmDeleteId(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
        >
          <MapPin size={14} />
          {t.stops.trigger}
        </button>
      </DialogTrigger>
      {/* !max-w-2xl: same reason as the km calculator — DialogContent hardcodes
          max-w-lg, and a plain utility here doesn't reliably win over it. */}
      <DialogContent className="!max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t.stops.title} · {route.code}
          </DialogTitle>
          <DialogDescription>
            {readOnly ? t.stops.readOnlyNotice : t.stops.description}
          </DialogDescription>
        </DialogHeader>

        {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
        {mutationError && <ErrorBanner message={mutationError} />}

        {isLoading && (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label={t.stops.loadingLabel}>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {stops !== undefined && stops.length === 0 && (
          <EmptyState
            icon={MapPin}
            title={t.stops.emptyTitle}
            description={readOnly ? undefined : t.stops.emptyDescription}
            compact
          />
        )}

        {stops !== undefined && stops.length > 0 && (
          <ol className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {stops.map((stop, index) => {
              const editable = !readOnly && stop.status !== "completed";
              return (
                <li
                  key={stop.id}
                  className="flex items-center gap-3 rounded-md border border-outline/20 px-3 py-2"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{stop.customerName}</p>
                    <p className="truncate text-xs text-outline">{stop.address}</p>
                  </div>
                  <span className="shrink-0 text-xs text-outline">{t.stops.status[stop.status]}</span>
                  {editable && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className={iconButtonClass}
                        aria-label={`${t.stops.moveUp}: ${stop.customerName}`}
                        disabled={index === 0 || reorderStops.isPending}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className={iconButtonClass}
                        aria-label={`${t.stops.moveDown}: ${stop.customerName}`}
                        disabled={index === stops.length - 1 || reorderStops.isPending}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className={iconButtonClass}
                        aria-label={`${t.common.edit}: ${stop.customerName}`}
                        onClick={() => startEditing(stop)}
                      >
                        <Pencil size={14} />
                      </button>
                      {confirmDeleteId === stop.id ? (
                        <button
                          type="button"
                          className="flex h-8 items-center gap-1 rounded-md bg-error px-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                          disabled={deleteStop.isPending}
                          onClick={() =>
                            deleteStop.mutate(stop.id, {
                              onSettled: () => setConfirmDeleteId(null),
                              onSuccess: () => {
                                if (editingId === stop.id) resetForm();
                              },
                            })
                          }
                        >
                          {deleteStop.isPending && <Spinner className="h-3 w-3" />}
                          {t.stops.confirmDelete}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={iconButtonClass}
                          aria-label={`${t.stops.delete}: ${stop.customerName}`}
                          onClick={() => setConfirmDeleteId(stop.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {!readOnly && (
          <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-3 border-t border-outline/20 pt-4">
            <h3 className="text-sm font-medium text-text">
              {editingId ? t.stops.editTitle : t.stops.addTitle}
            </h3>

            <div className="flex flex-col gap-1">
              <label htmlFor="stop-customer" className="text-xs text-outline">
                {t.stops.customerLabel}
              </label>
              <Input
                id="stop-customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              {submitted && !customerName.trim() && (
                <FieldError>{t.stops.customerRequired}</FieldError>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-outline">{t.stops.addressLabel}</span>
              <AddressSearch
                key={searchKey}
                accessToken={MAPBOX_TOKEN}
                proximity={SEARCH_PROXIMITY}
                onSelect={(coordinates, placeName) =>
                  setPlace({ lat: coordinates.lat, lng: coordinates.lng, address: placeName })
                }
                placeholder={t.stops.addressSearchPlaceholder}
                language={language}
              />
              {place && (
                <p className="flex items-center gap-1.5 text-xs text-text">
                  <MapPin size={12} className="shrink-0 text-primary" />
                  <span className="truncate">{place.address}</span>
                  <span className="shrink-0 text-outline tabular-nums">
                    ({place.lat.toFixed(5)}, {place.lng.toFixed(5)})
                  </span>
                </p>
              )}
              {submitted && !place && <FieldError>{t.stops.addressRequired}</FieldError>}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="stop-instructions" className="text-xs text-outline">
                {t.stops.instructionsLabel}
              </label>
              <Textarea
                id="stop-instructions"
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {saving && <Spinner className="h-3.5 w-3.5" />}
                {editingId
                  ? saving
                    ? t.stops.saving
                    : t.stops.saveChanges
                  : saving
                    ? t.stops.adding
                    : t.stops.add}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
