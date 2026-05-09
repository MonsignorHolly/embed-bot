const fs = require("fs");
require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    SlashCommandBuilder,
    REST,
    Routes,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionsBitField,
    AttachmentBuilder
} = require("discord.js");

// ======================
// CONFIG
// ======================

const ADMIN_ROLE_ID = "1502506274292633670";
function hasAccess(member) {
    return member.roles.cache.has(ADMIN_ROLE_ID);
}

const TOKEN = process.env.TOKEN;
const EMBED_COLOR = "#1302d1";

const WELCOME_CHANNEL_ID = "1484591887997206732";
const WELCOME_IMAGE_URL = "https://cdn.discordapp.com/attachments/1180856807166586991/1502494064707240100/Navrh_bez_nazvu.png";

const SUPPORT_ROLE_ID = "1484591886940377219";
const TRANSCRIPT_CHANNEL_ID = "1502368876892127342";

const TICKET_CATEGORIES = {
    frakce: "1485272944270901420",
    ck: "1502366579625820340",
    shop: "1502366748517601451",
    podpora: "1485272897453953035",
    report: "1502366625238876201",
    partner: "1502366896811675658"
};

// ======================
// REACTION ROLES (FIXED)
// ======================

const RR_FILE = "./reactionRoles.json";

let reactionRoles = {};

if (fs.existsSync(RR_FILE)) {
    reactionRoles = JSON.parse(fs.readFileSync(RR_FILE, "utf8"));
}

function saveRR() {
    fs.writeFileSync(RR_FILE, JSON.stringify(reactionRoles, null, 2));
}

// ======================
// CLIENT
// ======================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// ======================
// EDITORS
// ======================

const editors = new Map();
const rrEditors = new Map();

// ======================
// COMMANDS
// ======================

