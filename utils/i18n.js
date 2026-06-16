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
        t(locale, key, variables = {}) {
            const resolvedLocale = this.hasLocale(locale) ? locale : fallbackLocale;
            const fallbackValue = getNestedValue(locales[fallbackLocale], key);
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
