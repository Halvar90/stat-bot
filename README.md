# Stat-Bot 📊

Ein umfassender Discord Statistik Bot, der alle möglichen Aktionen von Usern und Moderatoren loggt und entsprechend konfigurierbarer Regeln Rollen vergibt und entfernt.

## Features (geplant)

### 📊 Statistik-Sammlung
- ✅ Nachrichten-Tracking
- ✅ Voice Channel Zeit-Tracking  
- ✅ Reaktions-Statistiken
- ✅ Server Join/Leave Events
- 🔄 Moderations-Aktionen Logging
- 🔄 Command Usage Tracking

### 🎭 Rollen-Management
- 🔄 Automatische Rollen-Vergabe basierend auf Aktivität
- 🔄 Konfigurierbare Regeln für Rollen-Management
- 🔄 Level-System mit Belohnungen
- 🔄 Moderator-Rollen für aktive Community-Mitglieder

### ⚙️ Konfiguration
- 🔄 Server-spezifische Einstellungen
- 🔄 Anpassbare Schwellenwerte
- 🔄 Flexibles Regel-System
- 🔄 Dashboard für Einstellungen

## Technischer Stack

- **Backend**: Node.js mit discord.js v14
- **Hosting**: Railway
- **Database**: (wird später hinzugefügt)
- **Version Control**: GitHub

## Setup

### Lokale Entwicklung

1. Repository klonen
2. Dependencies installieren:
   ```bash
   npm install
   ```
3. `.env` Datei erstellen mit:
   ```
   DISCORD_TOKEN=your_bot_token
   CLIENT_ID=your_client_id
   ```
4. Bot starten:
   ```bash
   npm start
   ```

### Railway Deployment

1. Repository zu GitHub pushen
2. Railway Projekt erstellen und mit GitHub verbinden
3. Environment Variables in Railway hinzufügen:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`

## Bot Permissions

Der Bot benötigt folgende Permissions:
- Read Messages/View Channels
- Send Messages
- Manage Roles
- View Audit Log
- Connect (Voice)
- Use Voice Activity

## Entwicklungsplan

### Phase 1: Grundgerüst ✅
- [x] Bot Setup
- [x] Basic Event Listeners
- [x] Logging System

### Phase 2: Datenbank Integration 🔄
- [ ] Database Schema Design
- [ ] User Statistics Models
- [ ] Data Collection Implementation

### Phase 3: Rollen-System 🔄
- [ ] Role Management Logic
- [ ] Configurable Rules Engine
- [ ] Automatic Role Assignment

### Phase 4: Dashboard & Configuration 🔄
- [ ] Web Dashboard
- [ ] Admin Commands
- [ ] Statistics Visualization

## Contributing

Beiträge sind willkommen! Bitte erstelle einen Pull Request für Änderungen.

## License

MIT License
