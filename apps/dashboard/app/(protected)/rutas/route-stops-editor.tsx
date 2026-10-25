"use client";

import type { UpdateStopInput } from "@torpreca/shared";
import { ArrowDown, ArrowUp, MapPin, Trash2 } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { AddressSearch } from "@/components/ui/address-search";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n/use-translation";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

// Same operating-area default as route-stops-dialog.tsx.
const SEARCH_PROXIMITY = { lng: -90.5069, lat: 14.6349 };

const iconButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-md border border-outline text-text transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

// A stop in the list being built. `key` only exists so React can keep rows
// stable while they're reordered/removed — the stops have no ids yet.
export type DraftStop = UpdateStopInput & { key: string };

// What the backend takes for each stop: the draft without its React key.
export function toStopInputs(draft: DraftStop[]): UpdateStopInput[] {
  return draft.map(({ customerName, address, lat, lng, instructions }) => ({
    customerName,
    address,
    lat,
    lng,
    instructions,
  }));
}

type Place = { lat: number; lng: number; address: string };

// The list of stops of a route that doesn't exist yet, plus the mini form to
// add one — shared by "Nueva ruta" and "Duplicar". The parent owns the list
// (it submits it with the route); this only edits it. It renders its own
// <form>, so the parent must not put it inside another one: "Agregar a la
// lista" must not submit the route.
export function RouteStopsEditor({
  idPrefix,
  stops,
  onChange,
  loading = false,
  loadingLabel,
  title,
  emptyText,
  addTitle,
  addLabel,
}: {
  idPrefix: string;
  stops: DraftStop[];
  onChange: Dispatch<SetStateAction<DraftStop[]>>;
  loading?: boolean;
  loadingLabel?: string;
  title?: string;
  emptyText: string;
  addTitle: string;
  addLabel: string;
}) {
  const { t, language } = useTranslation();

  const [customerName, setCustomerName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Bumped to remount <AddressSearch>, which keeps its own input text.
  const [searchKey, setSearchKey] = useState(0);

  function resetForm() {
    setCustomerName("");
    setInstructions("");
    setPlace(null);
    setSubmitted(false);
    setSearchKey((k) => k + 1);
  }

  function addStop(event: React.FormEvent) {
    // The editor can sit inside a Radix portal that React still bubbles
    // through to the parent's <form>; keep the add from submitting it.
    event.preventDefault();
    event.stopPropagation();
    setSubmitted(true);
    const name = customerName.trim();
    if (!name || !place) return;
    onChange((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        customerName: name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        instructions: instructions.trim() || null,
      },
    ]);
    resetForm();
  }

  function move(index: number, delta: -1 | 1) {
    onChange((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target] as DraftStop, next[index] as DraftStop];
      return next;
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {title && <h3 className="text-sm font-medium text-text">{title}</h3>}

        {loading && (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label={loadingLabel}>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {!loading && stops.length === 0 && <p className="text-sm text-outline">{emptyText}</p>}

        {stops.length > 0 && (
          <ol className="flex max-h-56 flex-col gap-2 overflow-y-auto">
            {stops.map((stop, index) => (
              <li
                key={stop.key}
                className="flex items-center gap-3 rounded-md border border-outline/20 px-3 py-2"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{stop.customerName}</p>
                  <p className="truncate text-xs text-outline">{stop.address}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={iconButtonClass}
                    aria-label={`${t.stops.moveUp}: ${stop.customerName}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClass}
                    aria-label={`${t.stops.moveDown}: ${stop.customerName}`}
                    disabled={index === stops.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClass}
                    aria-label={`${t.stops.delete}: ${stop.customerName}`}
                    onClick={() => onChange((prev) => prev.filter((s) => s.key !== stop.key))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={addStop}
        noValidate
        className="flex flex-col gap-3 rounded-md border border-outline/20 bg-outline/5 p-4"
      >
        <h3 className="text-sm font-medium text-text">{addTitle}</h3>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-stop-customer`} className="text-xs text-outline">
            {t.stops.customerLabel}
          </label>
          <Input
            id={`${idPrefix}-stop-customer`}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          {submitted && !customerName.trim() && <FieldError>{t.stops.customerRequired}</FieldError>}
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
            </p>
          )}
          {submitted && !place && <FieldError>{t.stops.addressRequired}</FieldError>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-stop-instructions`} className="text-xs text-outline">
            {t.stops.instructionsLabel}
          </label>
          <Textarea
            id={`${idPrefix}-stop-instructions`}
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
          >
            {addLabel}
          </button>
        </div>
      </form>
    </>
  );
}
