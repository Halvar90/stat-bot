const { PrismaClient } = require('@prisma/client');

class DatabaseManager {
    constructor() {
        this.prisma = new PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
        });
    }

    async connect() {
        try {
            await this.prisma.$connect();
            console.log('✅ PostgreSQL Verbindung erfolgreich');
            return true;
        } catch (error) {
            console.error('❌ PostgreSQL Verbindungsfehler:', error);
            return false;
        }
    }

    async disconnect() {
        await this.prisma.$disconnect();
        console.log('🔌 PostgreSQL Verbindung getrennt');
    }

    // User Management
    async upsertUser(discordUser) {
        return await this.prisma.user.upsert({
            where: { discordId: discordUser.id },
            update: {
                username: discordUser.username,
                discriminator: discordUser.discriminator || null,
                avatar: discordUser.avatar,
                lastActive: new Date()
            },
            create: {
                discordId: discordUser.id,
                username: discordUser.username,
                discriminator: discordUser.discriminator || null,
                avatar: discordUser.avatar
            }
        });
    }

    async getUserStats(discordId) {
        return await this.prisma.user.findUnique({
            where: { discordId },
            include: {
                messages: true,
                reactions: true,
                voiceSessions: true,
                userRoles: {
                    include: { role: true }
                }
            }
        });
    }

    // Guild Management
    async upsertGuild(discordGuild) {
        return await this.prisma.guild.upsert({
            where: { id: discordGuild.id },
            update: {
                name: discordGuild.name,
                ownerId: discordGuild.ownerId
            },
            create: {
                id: discordGuild.id,
                name: discordGuild.name,
                ownerId: discordGuild.ownerId
            }
        });
    }

    // Message Statistics
    async logMessage(message) {
        try {
            // Benutzer erstellen/aktualisieren
            await this.upsertUser(message.author);
            
            // Channel erstellen falls nicht vorhanden
            await this.prisma.channel.upsert({
                where: { id: message.channel.id },
                update: { name: message.channel.name },
                create: {
                    id: message.channel.id,
                    name: message.channel.name,
                    type: message.channel.type.toString(),
                    guildId: message.guild.id
                }
            });

            // Nachricht loggen
            const loggedMessage = await this.prisma.message.create({
                data: {
                    id: message.id,
                    content: message.content || null,
                    authorId: message.author.id,
                    channelId: message.channel.id,
                    guildId: message.guild.id
                }
            });

            // Message Count erhöhen
            await this.prisma.user.update({
                where: { discordId: message.author.id },
                data: {
                    messageCount: { increment: 1 },
                    lastActive: new Date()
                }
            });

            return loggedMessage;
        } catch (error) {
            console.error('❌ Fehler beim Loggen der Nachricht:', error);
        }
    }

    // Reaction Statistics
    async logReaction(reaction, user) {
        try {
            await this.upsertUser(user);

            const loggedReaction = await this.prisma.reaction.create({
                data: {
                    emoji: reaction.emoji.name || reaction.emoji.id,
                    messageId: reaction.message.id,
                    userId: user.id,
                    guildId: reaction.message.guild.id
                }
            });

            // Reaction Count erhöhen
            await this.prisma.user.update({
                where: { discordId: user.id },
                data: {
                    reactionCount: { increment: 1 },
                    lastActive: new Date()
                }
            });

            return loggedReaction;
        } catch (error) {
            console.error('❌ Fehler beim Loggen der Reaktion:', error);
        }
    }

    // Voice Session Tracking
    async startVoiceSession(member, channel) {
        try {
            await this.upsertUser(member.user);

            return await this.prisma.voiceSession.create({
                data: {
                    userId: member.user.id,
                    channelId: channel.id,
                    guildId: channel.guild.id
                }
            });
        } catch (error) {
            console.error('❌ Fehler beim Starten der Voice Session:', error);
        }
    }

    async endVoiceSession(member, channel) {
        try {
            const session = await this.prisma.voiceSession.findFirst({
                where: {
                    userId: member.user.id,
                    channelId: channel.id,
                    leftAt: null
                },
                orderBy: { joinedAt: 'desc' }
            });

            if (session) {
                const now = new Date();
                const duration = Math.floor((now - session.joinedAt) / (1000 * 60)); // Minutes

                await this.prisma.voiceSession.update({
                    where: { id: session.id },
                    data: {
                        leftAt: now,
                        duration
                    }
                });

                // Voice Minutes erhöhen
                await this.prisma.user.update({
                    where: { discordId: member.user.id },
                    data: {
                        voiceMinutes: { increment: duration },
                        lastActive: new Date()
                    }
                });

                return duration;
            }
        } catch (error) {
            console.error('❌ Fehler beim Beenden der Voice Session:', error);
        }
    }

    // Role Rules
    async getRoleRules(guildId) {
        return await this.prisma.roleRule.findMany({
            where: { guildId, enabled: true },
            include: { role: true }
        });
    }

    async checkAndAssignRoles(guildId, userId) {
        try {
            const rules = await this.getRoleRules(guildId);
            const user = await this.getUserStats(userId);

            if (!user) return [];

            const assignedRoles = [];

            for (const rule of rules) {
                let shouldHaveRole = true;

                // Check message requirement
                if (rule.minMessages && user.messageCount < rule.minMessages) {
                    shouldHaveRole = false;
                }

                // Check reaction requirement
                if (rule.minReactions && user.reactionCount < rule.minReactions) {
                    shouldHaveRole = false;
                }

                // Check voice minutes requirement
                if (rule.minVoiceMinutes && user.voiceMinutes < rule.minVoiceMinutes) {
                    shouldHaveRole = false;
                }

                // Check if user already has this role
                const hasRole = user.userRoles.some(ur => ur.roleId === rule.roleId);

                if (shouldHaveRole && !hasRole) {
                    // Assign role
                    await this.prisma.userRole.create({
                        data: {
                            userId: user.id,
                            roleId: rule.roleId,
                            guildId: guildId,
                            reason: `Automatisch durch Regel: ${rule.name}`
                        }
                    });
                    assignedRoles.push(rule.role);
                } else if (!shouldHaveRole && hasRole) {
                    // Remove role
                    await this.prisma.userRole.deleteMany({
                        where: {
                            userId: user.id,
                            roleId: rule.roleId,
                            guildId: guildId
                        }
                    });
                }
            }

            return assignedRoles;
        } catch (error) {
            console.error('❌ Fehler beim Überprüfen der Rollen-Regeln:', error);
            return [];
        }
    }
}

module.exports = DatabaseManager;
