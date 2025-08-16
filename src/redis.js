const { createClient } = require('redis');

class RedisManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            const redisUrl = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL || 'redis://localhost:6379';
            
            this.client = createClient({
                url: redisUrl,
                retry_delay_on_failure: 5000,
                max_attempts: 5
            });

            this.client.on('error', (err) => {
                console.error('❌ Redis Client Fehler:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                console.log('🔄 Redis Verbindung wird hergestellt...');
            });

            this.client.on('ready', () => {
                console.log('✅ Redis Verbindung erfolgreich');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                console.log('🔌 Redis Verbindung getrennt');
                this.isConnected = false;
            });

            await this.client.connect();
            return true;
        } catch (error) {
            console.error('❌ Redis Verbindungsfehler:', error);
            this.isConnected = false;
            return false;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.quit();
        }
    }

    // Cache für Benutzer-Statistiken
    async cacheUserStats(userId, guildId, stats, ttl = 300) {
        if (!this.isConnected) return false;
        
        try {
            const key = `user:${guildId}:${userId}:stats`;
            await this.client.setEx(key, ttl, JSON.stringify(stats));
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Cachen der User Stats:', error);
            return false;
        }
    }

    async getCachedUserStats(userId, guildId) {
        if (!this.isConnected) return null;
        
        try {
            const key = `user:${guildId}:${userId}:stats`;
            const cached = await this.client.get(key);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('❌ Fehler beim Abrufen der gecachten User Stats:', error);
            return null;
        }
    }

    // Rate Limiting für Commands
    async checkRateLimit(userId, command, limit = 5, window = 60) {
        if (!this.isConnected) return true; // Allow if Redis is down
        
        try {
            const key = `ratelimit:${userId}:${command}`;
            const current = await this.client.incr(key);
            
            if (current === 1) {
                await this.client.expire(key, window);
            }
            
            return current <= limit;
        } catch (error) {
            console.error('❌ Fehler beim Rate Limiting:', error);
            return true; // Allow if error occurs
        }
    }

    // Session Tracking für Voice Channels
    async trackVoiceSession(userId, channelId, action) {
        if (!this.isConnected) return false;
        
        try {
            const key = `voice:${userId}:${channelId}`;
            
            if (action === 'join') {
                await this.client.set(key, Date.now());
                return true;
            } else if (action === 'leave') {
                const joinTime = await this.client.get(key);
                if (joinTime) {
                    const duration = Date.now() - parseInt(joinTime);
                    await this.client.del(key);
                    return Math.floor(duration / 1000 / 60); // Return duration in minutes
                }
            }
            return false;
        } catch (error) {
            console.error('❌ Fehler beim Voice Session Tracking:', error);
            return false;
        }
    }

    // Leaderboard Caching
    async cacheLeaderboard(guildId, type, data, ttl = 900) {
        if (!this.isConnected) return false;
        
        try {
            const key = `leaderboard:${guildId}:${type}`;
            await this.client.setEx(key, ttl, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Cachen des Leaderboards:', error);
            return false;
        }
    }

    async getCachedLeaderboard(guildId, type) {
        if (!this.isConnected) return null;
        
        try {
            const key = `leaderboard:${guildId}:${type}`;
            const cached = await this.client.get(key);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('❌ Fehler beim Abrufen des gecachten Leaderboards:', error);
            return null;
        }
    }

    // Server-Konfiguration Caching
    async cacheGuildConfig(guildId, config, ttl = 1800) {
        if (!this.isConnected) return false;
        
        try {
            const key = `config:${guildId}`;
            await this.client.setEx(key, ttl, JSON.stringify(config));
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Cachen der Guild Config:', error);
            return false;
        }
    }

    async getCachedGuildConfig(guildId) {
        if (!this.isConnected) return null;
        
        try {
            const key = `config:${guildId}`;
            const cached = await this.client.get(key);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('❌ Fehler beim Abrufen der gecachten Guild Config:', error);
            return null;
        }
    }

    // Activity Tracking
    async incrementActivity(guildId, userId, activityType) {
        if (!this.isConnected) return false;
        
        try {
            const now = new Date();
            const dateKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
            const key = `activity:${guildId}:${dateKey}:${activityType}`;
            
            await this.client.zIncrBy(key, 1, userId);
            await this.client.expire(key, 86400 * 30); // 30 days TTL
            
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Activity Tracking:', error);
            return false;
        }
    }

    async getTopActivity(guildId, activityType, days = 7, limit = 10) {
        if (!this.isConnected) return [];
        
        try {
            const keys = [];
            const now = new Date();
            
            for (let i = 0; i < days; i++) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
                keys.push(`activity:${guildId}:${dateKey}:${activityType}`);
            }
            
            // Union all daily scores
            const tempKey = `temp:leaderboard:${guildId}:${activityType}:${Date.now()}`;
            
            if (keys.length > 0) {
                await this.client.zUnionStore(tempKey, keys);
                const results = await this.client.zRevRange(tempKey, 0, limit - 1, { BY: 'SCORE', REV: true });
                await this.client.del(tempKey);
                return results;
            }
            
            return [];
        } catch (error) {
            console.error('❌ Fehler beim Abrufen der Top Activity:', error);
            return [];
        }
    }

    // Health Check
    async healthCheck() {
        if (!this.isConnected) return false;
        
        try {
            await this.client.ping();
            return true;
        } catch (error) {
            console.error('❌ Redis Health Check fehlgeschlagen:', error);
            return false;
        }
    }
}

module.exports = RedisManager;
