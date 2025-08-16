const { Client, GatewayIntentBits, Events, Collection } = require('discord.js');
const DatabaseManager = require('./src/database');
const RedisManager = require('./src/redis');
require('dotenv').config();

// Database und Redis Manager initialisieren
const db = new DatabaseManager();
const redis = new RedisManager();

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
client.once(Events.ClientReady, async () => {
    console.log(`✅ ${client.user.tag} ist online!`);
    console.log(`🏠 Aktiv in ${client.guilds.cache.size} Server(n)`);
    console.log(`👥 Überwacht ${client.users.cache.size} Benutzer`);
    
    // Bot Status setzen
    client.user.setActivity('Statistiken sammeln 📊', { type: 'WATCHING' });
    
    // Datenbank-Verbindung herstellen
    console.log('🔄 Verbinde mit Datenbanken...');
    const dbConnected = await db.connect();
    const redisConnected = await redis.connect();
    
    if (!dbConnected) {
        console.error('❌ PostgreSQL Verbindung fehlgeschlagen!');
    }
    
    if (!redisConnected) {
        console.warn('⚠️ Redis Verbindung fehlgeschlagen (Cache deaktiviert)');
    }
    
    // Guilds in Datenbank synchronisieren
    for (const guild of client.guilds.cache.values()) {
        await db.upsertGuild(guild);
        console.log(`📝 Guild "${guild.name}" synchronisiert`);
    }
    
    console.log('🚀 Bot ist vollständig einsatzbereit!');
});

// Event: Neue Nachricht (Statistik-Sammlung)
client.on(Events.MessageCreate, async (message) => {
    // Bot-Nachrichten ignorieren
    if (message.author.bot) return;
    if (!message.guild) return; // Nur Guild-Nachrichten
    
    console.log(`📝 Nachricht von ${message.author.tag} in #${message.channel.name}: "${message.content}"`);
    
    // Nachricht in Datenbank loggen
    await db.logMessage(message);
    
    // Activity in Redis tracken
    await redis.incrementActivity(message.guild.id, message.author.id, 'messages');
    
    // Rollen-Regeln überprüfen (alle 10 Nachrichten)
    const userStats = await db.getUserStats(message.author.id);
    if (userStats && userStats.messageCount % 10 === 0) {
        const assignedRoles = await db.checkAndAssignRoles(message.guild.id, userStats.id);
        if (assignedRoles.length > 0) {
            console.log(`🎭 Rollen automatisch zugewiesen für ${message.author.tag}:`, assignedRoles.map(r => r.name));
        }
    }
});

// Event: Mitglied betritt Server
client.on(Events.GuildMemberAdd, async (member) => {
    console.log(`➕ ${member.user.tag} ist dem Server beigetreten`);
    
    // Benutzer in Datenbank erstellen
    await db.upsertUser(member.user);
    
    // Guild aktualisieren falls nötig
    await db.upsertGuild(member.guild);
});

// Event: Mitglied verlässt Server
client.on(Events.GuildMemberRemove, async (member) => {
    console.log(`➖ ${member.user.tag} hat den Server verlassen`);
    // Hier wird später die Statistik-Aktualisierung implementiert
});

// Event: Reaktion hinzugefügt
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    if (!reaction.message.guild) return;
    
    console.log(`👍 ${user.tag} hat mit ${reaction.emoji.name} reagiert`);
    
    // Reaktion in Datenbank loggen
    await db.logReaction(reaction, user);
    
    // Activity in Redis tracken
    await redis.incrementActivity(reaction.message.guild.id, user.id, 'reactions');
});

// Event: Voice Channel Änderungen
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.member.user.bot) return;
    
    if (!oldState.channel && newState.channel) {
        // User joined voice channel
        console.log(`🔊 ${newState.member.user.tag} ist Voice Channel ${newState.channel.name} beigetreten`);
        await db.startVoiceSession(newState.member, newState.channel);
        await redis.trackVoiceSession(newState.member.user.id, newState.channel.id, 'join');
        
    } else if (oldState.channel && !newState.channel) {
        // User left voice channel
        console.log(`🔇 ${oldState.member.user.tag} hat Voice Channel ${oldState.channel.name} verlassen`);
        const duration = await db.endVoiceSession(oldState.member, oldState.channel);
        await redis.trackVoiceSession(oldState.member.user.id, oldState.channel.id, 'leave');
        
        if (duration > 0) {
            console.log(`⏱️ Voice Session Dauer: ${duration} Minuten`);
            // Activity in Redis tracken
            await redis.incrementActivity(oldState.guild.id, oldState.member.user.id, 'voice');
        }
        
    } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        // User switched voice channels
        console.log(`🔄 ${newState.member.user.tag} wechselte von ${oldState.channel.name} zu ${newState.channel.name}`);
        
        // End old session
        await db.endVoiceSession(oldState.member, oldState.channel);
        await redis.trackVoiceSession(oldState.member.user.id, oldState.channel.id, 'leave');
        
        // Start new session
        await db.startVoiceSession(newState.member, newState.channel);
        await redis.trackVoiceSession(newState.member.user.id, newState.channel.id, 'join');
    }
});

// Environment Variables überprüfen
console.log('🔍 Environment Check:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`- DISCORD_TOKEN: ${process.env.DISCORD_TOKEN ? 'Gesetzt ✅' : 'Nicht gesetzt ❌'}`);
console.log(`- DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID || 'Nicht gesetzt ❌'}`);
console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'Gesetzt ✅' : 'Nicht gesetzt ❌'}`);
console.log(`- REDIS_URL: ${process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL ? 'Gesetzt ✅' : 'Nicht gesetzt ❌'}`);

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Bot wird heruntergefahren...');
    await db.disconnect();
    await redis.disconnect();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Bot wird heruntergefahren...');
    await db.disconnect();
    await redis.disconnect();
    client.destroy();
    process.exit(0);
});

// Fehlerbehandlung
client.on(Events.Error, error => {
    console.error('❌ Discord Client Fehler:', error);
});

process.on('unhandledRejection', error => {
    console.error('❌ Unbehandelter Promise Fehler:', error);
});

// Bot einloggen mit besserer Fehlerbehandlung
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN Environment Variable ist nicht gesetzt!');
    console.error('💡 Stelle sicher, dass der Token in Railway korrekt konfiguriert ist.');
    process.exit(1);
}

console.log('🚀 Versuche Bot einzuloggen...');
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Fehler beim Einloggen:', error);
    console.error('💡 Überprüfe ob der Bot Token gültig ist und regeneriere ihn falls nötig.');
    console.error('💡 Bot Token kannst du unter https://discord.com/developers/applications erneuern.');
    process.exit(1);
});
