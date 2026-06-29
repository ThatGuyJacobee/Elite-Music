import { readdirSync, readFileSync, existsSync } from "fs";
import { join, basename } from "path";

export const FALLBACK_LOCALE = "en-GB";

function getNestedValue(target: any, key: string): any {
  return String(key)
    .split(".")
    .reduce((value, segment) => (value != null ? value[segment] : undefined), target);
}

function interpolate(template: string, variables: Record<string, any> = {}): string {
  return String(template).replace(/\{(\w+)\}/g, (_, variableName) => {
    const value = variables[variableName];
    return value == null ? `{${variableName}}` : String(value);
  });
}

function loadLocales(localesDirectory: string): Record<string, any> {
  const locales: Record<string, any> = {};

  if (!existsSync(localesDirectory)) {
    return locales;
  }

  const localeFiles = readdirSync(localesDirectory).filter((file) => file.endsWith(".json"));
  for (const localeFile of localeFiles) {
    const localeName = basename(localeFile, ".json");
    locales[localeName] = JSON.parse(readFileSync(join(localesDirectory, localeFile), "utf8"));
  }

  return locales;
}

function getSupportedLocale(locales: Record<string, any>, locale: string | null): string | null {
  if (!locale) {
    return null;
  }

  const availableLocales = Object.keys(locales);
  const normalizedLocale = String(locale).trim().replaceAll("_", "-");
  const exactLocale = availableLocales.find(
    (name) => name.toLowerCase() === normalizedLocale.toLowerCase(),
  );
  if (exactLocale) {
    return exactLocale;
  }

  const baseLanguage = normalizedLocale.split("-")[0]?.toLowerCase();
  if (!baseLanguage) {
    return null;
  }

  const baseLocale = availableLocales.find((name) => name.toLowerCase() === baseLanguage);
  if (baseLocale) {
    return baseLocale;
  }

  return availableLocales.find((name) => name.toLowerCase().split("-")[0] === baseLanguage) ?? null;
}

export interface I18n {
  fallbackLocale: string;
  locales: Record<string, any>;
  getAvailableLocales(): string[];
  hasLocale(locale: string): boolean;
  getSupportedLocale(locale: string): string | null;
  resolveLocale(locale: string): string;
  t(locale: string, key: string, variables?: Record<string, any>): string;
}

export function createI18n(options: { localesDirectory?: string; fallbackLocale?: string } = {}): I18n {
  const localesDirectory = options.localesDirectory ?? join(process.cwd(), "locales");
  const fallbackLocale = options.fallbackLocale ?? FALLBACK_LOCALE;
  const locales = loadLocales(localesDirectory);

  return {
    fallbackLocale,
    locales,
    getAvailableLocales() {
      return Object.keys(locales);
    },
    hasLocale(locale: string) {
      return Object.prototype.hasOwnProperty.call(locales, locale);
    },
    getSupportedLocale(locale: string) {
      return getSupportedLocale(locales, locale);
    },
    resolveLocale(locale: string) {
      return this.getSupportedLocale(locale) ?? fallbackLocale;
    },
    t(locale: string, key: string, variables: Record<string, any> = {}): string {
      const resolvedLocale = this.resolveLocale(locale);
      const resolvedFallbackLocale = this.resolveLocale(fallbackLocale);
      const fallbackValue = getNestedValue(locales[resolvedFallbackLocale], key);
      const localizedValue = getNestedValue(locales[resolvedLocale], key);
      const value = localizedValue ?? fallbackValue ?? key;
      return typeof value === "string" ? interpolate(value, variables) : value;
    },
  };
}
