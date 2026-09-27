"use client";

import type { Language } from "@torpreca/shared";
import { usePreferences } from "@/lib/preferences/preferences-context";
import { en } from "./en";
import { es, type Messages } from "./es";

const DICTIONARIES: Record<Language, Messages> = { es, en };

// t is the whole nested dictionary for the active language (t.sidebar.rutas,
// t.login.title, ...) instead of a t("a.b.c") path-string lookup — every key
// reference is compile-time checked against Messages (see es.ts), so a typo
// or a missing translation is a build error, not a silent blank string.
export function useTranslation(): { t: Messages; language: Language } {
  const { language } = usePreferences();
  return { t: DICTIONARIES[language], language };
}
