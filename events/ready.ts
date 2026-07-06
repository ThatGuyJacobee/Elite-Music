import "dotenv/config";
import type { ExtendedClient } from "../types";
import { CONFIG_SECRET_KEYS, checkLatestRelease, redactConfigSecrets } from "../utils/utilityFunctions";
import { ping as subsonicPing } from "../utils/subsonicAPI";
import { jellyfinPing } from "../utils/jellyfinAPI";
import { defaultConsts } from "../utils/defaultConsts";
import { createI18n } from "../utils/i18n";

const client = (globalThis as any).client as ExtendedClient;

export default {
    name: "clientReady",
    once: true,
    async execute(): Promise<void> {
        // Configuration checks & initialisation
        client.config = defaultConsts.config;

        // eslint-disable-next-line no-async-promise-executor
        new Promise<void>(async (resolve, reject) => {
            client.config.embedColour =
                typeof process.env.EMBED_COLOUR === "undefined"
                    ? client.config.embedColour
                    : /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(process.env.EMBED_COLOUR!)
                      ? process.env.EMBED_COLOUR!
                      : client.config.embedColour;

            client.config.presence =
                typeof process.env.PRESENCE === "undefined"
                    ? client.config.presence
                    : String(process.env.PRESENCE)
                      ? process.env.PRESENCE!
                      : client.config.presence;

            client.config.leaveOnEmpty =
                typeof process.env.LEAVE_ON_EMPTY === "undefined"
                    ? client.config.leaveOnEmpty
                    : String(process.env.LEAVE_ON_EMPTY) === "true"
                      ? true
                      : false;

            client.config.leaveOnEmptyCooldown =
                typeof process.env.LEAVE_ON_EMPTY_COOLDOWN === "undefined"
                    ? client.config.leaveOnEmptyCooldown
                    : Number(process.env.LEAVE_ON_EMPTY_COOLDOWN)
                      ? Number(process.env.LEAVE_ON_EMPTY_COOLDOWN)
                      : client.config.leaveOnEmptyCooldown;

            client.config.leaveOnEnd =
                typeof process.env.LEAVE_ON_END === "undefined"
                    ? client.config.leaveOnEnd
                    : String(process.env.LEAVE_ON_END) === "true"
                      ? true
                      : false;

            client.config.leaveOnEndCooldown =
                typeof process.env.LEAVE_ON_END_COOLDOWN === "undefined"
                    ? client.config.leaveOnEndCooldown
                    : Number(process.env.LEAVE_ON_END_COOLDOWN)
                      ? Number(process.env.LEAVE_ON_END_COOLDOWN)
                      : client.config.leaveOnEndCooldown;

            client.config.leaveOnStop =
                typeof process.env.LEAVE_ON_STOP === "undefined"
                    ? client.config.leaveOnStop
                    : String(process.env.LEAVE_ON_STOP) === "true"
                      ? true
                      : false;

            client.config.leaveOnStopCooldown =
                typeof process.env.LEAVE_ON_STOP_COOLDOWN === "undefined"
                    ? client.config.leaveOnStopCooldown
                    : Number(process.env.LEAVE_ON_STOP_COOLDOWN)
                      ? Number(process.env.LEAVE_ON_STOP_COOLDOWN)
                      : client.config.leaveOnStopCooldown;

            client.config.selfDeafen =
                typeof process.env.SELF_DEAFEN === "undefined"
                    ? client.config.selfDeafen
                    : String(process.env.SELF_DEAFEN) === "true"
                      ? true
                      : false;

            client.config.defaultVolume =
                typeof process.env.DEFAULT_VOLUME === "undefined"
                    ? client.config.defaultVolume
                    : Number(process.env.DEFAULT_VOLUME) <= 100 && Number(process.env.DEFAULT_VOLUME) >= 0
                      ? Number(process.env.DEFAULT_VOLUME)
                      : client.config.defaultVolume;

            client.config.smoothVolume =
                typeof process.env.SMOOTH_VOLUME === "undefined"
                    ? client.config.smoothVolume
                    : String(process.env.SMOOTH_VOLUME) === "true"
                      ? true
                      : false;

            client.config.enableDjMode =
                typeof process.env.ENABLE_DJMODE === "undefined"
                    ? client.config.enableDjMode
                    : String(process.env.ENABLE_DJMODE) === "true"
                      ? true
                      : false;

            client.config.djRole =
                typeof process.env.DJ_ROLE === "undefined"
                    ? client.config.djRole
                    : Number(process.env.DJ_ROLE)
                      ? process.env.DJ_ROLE!
                      : client.config.djRole;

            client.config.enablePlex =
                typeof process.env.ENABLE_PLEX === "undefined"
                    ? client.config.enablePlex
                    : String(process.env.ENABLE_PLEX) === "true"
                      ? true
                      : false;

            client.config.plexServer =
                typeof process.env.PLEX_SERVER === "undefined"
                    ? client.config.plexServer
                    : String(process.env.PLEX_SERVER)
                      ? process.env.PLEX_SERVER!
                      : client.config.plexServer;

            client.config.plexAuthtoken =
                typeof process.env.PLEX_AUTHTOKEN === "undefined"
                    ? client.config.plexAuthtoken
                    : String(process.env.PLEX_AUTHTOKEN)
                      ? process.env.PLEX_AUTHTOKEN!
                      : client.config.plexAuthtoken;

            client.config.enableSubsonic =
                typeof process.env.ENABLE_SUBSONIC === "undefined"
                    ? client.config.enableSubsonic
                    : String(process.env.ENABLE_SUBSONIC) === "true"
                      ? true
                      : false;

            client.config.subsonicServer =
                typeof process.env.SUBSONIC_SERVER === "undefined"
                    ? client.config.subsonicServer
                    : String(process.env.SUBSONIC_SERVER)
                      ? process.env.SUBSONIC_SERVER!
                      : client.config.subsonicServer;

            client.config.subsonicUser =
                typeof process.env.SUBSONIC_USER === "undefined"
                    ? client.config.subsonicUser
                    : String(process.env.SUBSONIC_USER)
                      ? process.env.SUBSONIC_USER!
                      : client.config.subsonicUser;

            client.config.subsonicPass =
                typeof process.env.SUBSONIC_PASS === "undefined"
                    ? client.config.subsonicPass
                    : String(process.env.SUBSONIC_PASS)
                      ? process.env.SUBSONIC_PASS!
                      : client.config.subsonicPass;

            client.config.subsonicAppName =
                typeof process.env.SUBSONIC_APP_NAME === "undefined"
                    ? client.config.subsonicAppName
                    : String(process.env.SUBSONIC_APP_NAME)
                      ? process.env.SUBSONIC_APP_NAME!
                      : client.config.subsonicAppName;

            client.config.subsonicApiVersion =
                typeof process.env.SUBSONIC_API_VERSION === "undefined"
                    ? client.config.subsonicApiVersion
                    : String(process.env.SUBSONIC_API_VERSION)
                      ? process.env.SUBSONIC_API_VERSION!
                      : client.config.subsonicApiVersion;

            client.config.enableJellyfin =
                typeof process.env.ENABLE_JELLYFIN === "undefined"
                    ? client.config.enableJellyfin
                    : String(process.env.ENABLE_JELLYFIN) === "true"
                      ? true
                      : false;

            client.config.jellyfinServer =
                typeof process.env.JELLYFIN_SERVER === "undefined"
                    ? client.config.jellyfinServer
                    : String(process.env.JELLYFIN_SERVER)
                      ? process.env.JELLYFIN_SERVER!
                      : client.config.jellyfinServer;

            client.config.jellyfinUser =
                typeof process.env.JELLYFIN_USER === "undefined"
                    ? client.config.jellyfinUser
                    : String(process.env.JELLYFIN_USER)
                      ? process.env.JELLYFIN_USER!
                      : client.config.jellyfinUser;

            client.config.jellyfinPass =
                typeof process.env.JELLYFIN_PASS === "undefined"
                    ? client.config.jellyfinPass
                    : String(process.env.JELLYFIN_PASS)
                      ? process.env.JELLYFIN_PASS!
                      : client.config.jellyfinPass;

            // Perform validation checks
            if (client.config.enablePlex) {
                const controller = new AbortController();
                setTimeout(
                    () =>
                        controller.abort(
                            "Fetch aborted: Plex Server URL must be invalid as request received no response.",
                        ),
                    3000,
                );

                await fetch(
                    `${client.config.plexServer}/search/?X-Plex-Token=${client.config.plexAuthtoken}&query=test&limit=1`,
                    {
                        method: "GET",
                        headers: { accept: "application/json" },
                        signal: controller.signal,
                    },
                )
                    .then((search) => {
                        if (search.status === 401) {
                            console.log(
                                "[ELITE_CONFIG] Plex configuration is invalid. Disabling Plex feature... Your Plex Authentication token is not valid.",
                            );
                            client.config.enablePlex = false;
                        } else if (search.status !== 200) {
                            console.log(
                                "[ELITE_CONFIG] Plex configuration is invalid. Disabling Plex feature... Generic error.",
                            );
                            client.config.enablePlex = false;
                        }
                    })
                    .catch((err: unknown) => {
                        if (controller.signal.aborted) {
                            console.log(
                                `[ELITE_CONFIG] Plex configuration is invalid. Disabling Plex feature... Read more in the trace below:\n${controller.signal.reason}`,
                            );
                        } else {
                            console.log(
                                `[ELITE_CONFIG] Plex configuration is invalid. Disabling Plex feature... Read more in the trace below:\n${err}`,
                            );
                        }
                        client.config.enablePlex = false;
                    });
            }

            if (client.config.enableSubsonic) {
                const controller = new AbortController();
                setTimeout(
                    () =>
                        controller.abort(
                            "Fetch aborted: Subsonic Server URL must be invalid as request received no response.",
                        ),
                    3000,
                );

                try {
                    await subsonicPing(client.config, { signal: controller.signal });
                } catch (err: unknown) {
                    if (controller.signal.aborted) {
                        console.log(
                            `[ELITE_CONFIG] Subsonic configuration is invalid. Disabling Subsonic feature... Read more in the trace below:\n${controller.signal.reason}`,
                        );
                    } else {
                        console.log(
                            `[ELITE_CONFIG] Subsonic configuration is invalid. Disabling Subsonic feature... Read more in the trace below:\n${err instanceof Error ? err.message : err}`,
                        );
                    }
                    client.config.enableSubsonic = false;
                }
            }

            if (client.config.enableJellyfin) {
                const controller = new AbortController();
                setTimeout(
                    () =>
                        controller.abort(
                            "Fetch aborted: Jellyfin Server URL must be invalid as request received no response.",
                        ),
                    3000,
                );

                try {
                    await jellyfinPing(client.config, { signal: controller.signal });
                } catch (err: unknown) {
                    if (controller.signal.aborted) {
                        console.log(
                            `[ELITE_CONFIG] Jellyfin configuration is invalid. Disabling Jellyfin feature... Read more in the trace below:\n${controller.signal.reason}`,
                        );
                    } else {
                        console.log(
                            `[ELITE_CONFIG] Jellyfin configuration is invalid. Disabling Jellyfin feature... Read more in the trace below:\n${err instanceof Error ? err.message : err}`,
                        );
                    }
                    client.config.enableJellyfin = false;
                }
            }

            // Check for an outdated configuration
            if (process.env.CFG_VERSION == null || process.env.CFG_VERSION !== "1.9") {
                console.log(
                    "[ELITE_CONFIG] Your .ENV configuration file is outdated. This could mean that you may lose out on new functionality or new customisation options. Please check the latest config via https://github.com/ThatGuyJacobee/Elite-Music/blob/main/.env.example or the .env.example file as your bot version is ahead of your configuration version.",
                );
            }

            // Check for new releases
            const checkGitHub = await checkLatestRelease();
            if (checkGitHub !== false) {
                const latestRelease = (checkGitHub as any).tag_name;

                if ("v1.9" !== latestRelease) {
                    console.log(
                        `[ELITE_STATUS] Your bot is outdated. Please update to the latest major release version of Elite Music (${latestRelease}) to ensure that you have the latest features, bug fixes and security patches. You can find the latest release information here: ${(checkGitHub as any).html_url}`,
                    );
                } else {
                    console.log("[ELITE_STATUS] Your bot is up-to-date and running on the latest release!");
                }
            } else {
                console.log(
                    "[ELITE_STATUS] Could not check for updates. Please ensure that you have an active internet connection and that the GitHub API is not down.",
                );
            }

            resolve();
        }).then(() => {
            const verbose = process.env.VERBOSE ? process.env.VERBOSE.toLowerCase() : "none";
            const revealSecrets = verbose === "normal" || verbose === "full";
            const configForLog = redactConfigSecrets(client.config, { revealSecrets });

            console.log(
                `[ELITE_CONFIG] Configuration loaded... Current config:\n${JSON.stringify(configForLog, null, 3)}`,
            );

            const hadRedactedSecret =
                !revealSecrets &&
                ((client.config.plexAuthtoken && String(client.config.plexAuthtoken).length > 0) ||
                    (client.config.subsonicPass && String(client.config.subsonicPass).length > 0) ||
                    (client.config.jellyfinPass && String(client.config.jellyfinPass).length > 0));

            if (hadRedactedSecret) {
                console.log(
                    `[ELITE_CONFIG] Sensitive fields (${CONFIG_SECRET_KEYS.join(", ")}) are masked. Set VERBOSE to normal or full to print them.`,
                );
            }
            console.log(
                "Note: If some configuration option is incorrect, please double check that it is correctly set within your .ENV file!\nOtherwise, where a configuration option is invalid, the default from defaultConsts.js will be used.",
            );
            console.log("\n[ELITE_STATUS] Loading successful. Core of the bot is ready!");

            // Initialise i18n
            client.i18n = createI18n();
            client.t = (key: string, variables: Record<string, any> = {}, locale: string = "en-GB") => {
                return client.i18n?.t(locale, key, variables) ?? key;
            };
        });

        client.user!.setActivity(client.config.presence, { type: 2 });
    },
};
