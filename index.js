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
    RoleSelectMenuBuilder,
} = require("discord.js");

const ADMIN_ROLE_ID = "1502506274292633670";
function hasAccess(member) {
    return member.roles.cache.has(ADMIN_ROLE_ID);
}

const TOKEN = process.env.TOKEN;
const EMBED_COLOR = "#1302d1";

const WELCOME_CHANNEL_ID = "1484591887997206732";
const WELCOME_IMAGE_URL = "https://cdn.discordapp.com/attachments/1180856807166586991/1502494064707240100/Navrh_bez_nazvu.png";

const SUPPORT_ROLE_ID = "1484591886940377219";

const AUTOROLE_IDS = [
    "1484591886927659039",
    "1502249604144697344",
    "1484591886927659041",
    "1502248635151159416",
    "1503108855842865305",
    "1502249732905635860"
];

const TICKET_CATEGORIES = {
    frakce: "1485272944270901420",
    ck: "1502366579625820340",
    shop: "1502366748517601451",
    podpora: "1485272897453953035",
    report: "1502366625238876201",
    partner: "1502366896811675658"
};

const RR_FILE = "./reactionRoles.json";

let reactionRoles = fs.existsSync(RR_FILE)
    ? JSON.parse(fs.readFileSync(RR_FILE, "utf8"))
    : {};

function saveRR() {
    fs.writeFileSync(RR_FILE, JSON.stringify(reactionRoles, null, 2));
}

function buildRRDescription(roles) {
    const lines = Object.entries(roles).map(([emoji, roleId]) => `${emoji} - <@&${roleId}>`);
    return lines.length > 0 ? lines.join("\n") : "Reaguj pro role";
}

const rrSessions = new Map();
const roleSessions = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const editors = new Map();

const commands = [
    new SlashCommandBuilder().setName("ticket-panel").setDescription("Vytvoří ticket-panel"),
    new SlashCommandBuilder().setName("embed").setDescription("Vytvoří nový embed"),
    new SlashCommandBuilder()
        .setName("embed-editor")
        .setDescription("Upraví existující embed")
        .addStringOption(opt =>
            opt.setName("message_id").setDescription("ID zprávy k úpravě").setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("reaction-role-panel")
        .setDescription("Vytvoří reaction role panel"),
    new SlashCommandBuilder()
        .setName("role")
        .setDescription("Správa reaction rolí")
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Přidá reaction roli do panelu")
                .addStringOption(opt =>
                    opt.setName("message_id").setDescription("ID reaction role panelu").setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("emoji").setDescription("Emoji pro roli").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Odebere reaction roli z panelu")
                .addStringOption(opt =>
                    opt.setName("message_id").setDescription("ID reaction role panelu").setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("emoji").setDescription("Emoji k odebrání").setRequired(true)
                )
        ),
    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Seznam příkazů")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
    console.log(`✅ Logged as ${client.user.tag}`);
    await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
    );
});

