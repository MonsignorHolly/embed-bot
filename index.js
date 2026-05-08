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

const TOKEN = process.env.TOKEN;

const EMBED_COLOR = "#1302d1";

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
        .setDescription("Vytvoří embed"),

    new SlashCommandBuilder()
        .setName("embed-editor")
        .setDescription("Upraví embed")
        .addStringOption(opt =>
            opt.setName("message_id")
                .setDescription("ID zprávy")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Help menu")
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
// INTERACTIONS
// ======================

client.on("interactionCreate", async interaction => {

    // ======================
    // SLASH COMMANDS
    // ======================

    if (interaction.isChatInputCommand()) {

        // HELP
        if (interaction.commandName === "help") {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("📘 Help")
                        .setColor(EMBED_COLOR)
                        .setDescription(
                            "🎫 /ticket-panel\n" +
                            "🧾 /embed\n" +
                            "🛠️ /embed-editor"
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
                    { label: "Všeobecná podpora", value: "podpora", emoji: "🛠️" },
                    { label: "Nahlášení hráče", value: "report", emoji: "🚨" },
                    { label: "Žádost o spolupráci", value: "partner", emoji: "🤝" },
                    { label: "Žádost o frakci", value: "frakce", emoji: "🏛️" },
                    { label: "Žádost o CK", value: "ck", emoji: "☠️" },
                    { label: "Obchod", value: "shop", emoji: "🛒" }
                ]);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🎫 Ticket System")
                        .setColor(EMBED_COLOR)
                        .setFooter({text: "(c) 2026 LexionRP.cz - all rights reserved."})
                ],
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

        // EMBED CREATOR
        if (interaction.commandName === "embed") {

            const modal = new ModalBuilder()
                .setCustomId("embed_create")
                .setTitle("Vytvořit embed");

            const fields = [
                ["title", "Title", TextInputStyle.Short],
                ["desc", "Description", TextInputStyle.Paragraph],
                ["color", "Color", TextInputStyle.Short],
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

    // ======================
    // TICKETS
    // ======================

    if (interaction.isStringSelectMenu()) {

        if (interaction.customId === "ticket_select") {

            const category = interaction.values[0];
            const categoryId = TICKET_CATEGORIES[category];

            const username = interaction.user.username
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "-");

            if (!categoryId) {
                return interaction.reply({ content: "❌ Neplatná kategorie", ephemeral: true });
            }

            const existing = interaction.guild.channels.cache.find(c =>
                c.name.startsWith(`ticket-${category}-${username}`)
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
                name: `ticket-${category}-${username}-${number}`,
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
                        .setColor(EMBED_COLOR)
                        .setDescription(`Kategorie: ${category}`)
                ],
                components: [new ActionRowBuilder().addComponents(close)]
            });

            return interaction.reply({
                content: `✅ Ticket vytvořen: ${channel}`,
                ephemeral: true
            });
        }
    }

    // ======================
    // BUTTONS
    // ======================

    if (interaction.isButton()) {

        // CLOSE TICKET SAFE
        if (interaction.customId === "close_ticket") {

            await interaction.deferReply({ ephemeral: true }).catch(() => {});

            try {

                const messages = await interaction.channel.messages.fetch({ limit: 100 });

                const transcript = messages
                    .map(m =>
                        `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || "[embed/attachment]"}`
                    )
                    .reverse()
                    .join("\n");

                const fileName = `transcript-${interaction.channel.id}.txt`;

                fs.writeFileSync(fileName, transcript);

                const file = new AttachmentBuilder(fileName);

                const logChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID);

                if (logChannel) {
                    await logChannel.send({
                        content: "📄 Ticket transcript",
                        files: [file]
                    }).catch(() => {});
                }

                await interaction.editReply({
                    content: "🔒 Ticket se zavírá..."
                });

                setTimeout(async () => {
                    await interaction.channel.delete().catch(() => {});
                    if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
                }, 3000);

            } catch (err) {
                console.error(err);

                return interaction.editReply({
                    content: "❌ Chyba při zavírání ticketu"
                });
            }
        }

        // EMBED EDITOR
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

        const modal = new ModalBuilder()
            .setCustomId(interaction.customId)
            .setTitle("Edit");

        const input = new TextInputBuilder()
            .setCustomId("value")
            .setStyle(TextInputStyle.Short)
            .setLabel("Value");

        if (interaction.customId === "edit_desc") {
            input.setStyle(TextInputStyle.Paragraph);
        }

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
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
        if (interaction.customId === "edit_thumb") editor.embed.setThumbnail(value);
        if (interaction.customId === "edit_image") editor.embed.setImage(value);

        if (interaction.customId === "embed_create") {

            const embed = new EmbedBuilder()
                .setTitle(interaction.fields.getTextInputValue("title"))
                .setDescription(interaction.fields.getTextInputValue("desc"))
                .setColor(interaction.fields.getTextInputValue("color") || EMBED_COLOR);

            const thumb = interaction.fields.getTextInputValue("thumb");
            const image = interaction.fields.getTextInputValue("image");

            if (thumb) embed.setThumbnail(thumb);
            if (image) embed.setImage(image);

            return interaction.reply({ embeds: [embed] });
        }

        return interaction.reply({
            content: "✔ Upraveno",
            ephemeral: true
        });
    }
});

// ======================
// LOGIN
// ======================

client.login(TOKEN);