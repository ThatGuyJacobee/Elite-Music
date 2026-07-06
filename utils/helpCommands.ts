import { readdirSync } from "fs";
import { join } from "path";
import { translate } from "./botText";

const COMMANDS_DIR = join(__dirname, "..", "commands");

export const HELP_CATEGORY_EMOJIS: Record<string, string> = {
    music: "🎵",
    utilities: "🛄",
};

function translateCommandDescription(source: any, commandName: string, subcommandName: string | null = null): string {
    const key = subcommandName ? `commands.${commandName}.${subcommandName}` : `commands.${commandName}`;
    const localized = translate(source, key);

    if (localized === key) {
        return translate(source, "help.noDescription");
    }

    return localized;
}

export function loadHelpCommandCategories(source: any): any[][] {
    const categories: any[][] = [];

    readdirSync(COMMANDS_DIR).forEach((dir) => {
        const commandFiles = readdirSync(join(COMMANDS_DIR, dir)).filter((file) => file.endsWith(".js"));
        const cmds: any[] = [];

        commandFiles.forEach((commandFile) => {
            const commandModule = require(join(COMMANDS_DIR, dir, commandFile));
            const commandData = commandModule.data;

            if (dir === "configuration" || dir === "utilities") {
                cmds.push({
                    name: dir,
                    commands: {
                        name: commandData.name,
                        description: translateCommandDescription(source, commandData.name),
                    },
                });
                return;
            }

            if (commandData.options.length === 0 || commandData.options[0].type != null) {
                cmds.push({
                    name: dir,
                    commands: {
                        name: commandData.name,
                        description: translateCommandDescription(source, commandData.name),
                    },
                });
                return;
            }

            commandData.options.forEach((subcommand: any) => {
                cmds.push({
                    name: dir,
                    commands: {
                        name: `${commandData.name} ${subcommand.name}`,
                        description: translateCommandDescription(source, commandData.name, subcommand.name),
                    },
                });
            });
        });

        categories.push(cmds.filter((entry) => entry.name === dir));
    });

    return categories;
}
