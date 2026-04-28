// index.js

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
    Routes
} = require("discord.js");
require("dotenv").config();

// =====================
// CLIENT
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Uložené editory: podle uživatele
const editors = new Map();

// =====================
// REGISTRACE SLASH CMD
// =====================
const commands = [
    new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Vytvoří kompletní embed podle zadaných parametrů")
        .addStringOption(opt =>
            opt.setName("title")
                .setDescription("Název embedu")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("description")
                .setDescription("Popis embedu")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("color")
                .setDescription("Barva embedu (hex nebo název)")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName("thumbnail")
                .setDescription("URL náhledu (thumbnail)")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName("image")
                .setDescription("URL obrázku")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName("footer")
                .setDescription("Text ve footeru")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName("field_name")
                .setDescription("Název pole (field)")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName("field_value")
                .setDescription("Hodnota pole (field)")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("embed-editor")
        .setDescription("Otevře editor existujícího embedu")
        .addStringOption(opt =>
            opt.setName("message_id")
                .setDescription("ID zprávy s embedem v tomto kanálu")
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Nevíš si rady? Využij tento command!")
        
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// =====================
// READY
// =====================
client.once("ready", async () => {
    console.log(`✅ Přihlášen jako ${client.user.tag}`);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log("✅ Slash příkazy zaregistrovány.");
    } catch (err) {
        console.error("❌ Chyba při registraci příkazů:", err);
    }
});

// =====================
// INTERACTION HANDLER
// =====================
client.on("interactionCreate", async interaction => {
    // -----------------
    // SLASH COMMANDS
    // -----------------
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        if (interaction.commandName === "help") {
            const helpEmbed = new EmbedBuilder()
                .setTitle("🔗 Příkazy Bota 🔗")
                .setColor("#ffc414")
                .setDescription(
                    "• **/embed** — Vytvoříte si embed\n" +
                    "• **/embed-editor** — Upravíte stávající embed"
                )
                .setFooter("Made by monsignorholly")
                .setTimestamp()
            return interaction.reply({embeds: [helpEmbed], ephemeral: true});
        }
            
        // /embed
        if (commandName === "embed") {
            const title = interaction.options.getString("title");
            const description = interaction.options.getString("description");
            const color = interaction.options.getString("color") || "#0099ff";
            const thumbnail = interaction.options.getString("thumbnail");
            const image = interaction.options.getString("image");
            const footer = interaction.options.getString("footer");
            const fieldName = interaction.options.getString("field_name");
            const fieldValue = interaction.options.getString("field_value");

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp();

            if (thumbnail) embed.setThumbnail(thumbnail);
            if (image) embed.setImage(image);
            if (footer) embed.setFooter({ text: footer });
            if (fieldName && fieldValue) {
                embed.addFields({ name: fieldName, value: fieldValue });
            }

            return interaction.reply({ embeds: [embed] });
        }

        // /embed-editor
        if (commandName === "embed-editor") {
            const messageId = interaction.options.getString("message_id");

            const targetMessage = await interaction.channel.messages
                .fetch(messageId)
                .catch(() => null);

            if (!targetMessage || !targetMessage.embeds[0]) {
                return interaction.reply({
                    content: "❌ Zpráva neexistuje nebo neobsahuje embed.",
                    ephemeral: true
                });
            }

            const embed = EmbedBuilder.from(targetMessage.embeds[0]);

            // Uložíme editor pro tohoto uživatele
            editors.set(interaction.user.id, {
                messageId,
                embed
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("edit_title")
                    .setLabel("✏️ Název")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("edit_description")
                    .setLabel("📝 Popis")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId("edit_color")
                    .setLabel("🎨 Barva")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("edit_image")
                    .setLabel("🖼️ Obrázek")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("save_embed")
                    .setLabel("💾 Uložit")
                    .setStyle(ButtonStyle.Success)
            );

            return interaction.reply({
                content: "🛠️ Editor embedu je připraven. Použij tlačítka níže.",
                components: [row],
                ephemeral: true
            });
        }
    }

    // -----------------
    // BUTTONS
    // -----------------
    if (interaction.isButton()) {
        const editor = editors.get(interaction.user.id);
        if (!editor) {
            return interaction.reply({
                content: "❌ Nemáš aktivní editor.",
                ephemeral: true
            });
        }

        const { embed, messageId } = editor;
        const id = interaction.customId;

        // TITLE
        if (id === "edit_title") {
            const modal = new ModalBuilder()
                .setCustomId("modal_title")
                .setTitle("Upravit název");

            const input = new TextInputBuilder()
                .setCustomId("new_title")
                .setLabel("Nový název")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // DESCRIPTION
        if (id === "edit_description") {
            const modal = new ModalBuilder()
                .setCustomId("modal_description")
                .setTitle("Upravit popis");

            const input = new TextInputBuilder()
                .setCustomId("new_description")
                .setLabel("Nový popis")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // COLOR
        if (id === "edit_color") {
            const modal = new ModalBuilder()
                .setCustomId("modal_color")
                .setTitle("Upravit barvu");

            const input = new TextInputBuilder()
                .setCustomId("new_color")
                .setLabel("Hex barva (#ff0000)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // IMAGE
        if (id === "edit_image") {
            const modal = new ModalBuilder()
                .setCustomId("modal_image")
                .setTitle("Upravit obrázek");

            const input = new TextInputBuilder()
                .setCustomId("new_image")
                .setLabel("URL obrázku")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // SAVE
        if (id === "save_embed") {
            const msg = await interaction.channel.messages
                .fetch(messageId)
                .catch(() => null);

            if (!msg) {
                return interaction.reply({
                    content: "❌ Původní zpráva nebyla nalezena.",
                    ephemeral: true
                });
            }

            await msg.edit({ embeds: [embed] });

            return interaction.reply({
                content: "💾 Embed uložen.",
                ephemeral: true
            });
        }
    }

    // -----------------
    // MODALS
    // -----------------
    if (interaction.isModalSubmit()) {
        const editor = editors.get(interaction.user.id);
        if (!editor) {
            return interaction.reply({
                content: "❌ Nemáš aktivní editor.",
                ephemeral: true
            });
        }

        const { embed } = editor;

        if (interaction.customId === "modal_title") {
            const value = interaction.fields.getTextInputValue("new_title");
            embed.setTitle(value);
            return interaction.reply({ content: "✔ Název upraven.", ephemeral: true });
        }

        if (interaction.customId === "modal_description") {
            const value = interaction.fields.getTextInputValue("new_description");
            embed.setDescription(value);
            return interaction.reply({ content: "✔ Popis upraven.", ephemeral: true });
        }

        if (interaction.customId === "modal_color") {
            const value = interaction.fields.getTextInputValue("new_color");
            embed.setColor(value);
            return interaction.reply({ content: "✔ Barva upravena.", ephemeral: true });
        }

        if (interaction.customId === "modal_image") {
            const value = interaction.fields.getTextInputValue("new_image");
            embed.setImage(value);
            return interaction.reply({ content: "✔ Obrázek upraven.", ephemeral: true });
        }
    }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
