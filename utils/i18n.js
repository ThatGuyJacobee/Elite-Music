const fs = require("fs");
const path = require("path");

const FALLBACK_LOCALE = "en-GB";

function getNestedValue(target, key) {
    return String(key)
        .split(".")
        .reduce((value, segment) => (value != null ? value[segment] : undefined), target);
}

function interpolate(template, variables = {}) {
    return String(template).replace(/\{(\w+)\}/g, (_, variableName) => {
        const value = variables[variableName];
        return value == null ? `{${variableName}}` : String(value);
    });
}

function loadLocales(localesDirectory) {
    const locales = {};

    if (!fs.existsSync(localesDirectory)) {
        return locales;
    }

    const localeFiles = fs.readdirSync(localesDirectory).filter((file) => file.endsWith(".json"));
    for (const localeFile of localeFiles) {
        const localeName = path.basename(localeFile, ".json");
        locales[localeName] = JSON.parse(fs.readFileSync(path.join(localesDirectory, localeFile), "utf8"));
    }

    return locales;
}

function getSupportedLocale(locales, locale) {
    if (!locale) {
        return null;
    }

    const availableLocales = Object.keys(locales);
    const normalizedLocale = String(locale).trim().replaceAll("_", "-");
    const exactLocale = availableLocales.find((name) => name.toLowerCase() === normalizedLocale.toLowerCase());
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

function createI18n(options = {}) {
    const localesDirectory = options.localesDirectory ?? path.join(process.cwd(), "locales");
    const fallbackLocale = options.fallbackLocale ?? FALLBACK_LOCALE;
    const locales = loadLocales(localesDirectory);

    return {
        fallbackLocale,
        locales,
        getAvailableLocales() {
            return Object.keys(locales);
        },
        hasLocale(locale) {
            return Object.prototype.hasOwnProperty.call(locales, locale);
        },
        getSupportedLocale(locale) {
            return getSupportedLocale(locales, locale);
        },
        resolveLocale(locale) {
            return this.getSupportedLocale(locale) ?? fallbackLocale;
        },
        t(locale, key, variables = {}) {
            const resolvedLocale = this.resolveLocale(locale);
            const resolvedFallbackLocale = this.resolveLocale(fallbackLocale);
            const fallbackValue = getNestedValue(locales[resolvedFallbackLocale], key);
            const localizedValue = getNestedValue(locales[resolvedLocale], key);
            const value = localizedValue ?? fallbackValue ?? key;
            return typeof value === "string" ? interpolate(value, variables) : value;
        },
    };
}

module.exports = {
    FALLBACK_LOCALE,
    createI18n,
};
