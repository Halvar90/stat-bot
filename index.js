const { Client, GatewayIntentBits, Events, Collection } = require('discord.js');
require('dotenv').config();

// Bot Client mit notwendigen Intents erstellen
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration
    ]
});

// Commands Collection für später
client.commands = new Collection();

// Event: Bot ist bereit
client.once(Events.ClientReady, () => {
    console.log(`✅ ${client.user.tag} ist online!`);
    console.log(`🏠 Aktiv in ${client.guilds.cache.size} Server(n)`);
    console.log(`👥 Überwacht ${client.users.cache.size} Benutzer`);
    
    // Bot Status setzen
    client.user.setActivity('Statistiken sammeln 📊', { type: 'WATCHING' });
});

// Event: Neue Nachricht (Grundgerüst für Statistik-Sammlung)
client.on(Events.MessageCreate, async (message) => {
    // Bot-Nachrichten ignorieren
    if (message.author.bot) return;
    
    // Hier wird später die Statistik-Logik implementiert
    console.log(`📝 Nachricht von ${message.author.tag} in #${message.channel.name}: "${message.content}"`);
});

// Event: Mitglied betritt Server
client.on(Events.GuildMemberAdd, async (member) => {
    console.log(`➕ ${member.user.tag} ist dem Server beigetreten`);
    // Hier wird später die Begrüßungs- und Rollen-Logik implementiert
});

// Event: Mitglied verlässt Server
client.on(Events.GuildMemberRemove, async (member) => {
    console.log(`➖ ${member.user.tag} hat den Server verlassen`);
    // Hier wird später die Statistik-Aktualisierung implementiert
});

// Event: Reaktion hinzugefügt
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    console.log(`👍 ${user.tag} hat mit ${reaction.emoji.name} reagiert`);
    // Hier wird später Reaktions-Statistik implementiert
});

// Event: Voice Channel Änderungen
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.member.user.bot) return;
    
    if (!oldState.channel && newState.channel) {
        console.log(`🔊 ${newState.member.user.tag} ist Voice Channel ${newState.channel.name} beigetreten`);
    } else if (oldState.channel && !newState.channel) {
        console.log(`🔇 ${oldState.member.user.tag} hat Voice Channel ${oldState.channel.name} verlassen`);
    }
    // Hier wird später Voice-Zeit-Statistik implementiert
});

// Fehlerbehandlung
client.on(Events.Error, error => {
    console.error('❌ Discord Client Fehler:', error);
});

process.on('unhandledRejection', error => {
    console.error('❌ Unbehandelter Promise Fehler:', error);
});

// Bot einloggen
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Fehler beim Einloggen:', error);
    process.exit(1);
});
