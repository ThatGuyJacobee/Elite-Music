const SUBCOMMAND_OPTION_TYPE = 1;
const DISCORD_DESCRIPTION_MAX_LENGTH = 100;
const DISCORD_CHOICE_NAME_MAX_LENGTH = 100;

function isResolvableString(value, key) {
    return typeof value === "string" && value !== key;
}

function clampDiscordText(value, maxLength) {
    if (typeof value !== "string" || value.length <= maxLength) {
        return value;
    }

    return value.slice(0, maxLength);
}

function buildLocalizationMap(i18n, key, primaryLocale, maxLength = DISCORD_DESCRIPTION_MAX_LENGTH) {
    const localizations = {};

    for (const locale of i18n.getAvailableLocales()) {
        if (locale === primaryLocale) continue;

        const value = i18n.t(locale, key);
        if (isResolvableString(value, key)) {
            localizations[locale] = clampDiscordText(value, maxLength);
        }
    }

    return Object.keys(localizations).length > 0 ? localizations : undefined;
}

function resolveLocalizedString(i18n, locale, key, maxLength = DISCORD_DESCRIPTION_MAX_LENGTH) {
    const value = i18n.t(locale, key);
    return isResolvableString(value, key) ? clampDiscordText(value, maxLength) : null;
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

function shouldRegisterSlashLocalizations(localeMode) {
    return localeMode === "user";
}

function applyLocalizedDescription(entity, i18n, locale, key, fallbackDescription, localeMode) {
    const localized = resolveLocalizedString(i18n, locale, key);

    if (localized) {
        entity.description = localized;
    } else if (fallbackDescription) {
        entity.description = clampDiscordText(fallbackDescription, DISCORD_DESCRIPTION_MAX_LENGTH);
    }

    if (!shouldRegisterSlashLocalizations(localeMode)) {
        delete entity.description_localizations;
        return;
    }

    const descriptionLocalizations = buildLocalizationMap(i18n, key, locale);
    if (descriptionLocalizations) {
        entity.description_localizations = descriptionLocalizations;
    }
}

function localizeChoices(option, i18n, locale, localeMode) {
    if (!option.choices) return;

    for (const choice of option.choices) {
        const choiceKey = resolveChoiceDescriptionKey(option.name, choice.value);
        const localized = resolveLocalizedString(i18n, locale, choiceKey);

        if (localized) {
            choice.name = localized;
        } else if (choice.name) {
            choice.name = clampDiscordText(choice.name, DISCORD_CHOICE_NAME_MAX_LENGTH);
        }

        if (!shouldRegisterSlashLocalizations(localeMode)) {
            delete choice.name_localizations;
            continue;
        }

        const nameLocalizations = buildLocalizationMap(i18n, choiceKey, locale, DISCORD_CHOICE_NAME_MAX_LENGTH);
        if (nameLocalizations) {
            choice.name_localizations = nameLocalizations;
        }
    }
}

function localizeOptions(options, i18n, locale, commandName, localeMode, subcommandName = null) {
    if (!options) return;

    for (const option of options) {
        if (option.type === SUBCOMMAND_OPTION_TYPE) {
            const resolved = resolveCommandDescription(i18n, locale, commandName, option.name);

            if (resolved) {
                applyLocalizedDescription(option, i18n, locale, resolved.key, option.description, localeMode);
            }

            localizeOptions(option.options, i18n, locale, commandName, localeMode, option.name);
            continue;
        }

        const optionKey = resolveOptionDescriptionKey(commandName, subcommandName, option.name);
        applyLocalizedDescription(option, i18n, locale, optionKey, option.description, localeMode);
        localizeChoices(option, i18n, locale, localeMode);
    }
}

function localizeSlashCommand(command, i18n, locale, localeMode = "global") {
    const localized = structuredClone(command);
    const resolved = resolveCommandDescription(i18n, locale, localized.name);

    if (resolved) {
        applyLocalizedDescription(localized, i18n, locale, resolved.key, localized.description, localeMode);
    }

    localizeOptions(localized.options, i18n, locale, localized.name, localeMode);
    return localized;
}

function localizeSlashCommands(commands, i18n, locale, localeMode = "global") {
    return commands.map((command) => localizeSlashCommand(command, i18n, locale, localeMode));
}

module.exports = {
    localizeSlashCommand,
    localizeSlashCommands,
};
