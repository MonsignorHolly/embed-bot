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
        )
].map(c => c.toJSON());

const rest = new