client.on("interactionCreate", async interaction => {

    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === "help") {
            return interaction.reply({
                ephemeral: true,
                embeds: [
                    new EmbedBuilder()
                        .setTitle("📘 Help")
                        .setColor(EMBED_COLOR)
                        .setDescription(
                            "🎫 /ticket-panel\n🧾 /embed\n🛠️ /embed-editor\n🎭 /reaction-role-panel\n➕ /role add\n➖ /role remove"
                        )
                ]
            });
        }

        if (interaction.commandName === "ticket-panel") {
            if (!hasAccess(interaction.member))
                return interaction.reply({ content: "❌ Nemáš oprávnění", ephemeral: true });

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
                        .setColor(EMBED_COLOR)
                        .setDescription("🛩️ Ticket systém")
                        .setFooter({ text: "(c) 2026 LexionRP.cz - all rights reserved." })
                ],
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

        if (interaction.commandName === "embed") {
            if (!hasAccess(interaction.member))
                return interaction.reply({ content: "❌ Nemáš oprávnění", ephemeral: true });

            const modal = new ModalBuilder()
                .setCustomId("embed_create")
                .setTitle("Vytvořit embed");

            const fields = [
                ["title", "Title", TextInputStyle.Short],
                ["desc", "Description", TextInputStyle.Paragraph],
                ["color", "Color", TextInputStyle.Short],
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

        if (interaction.commandName === "reaction-role-panel") {
            if (!hasAccess(interaction.member))
                return interaction.reply({ content: "❌ Nemáš oprávnění", ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle("🎭 Reaction Role Panel")
                .setColor(EMBED_COLOR)
                .setDescription("Reaguj pro role");

            const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

            reactionRoles[msg.id] = { roles: {}, channelId: interaction.channel.id };
            saveRR();
        }

        if (interaction.commandName === "embed-editor") {
            if (!hasAccess(interaction.member))
                return interaction.reply({ content: "❌ Nemáš oprávnění", ephemeral: true });

            await interaction.deferReply({ ephemeral: true });

            const id = interaction.options.getString("message_id");
            const msg = await interaction.channel.messages.fetch(id).catch(() => null);
            if (!msg || !msg.embeds[0])
                return interaction.editReply("❌ Nenalezeno");

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
                new ButtonBuilder().setCustomId("edit_rr").setLabel("🎭 RR").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("save_embed").setLabel("💾 Save").setStyle(ButtonStyle.Success)
            );

            return interaction.editReply({
                content: "🛠️ Editor aktivní",
                components: [row]
            });
        }

        if (interaction.commandName === "role") {
            if (!hasAccess(interaction.member))
                return interaction.reply({ content: "❌ Nemáš oprávnění", ephemeral: true });

            const sub = interaction.options.getSubcommand();
            const messageId = interaction.options.getString("message_id");
            const emoji = interaction.options.getString("emoji");

            if (sub === "add") {
                if (!reactionRoles[messageId])
                    return interaction.reply({ content: "❌ Panel s tímto ID neexistuje", ephemeral: true });

                roleSessions.set(interaction.user.id, { action: "add", messageId, emoji, channelId: interaction.channel.id });

                const roleMenu = new RoleSelectMenuBuilder()
                    .setCustomId("role_select_add")
                    .setPlaceholder("Vyber roli")
                    .setMinValues(1)
                    .setMaxValues(1);

                return interaction.reply({
                    ephemeral: true,
                    content: `➕ Vyber roli pro emoji **${emoji}**:`,
                    components: [new ActionRowBuilder().addComponents(roleMenu)]
                });
            }

            if (sub === "remove") {
                if (!reactionRoles[messageId])
                    return interaction.reply({ content: "❌ Panel s tímto ID neexistuje", ephemeral: true });

                const roles = reactionRoles[messageId].roles;

                if (!roles[emoji])
                    return interaction.reply({ content: `❌ Emoji **${emoji}** není v panelu`, ephemeral: true });

                delete roles[emoji];
                saveRR();

                const panelMsg = await interaction.channel.messages.fetch(messageId).catch(() => null);
                if (panelMsg) {
                    const reaction = panelMsg.reactions.cache.find(r => r.emoji.name === emoji);
                    if (reaction) await reaction.remove().catch(() => {});

                    const oldEmbed = panelMsg.embeds[0];
                    const updatedEmbed = EmbedBuilder.from(oldEmbed)
                        .setDescription(buildRRDescription(roles));
                    await panelMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
                }

                return interaction.reply({
                    ephemeral: true,
                    content: `✅ Emoji **${emoji}** bylo odebráno z panelu`
                });
            }
        }
    }

    if (interaction.isRoleSelectMenu()) {
        if (interaction.customId === "role_select_add") {
            const session = roleSessions.get(interaction.user.id);
            if (!session) return interaction.reply({ content: "❌ Session vypršela", ephemeral: true });

            const role = interaction.roles.first();
            if (!role) return interaction.reply({ content: "❌ Žádná role", ephemeral: true });

            reactionRoles[session.messageId].roles[session.emoji] = role.id;
            saveRR();

            roleSessions.delete(interaction.user.id);

            const channel = await client.channels.fetch(session.channelId);
            const panelMsg = await channel.messages.fetch(session.messageId).catch(() => null);
            if (panelMsg) {
                await panelMsg.react(session.emoji).catch(() => {});

                const oldEmbed = panelMsg.embeds[0];
                const updatedEmbed = EmbedBuilder.from(oldEmbed)
                    .setDescription(buildRRDescription(reactionRoles[session.messageId].roles));
                await panelMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
            }

            return interaction.update({
                content: `✅ Přidáno: ${session.emoji} → <@&${role.id}>`,
                components: []
            });
        }
    }

    if (interaction.isButton()) {

        const editor = editors.get(interaction.user.id);

        if (interaction.customId === "edit_rr") {
            if (!editor) return;
            rrSessions.set(interaction.user.id, {
                messageId: editor.messageId,
                roles: reactionRoles[editor.messageId]?.roles || {}
            });
            return interaction.reply({
                ephemeral: true,
                content: "Napiš: emoji roleID"
            });
        }

        if (interaction.customId === "save_embed") {
            if (!editor) return;
            await interaction.deferUpdate();
            const channel = await client.channels.fetch(editor.channelId);
            const msg = await channel.messages.fetch(editor.messageId);
            await msg.edit({ embeds: [editor.embed] });
            editors.delete(interaction.user.id);
            return interaction.editReply({ content: "✅ Uloženo!", components: [] });
        }

        if (!editor) return;

        const labels = {
            edit_title: "Nový title",
            edit_desc: "Nový popis",
            edit_color: "Nová barva (hex)",
            edit_image: "Nová URL obrázku"
        };

        const modal = new ModalBuilder()
            .setCustomId(interaction.customId)
            .setTitle("✏️ Upravit embed");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("value")
                    .setLabel(labels[interaction.customId] || "Value")
                    .setStyle(
                        interaction.customId === "edit_desc"
                            ? TextInputStyle.Paragraph
                            : TextInputStyle.Short
                    )
                    .setRequired(true)
            )
        );

        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {

        if (interaction.customId === "embed_create") {
            const title = interaction.fields.getTextInputValue("title");
            const desc = interaction.fields.getTextInputValue("desc");
            const color = interaction.fields.getTextInputValue("color");
            const image = interaction.fields.getTextInputValue("image");

            const embed = new EmbedBuilder().setColor(color || EMBED_COLOR);
            if (title) embed.setTitle(title);
            if (desc) embed.setDescription(desc);
            if (image) embed.setImage(image);

            return interaction.reply({ embeds: [embed] });
        }

        const editor = editors.get(interaction.user.id);
        if (!editor) return;

        const value = interaction.fields.getTextInputValue("value");

        if (interaction.customId === "edit_title") editor.embed.setTitle(value);
        if (interaction.customId === "edit_desc") editor.embed.setDescription(value);
        if (interaction.customId === "edit_color") editor.embed.setColor(value);
        if (interaction.customId === "edit_image") editor.embed.setImage(value);

        return interaction.reply({ content: "✔ Změna uložena, klikni Save pro aplikování", ephemeral: true });
    }
});

