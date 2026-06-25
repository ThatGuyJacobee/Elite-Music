const fs = require("fs");
const path = require("path");
const { translate } = require("./botText");

const COMMANDS_DIR = path.join(__dirname, "..", "commands");

const HELP_CATEGORY_EMOJIS = {
    music: "🎵",
    utilities: "🛄",
};

function translateCommandDescription(source, commandName, subcommandName = null) {
    const key = subcommandName ? `commands.${commandName}.${subcommandName}` : `commands.${commandName}`;
    const localized = translate(source, key);

    if (localized === key) {
        return translate(source, "help.noDescription");
    }

    return localized;
}

function loadHelpCommandCategories(source) {
    const categories = [];

    fs.readdirSync(COMMANDS_DIR).forEach((dir) => {
        const commandFiles = fs.readdirSync(path.join(COMMANDS_DIR, dir)).filter((file) => file.endsWith(".js"));
        const cmds = [];

        commandFiles.forEach((commandFile) => {
            const commandModule = require(path.join(COMMANDS_DIR, dir, commandFile));
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

            commandData.options.forEach((subcommand) => {
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

module.exports = {
    HELP_CATEGORY_EMOJIS,
    loadHelpCommandCategories,
    translateCommandDescription,
};
