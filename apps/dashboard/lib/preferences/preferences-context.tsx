"use client";

import type { Language, MapView, Theme } from "@torpreca/shared";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getPreferences, updatePreferences } from "@/lib/api/preferences-client";
import { readCachedPreferences, writeCachedPreferences } from "./preferences-cache";

type PreferencesContextValue = {
  theme: Theme;
  language: Language;
  defaultMapView: MapView | null;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  saveDefaultMapView: (view: MapView | null) => void;
};

// A real default (not null) — so a component that calls usePreferences()
// without a <PreferencesProvider> ancestor (every existing unit test, which
// renders pages standalone) gets the Spanish/system defaults instead of a
// thrown "must be used within a provider" error. The provider itself is
// always mounted in production (app/providers.tsx), so this fallback only
// ever matters in isolated renders like tests.
const DEFAULT_CONTEXT_VALUE: PreferencesContextValue = {
  theme: "system",
  language: "es",
  defaultMapView: null,
  setTheme: () => {},
  setLanguage: () => {},
  saveDefaultMapView: () => {},
};

const PreferencesContext = createContext<PreferencesContextValue>(DEFAULT_CONTEXT_VALUE);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const cached = readCachedPreferences();
  const [theme, setThemeState] = useState<Theme>(cached.theme);
  const [language, setLanguageState] = useState<Language>(cached.language);
  const [defaultMapView, setDefaultMapView] = useState<MapView | null>(cached.defaultMapView);

  // Manual override wins outright (data-theme="light"/"dark"); "system"
  // removes the attribute so globals.css's prefers-color-scheme media query
  // takes over again — see the [data-theme] rules added there for TOR-131.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  // Reconciles with the backend once per mount. If there's no session yet
  // (login page) this 401s and is ignored — the cached/default values above
  // already painted, same "cache first, reconcile after" pattern as
  // lib/auth/session-cache.ts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getPreferences();
      if (!result.ok || cancelled) return;
      const { theme: nextTheme, language: nextLanguage, defaultMapView: nextView } =
        result.preferences;
      setThemeState(nextTheme);
      setLanguageState(nextLanguage);
      setDefaultMapView(nextView);
      writeCachedPreferences({ theme: nextTheme, language: nextLanguage, defaultMapView: nextView });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      writeCachedPreferences({ theme: next, language, defaultMapView });
      void updatePreferences({ theme: next });
    },
    [language, defaultMapView],
  );

  const setLanguage = useCallback(
    (next: Language) => {
      setLanguageState(next);
      writeCachedPreferences({ theme, language: next, defaultMapView });
      void updatePreferences({ language: next });
    },
    [theme, defaultMapView],
  );

  const saveDefaultMapView = useCallback(
    (view: MapView | null) => {
      setDefaultMapView(view);
      writeCachedPreferences({ theme, language, defaultMapView: view });
      void updatePreferences({ defaultMapView: view });
    },
    [theme, language],
  );

  return (
    <PreferencesContext.Provider
      value={{ theme, language, defaultMapView, setTheme, setLanguage, saveDefaultMapView }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