// ======================
// RR INPUT (legacy chat)
// ======================
client.on("messageCreate", async message => {
    if (message.author.bot) return;

    const session = rrSessions.get(message.author.id);
    if (!session) return;

    const [emoji, roleId] = message.content.split(" ");

    session.roles[emoji] = roleId;
    reactionRoles[session.messageId] = { roles: session.roles };
    saveRR();

    await message.react(emoji).catch(() => {});
});

// ======================
// REACTIONS
// ======================
client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) return;

    const data = reactionRoles[reaction.message.id];
    if (!data) return;

    const roleId = data.roles?.[reaction.emoji.name];
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
// WELCOME + AUTOROLE
// ======================
client.on("guildMemberAdd", async member => {
    
    for (const roleId of AUTOROLE_IDS) {
        await member.roles.add(roleId).catch(() => {});
    }

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const memberCount = member.guild.memberCount;
    const embed = new EmbedBuilder()
        .setTitle("🛩️ Vítej na LexionRP! 🛩️")
        .setDescription(
            `Zdravíme tě na našem Discord serveru, ${member}!\n\n` +
            `📌 Přečti si pravidla serveru.\n` +
            `🎫 Pokud potřebuješ pomoc, vytvoř si ticket v kategorii TICKET.\n` +
            `🚀 Jsme WL-ON Server, to znamená, že nám jde především o kvalitu Roleplaye. My jsme Lexion, více než jen Roleplay.!`
        )
        .setColor(EMBED_COLOR)
        .setImage(WELCOME_IMAGE_URL);

    channel.send({ 
        content: `*Jsi náš* **${memberCount}.** *člen! 🤩*`,
        embeds: [embed] 
    });
});

// ======================
// LOGIN
// ======================
client.login(TOKEN);
