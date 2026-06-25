const SUBCOMMAND_OPTION_TYPE = 1;

function isResolvableString(value, key) {
    return typeof value === "string" && value !== key;
}

function buildLocalizationMap(i18n, key, defaultLocale) {
    const localizations = {};

    for (const locale of i18n.getAvailableLocales()) {
        if (locale === defaultLocale) continue;

        const value = i18n.t(locale, key);
        if (isResolvableString(value, key)) {
            localizations[locale] = value;
        }
    }

    return Object.keys(localizations).length > 0 ? localizations : undefined;
}

function resolveLocalizedString(i18n, locale, key) {
    const value = i18n.t(locale, key);
    return isResolvableString(value, key) ? value : null;
}

function resolveCommandDescription(i18n, locale, commandName, subcommandName = null) {
    if (subcommandName) {
        const key = `commands.${commandName}.${subcommandName}`;
        const value = i18n.t(locale, key);
        return isResolvableString(value, key) ? { text: value, key } : null;
    }

    const rootKey = `commands.${commandName}`;
    const rootValue = i18n.t(locale, rootKey);
    if (isResolvableString(rootValue, rootKey)) {
        return { text: rootValue, key: rootKey };
    }

    const descriptionKey = `commands.${commandName}.description`;
    const descriptionValue = i18n.t(locale, descriptionKey);
    if (isResolvableString(descriptionValue, descriptionKey)) {
        return { text: descriptionValue, key: descriptionKey };
    }

    return null;
}

function resolveOptionDescriptionKey(commandName, subcommandName, optionName) {
    if (optionName === "music") {
        if (subcommandName) {
            if (commandName === "plex" || commandName === "subsonic") {
                return "slash.options.music.library";
            }

            return `slash.options.music.${subcommandName}`;
        }

        return `slash.options.music.${commandName}`;
    }

    if (optionName === "song") {
        return `slash.options.song.${commandName}`;
    }

    return `slash.options.${optionName}`;
}

function resolveChoiceDescriptionKey(optionName, value) {
    if (optionName === "filter") {
        return `audiofilter.filters.${value}`;
    }

    return `slash.choices.${optionName}.${value}`;
}

function applyLocalizedDescription(entity, i18n, locale, key, fallbackDescription) {
    const localized = resolveLocalizedString(i18n, locale, key);

    if (localized) {
        entity.description = localized;
    } else if (fallbackDescription) {
        entity.description = fallbackDescription;
    }

    const descriptionLocalizations = buildLocalizationMap(i18n, key, locale);
    if (descriptionLocalizations) {
        entity.description_localizations = descriptionLocalizations;
    }
}

function localizeChoices(option, i18n, locale) {
    if (!option.choices) return;

    for (const choice of option.choices) {
        const choiceKey = resolveChoiceDescriptionKey(option.name, choice.value);
        const localized = resolveLocalizedString(i18n, locale, choiceKey);

        if (localized) {
            choice.name = localized;
        }

        const nameLocalizations = buildLocalizationMap(i18n, choiceKey, locale);
        if (nameLocalizations) {
            choice.name_localizations = nameLocalizations;
        }
    }
}

function localizeOptions(options, i18n, locale, commandName, subcommandName = null) {
    if (!options) return;

    for (const option of options) {
        if (option.type === SUBCOMMAND_OPTION_TYPE) {
            const resolved = resolveCommandDescription(i18n, locale, commandName, option.name);

            if (resolved) {
                applyLocalizedDescription(option, i18n, locale, resolved.key, option.description);
            }

            localizeOptions(option.options, i18n, locale, commandName, option.name);
            continue;
        }

        const optionKey = resolveOptionDescriptionKey(commandName, subcommandName, option.name);
        applyLocalizedDescription(option, i18n, locale, optionKey, option.description);
        localizeChoices(option, i18n, locale);
    }
}

function localizeSlashCommand(command, i18n, locale) {
    const localized = structuredClone(command);
    const resolved = resolveCommandDescription(i18n, locale, localized.name);

    if (resolved) {
        applyLocalizedDescription(localized, i18n, locale, resolved.key, localized.description);
    }

    localizeOptions(localized.options, i18n, locale, localized.name);
    return localized;
}

function localizeSlashCommands(commands, i18n, locale) {
    return commands.map((command) => localizeSlashCommand(command, i18n, locale));
}

module.exports = {
    localizeSlashCommand,
    localizeSlashCommands,
};
