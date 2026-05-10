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

const rrSessions = new Map();

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
                        .setDescription("🎫 /ticket-panel\n🧾 /embed\n🛠️ /embed-editor\n🎭 /reaction-role-panel")
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

            reactionRoles[msg.id] = { roles: {} };
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
                embed: EmbedBuilder.from(msg.embeds[0])
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("edit_title").setLabel("Title").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("edit_desc").setLabel("Desc").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("edit_color").setLabel("Color").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("edit_image").setLabel("Image").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("edit_rr").setLabel("🎭 RR").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("save_embed").setLabel("Save").setStyle(ButtonStyle.Success)
            );

            return interaction.editReply({
                content: "🛠️ Editor aktivní",
                components: [row]
            });
        }
    }

    if (interaction.isButton()) {

        const editor = editors.get(interaction.user.id);

        if (interaction.customId === "edit_rr") {
            rrSessions.set(interaction.user.id, {
                messageId: editor.messageId,
                roles: reactionRoles[editor.messageId]?.roles || {}
            });

            return interaction.reply({
                ephemeral: true,
                content: "Napiš: emoji roleID"
            });
        }

        if (!editor) return;

        const modal = new ModalBuilder()
            .setCustomId(interaction.customId)
            .setTitle("Edit");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("value")
                    .setLabel("Value")
                    .setStyle(TextInputStyle.Short)
            )
        );

        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {

        const editor = editors.get(interaction.user.id);
        if (!editor) return;

        const value = interaction.fields.getTextInputValue("value");

        if (interaction.customId === "edit_title") editor.embed.setTitle(value);
        if (interaction.customId === "edit_desc") editor.embed.setDescription(value);
        if (interaction.customId === "edit_color") editor.embed.setColor(value);
        if (interaction.customId === "edit_image") editor.embed.setImage(value);

        if (interaction.customId === "save_embed") {
            const msg = await interaction.channel.messages.fetch(editor.messageId);
            await msg.edit({ embeds: [editor.embed] });
            editors.delete(interaction.user.id);
        }

        return interaction.reply({ content: "✔ OK", ephemeral: true });
    }
});

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

client.on("guildMemberAdd", async member => {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

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

    channel.send({ embeds: [embed] });
});

client.login(TOKEN);