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

// ======================
// EMBED EDITORS
// ======================

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
        .setDescription("Zobrazí všechny příkazy")

].map(c => c.toJSON());

// ======================
// REGISTER
// ======================

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

        // ======================
        // HELP
        // ======================

        if (interaction.commandName === "help") {

            const embed = new EmbedBuilder()
                .setTitle("📘 Help menu")
                .setColor("#ffc414")
                .setDescription(
                    "**🎫 TICKETY**\n" +
                    "/ticket-panel - otevře ticket menu\n\n" +

                    "**🧾 EMBED SYSTEM**\n" +
                    "/embed - vytvoření embedu\n" +
                    "/embed-editor - úprava embedu\n\n" +

                    "**ℹ️ OSTATNÍ**\n" +
                    "/help - seznam příkazů"
                );

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

        // ======================
        // TICKET PANEL
        // ======================

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

            const embed = new EmbedBuilder()
                .setTitle("🎫 Ticket System")
                .setDescription("Vyber kategorii ticketu")
                .setColor("#ffc414");

            return interaction.reply({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

        // ======================
        // EMBED CREATOR
        // ======================

        if (interaction.commandName === "embed") {

            const modal = new ModalBuilder()
                .setCustomId("embed_create")
                .setTitle("Vytvořit Embed");

            const title = new TextInputBuilder()
                .setCustomId("title")
                .setLabel("Název")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const desc = new TextInputBuilder()
                .setCustomId("desc")
                .setLabel("Popis")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const color = new TextInputBuilder()
                .setCustomId("color")
                .setLabel("Barva (#ff0000)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const thumb = new TextInputBuilder()
                .setCustomId("thumb")
                .setLabel("Thumbnail URL")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const image = new TextInputBuilder()
                .setCustomId("image")
                .setLabel("Image URL")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(title),
                new ActionRowBuilder().addComponents(desc),
                new ActionRowBuilder().addComponents(color),
                new ActionRowBuilder().addComponents(thumb),
                new ActionRowBuilder().addComponents(image)
            );

            return interaction.showModal(modal);
        }

        // ======================
        // EMBED EDITOR
        // ======================

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
    // CLOSE + TRANSCRIPT
    // =================================================

    if (interaction.isButton()) {

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

            await interaction.reply({
                content: "🔒 Zavírám ticket..."
            });

            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
                fs.unlinkSync(fileName);
            }, 3000);
        }

        // ======================
        // EMBED SAVE (simplified)
        // ======================

        const editor = editors.get(interaction.user.id);
        if (!editor) return;

        if (interaction.customId === "save_embed") {

            const msg = await interaction.channel.messages.fetch(editor.messageId);

            await msg.edit({ embeds: [editor.embed] });

            return interaction.reply({
                content: "💾 Uloženo",
                ephemeral: true
            });
        }
    }

    // =================================================
    // MODALS (EMBED CREATE)
    // =================================================

    if (interaction.isModalSubmit()) {

        if (interaction.customId === "embed_create") {

            const embed = new EmbedBuilder()
                .setTitle(interaction.fields.getTextInputValue("title"))
                .setDescription(interaction.fields.getTextInputValue("desc"))
                .setColor(interaction.fields.getTextInputValue("color") || "#0099ff");

            const thumb = interaction.fields.getTextInputValue("thumb");
            const image = interaction.fields.getTextInputValue("image");

            if (thumb) embed.setThumbnail(thumb);
            if (image) embed.setImage(image);

            return interaction.reply({ embeds: [embed] });
        }
    }
});

// ======================
// LOGIN
// ======================

client.login(process.env.TOKEN);