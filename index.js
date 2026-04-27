const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('ready', () => {
  console.log(`Bot běží jako ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!embed')) {
    const args = message.content.slice(6).trim().split('|');

    const title = (args[0] || 'Bez názvu').trim();
    const description = (args[1] || 'Bez popisu').trim();
    const color = (args[2] || '00ff99').trim().replace('#', '');
    const footer = (args[3] || 'Embed bot').trim();

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(parseInt(color, 16))
      .setFooter({ text: footer })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
