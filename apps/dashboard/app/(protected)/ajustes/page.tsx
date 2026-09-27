"use client";

import type { Language, Theme } from "@torpreca/shared";
import { useAuthUser } from "@/app/(protected)/auth-context";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n/use-translation";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { usePreferences } from "@/lib/preferences/preferences-context";

const MAP_ROLES = new Set(["admin", "supervisor", "super_admin"]);

export default function AjustesPage() {
  const { t } = useTranslation();
  usePageTitle(t.ajustes.title);
  const { theme, language, defaultMapView, setTheme, setLanguage, saveDefaultMapView } =
    usePreferences();
  const role = useAuthUser()?.role;
  const showMapSection = !!role && MAP_ROLES.has(role);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl text-text">{t.ajustes.title}</h1>
        <p className="text-sm text-outline">{t.ajustes.subtitle}</p>
      </div>

      <div className="flex flex-col gap-6 animate-fade-in">
        <Section title={t.ajustes.appearanceTitle}>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="theme" className="text-xs text-outline">
                {t.ajustes.themeLabel}
              </label>
              <Select
                id="theme"
                className="w-40"
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
              >
                <option value="system">{t.ajustes.themeSystem}</option>
                <option value="light">{t.ajustes.themeLight}</option>
                <option value="dark">{t.ajustes.themeDark}</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="language" className="text-xs text-outline">
                {t.ajustes.languageLabel}
              </label>
              <Select
                id="language"
                className="w-40"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                <option value="es">{t.ajustes.languageEs}</option>
                <option value="en">{t.ajustes.languageEn}</option>
              </Select>
            </div>
          </div>
        </Section>

        {showMapSection && (
          <Section title={t.ajustes.mapTitle} description={t.ajustes.defaultMapViewDescription}>
            {defaultMapView ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-text">
                  {t.ajustes.defaultMapViewSet}: {defaultMapView.lat.toFixed(4)},{" "}
                  {defaultMapView.lng.toFixed(4)} (zoom {defaultMapView.zoom.toFixed(1)})
                </p>
                <button
                  type="button"
                  onClick={() => saveDefaultMapView(null)}
                  className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
                >
                  {t.ajustes.clearDefaultMapView}
                </button>
              </div>
            ) : (
              <p className="text-sm text-outline">{t.ajustes.defaultMapViewNotSet}</p>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