const commands = [
    new SlashCommandBuilder().setName("ticket-panel").setDescription("Vytvoří ticket-panel"),

    new SlashCommandBuilder().setName("embed").setDescription("Vytvoří nový embed"),

    new SlashCommandBuilder()
        .setName("embed-editor")
        .setDescription("Upraví existující embed")
        .addStringOption(opt =>
            opt.setName("message_id").setDescription("ID zprávy").setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Seznam příkazů")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ======================
// READY
// ======================

client.once("ready", async () => {
    console.log(`✅ Logged as ${client.user.tag}`);

    await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
    );
});

// ======================
// HELP FUNCTION
// ======================

function rrEmbed(messageId) {
    const data = reactionRoles[messageId];
    if (!data) return null;

    const desc = Object.entries(data.roles || {})
        .map(([emoji, role]) => `${emoji} → <@&${role}>`)
        .join("\n") || "Žádné role";

    return new EmbedBuilder()
        .setTitle("🎭 Reaction Roles")
        .setDescription(desc)
        .setColor(EMBED_COLOR);
}

// ======================
// INTERACTIONS
// ======================

client.on("interactionCreate", async interaction => {

    // ======================
    // SLASH
    // ======================

    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === "help") {
            return interaction.reply({
                ephemeral: true,
                embeds: [
                    new EmbedBuilder()
                        .setTitle("📘 Help")
                        .setColor(EMBED_COLOR)
                        .setDescription("🎫 /ticket-panel\n🧾 /embed\n🛠️ /embed-editor")
                ]
            });
        }

        // ======================
        // TICKET PANEL (FIXED)
        // ======================

        if (interaction.commandName === "ticket-panel") {
            if (!hasAccess(interaction.member))
                return interaction.reply({ content: "❌ No access", ephemeral: true });

            const menu = new StringSelectMenuBuilder()
                .setCustomId("ticket_select")
                .setPlaceholder("Vyber kategorii")
                .addOptions([
                    { label: "Podpora", value: "podpora", emoji: "🛠️" },
                    { label: "Report", value: "report", emoji: "🚨" },
                    { label: "Partner", value: "partner", emoji: "🤝" },
                    { label: "Frakce", value: "frakce", emoji: "🏛️" },
                    { label: "CK", value: "ck", emoji: "☠️" },
                    { label: "Shop", value: "shop", emoji: "🛒" }
                ]);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🎫 Ticket Systém")
                        .setColor(EMBED_COLOR)
                ],
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

        // ======================
        // EMBED (FIXED)
        // ======================

        if (interaction.commandName === "embed") {
            if (!hasAccess(interaction.member))
                return interaction.reply({ content: "❌ No access", ephemeral: true });

            const modal = new ModalBuilder()
                .setCustomId("embed_create")
                .setTitle("Vytvořit embed");

            const fields = [
                ["title", "Title", TextInputStyle.Short],
                ["desc", "Description", TextInputStyle.Paragraph],
                ["color", "Color", TextInputStyle.Short],
                ["thumb", "Thumbnail", TextInputStyle.Short],
                ["image", "Image", TextInputStyle.Short]
            ];

            modal.addComponents(
                ...fields.map(f =>
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId(f[0])
                            .setLabel(f[1])
                            .setStyle(f[2])
                            .setRequired(false)
                    )
                )
            );

            return interaction.showModal(modal);
        }

        // ======================
        // EMBED EDITOR (FIXED SAVE + COPY + SAFE STATE)
        // ======================

        if (interaction.commandName === "embed-editor") {
            if (!hasAccess(interaction.member))
                return interaction.reply({ content: "❌ No access", ephemeral: true });

            await interaction.deferReply({ ephemeral: true });

            const id = interaction.options.getString("message_id");

            let msg;
            try {
                msg = await interaction.channel.messages.fetch(id);
            } catch {
                return interaction.editReply("❌ Nenalezeno");
            }

            if (!msg.embeds[0]) return interaction.editReply("❌ No embed");

            editors.set(interaction.user.id, {
                messageId: id,
                channelId: interaction.channel.id,
                embed: EmbedBuilder.from(msg.embeds[0])
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("edit_title").setLabel("Title").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("edit_desc").setLabel("Desc").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("edit_color").setLabel("Color").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("edit_image").setLabel("Image").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("editor_copy").setLabel("Copy").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("save_embed").setLabel("Save").setStyle(ButtonStyle.Success)
            );

            return interaction.editReply({
                content: "🛠️ Editor aktivní",
                components: [row]
            });
        }
    }

    // ======================
    // BUTTONS
    // ======================

    if (interaction.isButton()) {

        const editor = editors.get(interaction.user.id);

        // COPY
        if (interaction.customId === "editor_copy") {
            if (!editor)
                return interaction.reply({ content: "❌ Expired", ephemeral: true });

            const e = editor.embed;

            const text = `
TITLE: ${e.data.title || "none"}
DESC: ${e.data.description || "none"}
COLOR: ${e.data.color || "none"}
            `.trim();

            return interaction.reply({
                ephemeral: true,
                files: [{ attachment: Buffer.from(text), name: "embed.txt" }]
            });
        }

        // SAVE
        if (interaction.customId === "save_embed") {
            if (!editor)
                return interaction.reply({ content: "❌ Expired", ephemeral: true });

            const msg = await interaction.channel.messages.fetch(editor.messageId);
            await msg.edit({ embeds: [editor.embed] });

            editors.delete(interaction.user.id);

            return interaction.reply({ content: "💾 Saved", ephemeral: true });
        }

        // EDIT MODAL
        if (editor) {
            const modal = new ModalBuilder()
                .setCustomId(interaction.customId)
                .setTitle("Edit");

            const input = new TextInputBuilder()
                .setCustomId("value")
                .setLabel("Value")
                .setStyle(TextInputStyle.Short);

            modal.addComponents(new ActionRowBuilder().addComponents(input));

            return interaction.showModal(modal);
        }
    }

    // ======================
    // MODALS
    // ======================

    if (interaction.isModalSubmit()) {

        const editor = editors.get(interaction.user.id);
        if (!editor) return;

        const value = interaction.fields.getTextInputValue("value");

        if (interaction.customId === "edit_title") editor.embed.setTitle(value);
        if (interaction.customId === "edit_desc") editor.embed.setDescription(value);
        if (interaction.customId === "edit_color") editor.embed.setColor(value);
        if (interaction.customId === "edit_image") editor.embed.setImage(value);

        return interaction.reply({ content: "✔ OK", ephemeral: true });
    }
});

// ======================
// REACTION ROLES
// ======================

client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) return;

    const data = reactionRoles[reaction.message.id];
    if (!data) return;

    const roleId = data.roles[reaction.emoji.name];
    if (!roleId) return;

    const member = await reaction.message.guild.members.fetch(user.id);
    member.roles.add(roleId).catch(() => {});
});

client.on("messageReactionRemove", async (reaction, user) => {
    if (user.bot) return;

    const data = reactionRoles[reaction.message.id];
    if (!data) return;

    const roleId = data.roles[reaction.emoji.name];
    if (!roleId) return;

    const member = await reaction.message.guild.members.fetch(user.id);
    member.roles.remove(roleId).catch(() => {});
});

// ======================
// LOGIN
// ======================

client.login(TOKEN);