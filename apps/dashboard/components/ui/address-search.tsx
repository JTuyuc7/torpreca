"use client";

import { SearchBox } from "@mapbox/search-js-react";
import { useState } from "react";

// SearchBox renders through a Shadow DOM web component, so it can't be
// restyled with Tailwind classes — its theme.variables accepts CSS var()
// references directly (custom properties inherit through Shadow DOM), which
// keeps it in sync with the V2 light/dark tokens without hardcoding hex.
const THEME = {
  variables: {
    fontFamily: "var(--font-roboto), sans-serif",
    unitHeader: "0.875rem",
    borderRadius: "6px",
    boxShadow: "none",
    colorText: "var(--text)",
    colorPrimary: "var(--primary)",
    colorSecondary: "var(--outline)",
    colorBackground: "var(--background)",
    colorBackgroundHover: "var(--surface)",
  },
  // The widget's own bundled CSS hardcodes .Input's text color (#404040 /
  // rgba(0,0,0,.75)) instead of reading --colorText — invisible on the dark
  // theme's dark background. !important is required to beat that base rule.
  cssText: `
    .Input { height: 36px; border: 1px solid var(--outline); font-size: 0.875rem; color: var(--text) !important; }
    .Input:focus { outline: none; box-shadow: 0 0 0 1px var(--primary); color: var(--text) !important; }
    .ResultsList { border: 1px solid var(--outline); }
  `,
};

type Coordinates = { lng: number; lat: number };

export function AddressSearch({
  accessToken,
  proximity,
  onSelect,
  placeholder,
  language,
}: {
  accessToken: string;
  proximity?: Coordinates;
  onSelect: (coordinates: Coordinates, placeName: string) => void;
  placeholder: string;
  language: string;
}) {
  const [value, setValue] = useState("");

  return (
    <SearchBox
      accessToken={accessToken}
      value={value}
      onChange={setValue}
      placeholder={placeholder}
      theme={THEME}
      options={{
        language,
        country: "gt",
        limit: 5,
        proximity,
      }}
      onRetrieve={(res) => {
        const feature = res.features[0];
        if (!feature) return;
        const [lng, lat] = feature.geometry.coordinates;
        const placeName = feature.properties.name ?? value;
        onSelect({ lng, lat }, placeName);
        setValue(placeName);
      }}
    />
  );
}
