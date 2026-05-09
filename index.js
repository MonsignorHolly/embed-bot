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

// WELCOME SYSTEM
const WELCOME_CHANNEL_ID = "1484591887997206732";
const WELCOME_IMAGE_URL = "https://cdn.discordapp.com/attachments/1180856807166586991/1502494064707240100/Navrh_bez_nazvu.png?ex=69ffea24&is=69fe98a4&hm=e905359085b8edaa8e1ecf9c5b151d7287464bc296ee08172f72f35a6c7b4740&";
// TICKET SYSTEM
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
// CLIENT
// ======================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
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
        .setDescription("Vytvoří ticket-panel"),

    new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Vytvoří nový embed"),

    new SlashCommandBuilder()
        .setName("embed-editor")
        .setDescription("Upraví existující")
        .addStringOption(opt =>
            opt.setName("message_id")
                .setDescription("ID zprávy")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Seznam příkazů, kterými bot disponuje")
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
                        .setTitle("🎫 Ticket Systém")
                        .setDescription("🛩️ Ticket systém, nejdůležitější část našeho Discordu.")
                        .setColor(EMBED_COLOR)
                        .setFooter({ text: "(c) 2026 LexionRP.cz - all rights reserved." })
                ],
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

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

        if (interaction.commandName === "embed-editor") {

            // ❗ důležité - zabrání "Aplikace neodpovídá"
            await interaction.deferReply({ ephemeral: true });
        
            const id = interaction.options.getString("message_id");
        
            let msg;
            try {
                msg = await interaction.channel.messages.fetch(id);
            } catch (err) {
                return interaction.editReply("❌ Zpráva nenalezena nebo nemáš přístup.");
            }
        
            if (!msg || !msg.embeds || !msg.embeds[0]) {
                return interaction.editReply("❌ Tato zpráva neobsahuje embed.");
            }
        
            // uloží editor session
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
                new ButtonBuilder().setCustomId("save_embed").setLabel("Save").setStyle(ButtonStyle.Success)
            );
        
            return interaction.editReply({
                content: "🛠️ Embed editor aktivní",
                components: [row]
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
                // ❌ FIX: špatný string
                content: `Zdravím <@${interaction.user.id}>`,
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🎫 Ticket")
                        .setColor(EMBED_COLOR)
                        .setDescription("Prosíme, popiš problém.")
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

        // ======================
        // CLOSE TICKET (FIX pořadí + safe return)
        // ======================

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

            return;
        }

        // ======================
        // EMBED EDITOR SAFE FIX
        // ======================

        const editor = editors.get(interaction.user.id);

        if (!editor) {
            return interaction.reply({
                content: "❌ Editor neexistuje nebo expiroval.",
                ephemeral: true
            });
        }

        const { embed, messageId } = editor;

        if (interaction.customId === "save_embed") {

            const data = editors.get(interaction.user.id);
            if (!data) {
                return interaction.reply({
                    content: "❌ Editor expiroval.",
                    ephemeral: true
                });
            }
        
            const msg = await interaction.channel.messages.fetch(data.messageId);
            await msg.edit({ embeds: [data.embed] });
        
            editors.delete(interaction.user.id);
        
            return interaction.reply({
                content: "💾 Embed uložen",
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(interaction.customId)
            .setTitle("Edit");

        const input = new TextInputBuilder()
            .setCustomId("value")
            .setLabel("Value")
            .setStyle(interaction.customId === "edit_desc" ? TextInputStyle.Paragraph : TextInputStyle.Short);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
    }

    // ======================
    // MODALS
    // ======================

    if (interaction.isModalSubmit()) {

        const editor = editors.get(interaction.user.id);

        // FIX: embed_create NESMÍ záviset na editoru
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

        if (!editor) return;

        const value = interaction.fields.getTextInputValue("value");

        if (interaction.customId === "edit_title") editor.embed.setTitle(value);
        if (interaction.customId === "edit_desc") editor.embed.setDescription(value);
        if (interaction.customId === "edit_color") editor.embed.setColor(value);
        if (interaction.customId === "edit_thumb") editor.embed.setThumbnail(value);
        if (interaction.customId === "edit_image") editor.embed.setImage(value);

        return interaction.reply({
            content: "✔ Upraveno",
            ephemeral: true
        });
    }
});

// ======================
// WELCOME MESSAGE
// ======================

client.on("guildMemberAdd", async member => {
    try {
        const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);

        if (!channel) return;

        const welcomeEmbed = new EmbedBuilder()
            .setTitle("🛩️ Vítej na LexionRP! 🛩️")
            .setDescription(
                `Zdravíme tě na našem Discord serveru, ${member}!\n\n` +
                `📌 Přečti si pravidla serveru.\n` +
                `🎫 Pokud potřebuješ pomoc, vytvoř si ticket v kategorii TICKET.\n` +
                `🚀 Jsme WL-ON Server, to znamená, že nám jde především o kvalitu Roleplaye. My jsme Lexion, více než jen Roleplay.!`
            )
            .setColor(EMBED_COLOR)
            .setImage(WELCOME_IMAGE_URL)
            .setFooter({
                text: "(c) 2026 LexionRP.cz - all rights reserved."
            })
            .setTimestamp();

        // Odeslání zprávy
        await channel.send({
            content: `🎉 ${member.guild.memberCount}. připojený člen!`,
            embeds: [welcomeEmbed]
        });

    } catch (error) {
        console.error("❌ Chyba při odesílání uvítací zprávy:", error);
    }
});
// ======================
// LOGIN
// ======================

client.login(TOKEN);