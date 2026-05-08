const fs = require("fs");

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

require("dotenv").config();

// ======================
// CONFIG
// ======================

const SUPPORT_ROLE_ID = "1484591886940377219";
const TRANSCRIPT_CHANNEL_ID = "1502368876892127342";

const TICKET_CATEGORIES = {
    frakce: "1485272944270901420",
    ck: "1502366579625820340",
    shop: "1502366748517601451",
    pomoc: "1485272897453953035",
    report: "1502366625238876201",
    partner: "1502366896811675658"
};

// ======================
// CLIENT
// ======================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// embed editor storage
const editors = new Map();

// ======================
// COMMANDS
// ======================

const commands = [
    new SlashCommandBuilder()
        .setName("ticket-panel")
        .setDescription("Otevře ticket menu"),

    new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Vytvořit embed"),

    new SlashCommandBuilder()
        .setName("embed-editor")
        .setDescription("Upravit embed")
        .addStringOption(opt =>
            opt.setName("message_id")
                .setDescription("ID zprávy")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Přehled příkazů")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

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
// INTERACTIONS
// ======================

client.on("interactionCreate", async interaction => {

    // =================================================
    // SLASH COMMANDS
    // =================================================

    if (interaction.isChatInputCommand()) {

        // HELP
        if (interaction.commandName === "help") {

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("📘 Help")
                        .setColor("#ffc414")
                        .setDescription(
                            "**🎫 Ticket**\n/ticket-panel\n\n" +
                            "**🧾 Embed**\n/embed\n/embed-editor\n\n" +
                            "**ℹ️ Info**\n/help"
                        )
                ],
                ephemeral: true
            });
        }

        // TICKET PANEL
        if (interaction.commandName === "ticket-panel") {

            const menu = new StringSelectMenuBuilder()
                .setCustomId("ticket_select")
                .setPlaceholder("Vyber kategorii")
                .addOptions([
                    { label: "Pomoc", value: "pomoc", emoji: "🛠️" },
                    { label: "Report", value: "report", emoji: "🚨" },
                    { label: "Partner", value: "partner", emoji: "🤝" },
                    { label: "Frakce", value: "frakce", emoji: "🏛️" },
                    { label: "CK", value: "ck", emoji: "☠️" },
                    { label: "Shop", value: "shop", emoji: "🛒" }
                ]);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🎫 Ticket System")
                        .setColor("#ffc414")
                ],
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

        // EMBED CREATOR
        if (interaction.commandName === "embed") {

            const modal = new ModalBuilder()
                .setCustomId("embed_create")
                .setTitle("Vytvořit Embed");

            const fields = [
                ["title", "Title", TextInputStyle.Short],
                ["desc", "Description", TextInputStyle.Paragraph],
                ["color", "Color (#ff0000)", TextInputStyle.Short],
                ["thumb", "Thumbnail URL", TextInputStyle.Short],
                ["image", "Image URL", TextInputStyle.Short]
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

        // EMBED EDITOR
        if (interaction.commandName === "embed-editor") {

            const id = interaction.options.getString("message_id");

            const msg = await interaction.channel.messages.fetch(id).catch(() => null);

            if (!msg || !msg.embeds[0]) {
                return interaction.reply({
                    content: "❌ Embed nenalezen",
                    ephemeral: true
                });
            }

            editors.set(interaction.user.id, {
                messageId: id,
                embed: EmbedBuilder.from(msg.embeds[0])
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("edit_title").setLabel("Title").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("edit_desc").setLabel("Desc").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("edit_color").setLabel("Color").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("edit_thumb").setLabel("Thumbnail").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("edit_image").setLabel("Image").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("save_embed").setLabel("Save").setStyle(ButtonStyle.Success)
            );

            return interaction.reply({
                content: "🛠️ Editor aktivní",
                components: [row],
                ephemeral: true
            });
        }
    }

    // =================================================
    // TICKETS
    // =================================================

    if (interaction.isStringSelectMenu()) {

        if (interaction.customId === "ticket_select") {

            const category = interaction.values[0];
            const categoryId = TICKET_CATEGORIES[category];

            if (!categoryId) {
                return interaction.reply({ content: "❌ Neplatná kategorie", ephemeral: true });
            }

            const existing = interaction.guild.channels.cache.find(c =>
                c.name.startsWith(`ticket-${category}-${interaction.user.id}`)
            );

            if (existing) {
                return interaction.reply({
                    content: "❌ Už máš ticket v této kategorii",
                    ephemeral: true
                });
            }

            const count = interaction.guild.channels.cache.filter(c =>
                c.name.startsWith(`ticket-${category}-`)
            ).size;

            const number = count + 1;

            const channel = await interaction.guild.channels.create({
                name: `ticket-${category}-${interaction.user.id}-${number}`,
                type: ChannelType.GuildText,
                parent: categoryId,

                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages
                        ]
                    },
                    {
                        id: SUPPORT_ROLE_ID,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages
                        ]
                    }
                ]
            });

            const close = new ButtonBuilder()
                .setCustomId("close_ticket")
                .setLabel("Zavřít ticket")
                .setStyle(ButtonStyle.Danger);

            await channel.send({
                content: `<@${interaction.user.id}>`,
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🎫 Ticket")
                        .setDescription(`Kategorie: ${category}`)
                        .setColor("#00ff99")
                ],
                components: [new ActionRowBuilder().addComponents(close)]
            });

            return interaction.reply({
                content: `✅ Ticket vytvořen: ${channel}`,
                ephemeral: true
            });
        }
    }

    // =================================================
    // BUTTONS (CLOSE + EMBED EDITOR)
    // =================================================

    if (interaction.isButton()) {

        // CLOSE TICKET
        if (interaction.customId === "close_ticket") {

            const messages = await interaction.channel.messages.fetch({ limit: 100 });

            const transcript = messages
                .map(m =>
                    `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`
                )
                .reverse()
                .join("\n");

            const fileName = `transcript-${interaction.channel.id}.txt`;

            fs.writeFileSync(fileName, transcript);

            const file = new AttachmentBuilder(fileName);

            const logChannel =
                interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID);

            if (logChannel) {
                await logChannel.send({
                    content: "📄 Ticket transcript",
                    files: [file]
                });
            }

            await interaction.reply({ content: "🔒 Zavírám ticket..." });

            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
                fs.unlinkSync(fileName);
            }, 3000);
        }

        // ======================
        // EMBED EDITOR BUTTONS
        // ======================

        const editor = editors.get(interaction.user.id);
        if (!editor) return;

        const { embed, messageId } = editor;

        if (interaction.customId === "save_embed") {

            const msg = await interaction.channel.messages.fetch(messageId);

            await msg.edit({ embeds: [embed] });

            editors.delete(interaction.user.id);

            return interaction.reply({
                content: "💾 Uloženo",
                ephemeral: true
            });
        }

        const modal = new ModalBuilder();

        const input = new TextInputBuilder()
            .setCustomId("value")
            .setStyle(TextInputStyle.Short);

        if (interaction.customId === "edit_title") {
            modal.setCustomId("modal_title").setTitle("Title");
            input.setLabel("Title");
        }

        if (interaction.customId === "edit_desc") {
            modal.setCustomId("modal_desc").setTitle("Description");
            input.setStyle(TextInputStyle.Paragraph);
            input.setLabel("Description");
        }

        if (interaction.customId === "edit_color") {
            modal.setCustomId("modal_color").setTitle("Color");
            input.setLabel("#ff0000");
        }

        if (interaction.customId === "edit_thumb") {
            modal.setCustomId("modal_thumb").setTitle("Thumbnail");
            input.setLabel("URL");
        }

        if (interaction.customId === "edit_image") {
            modal.setCustomId("modal_image").setTitle("Image");
            input.setLabel("URL");
        }

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
    }

    // =================================================
    // MODALS
    // =================================================

    if (interaction.isModalSubmit()) {

        const editor = editors.get(interaction.user.id);
        if (!editor) return;

        const value = interaction.fields.getTextInputValue("value");

        if (interaction.customId === "modal_title") editor.embed.setTitle(value);
        if (interaction.customId === "modal_desc") editor.embed.setDescription(value);
        if (interaction.customId === "modal_color") editor.embed.setColor(value);
        if (interaction.customId === "modal_thumb") editor.embed.setThumbnail(value);
        if (interaction.customId === "modal_image") editor.embed.setImage(value);

        return interaction.reply({
            content: "✔ Upraveno",
            ephemeral: true
        });
    }
});

// ======================
// LOGIN
// ======================

client.login(process.env.TOKEN);