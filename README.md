# Amman Prayer Times & Quran Discord Bot 🕌

A feature-rich Discord bot designed to keep your server connected with faith by:
1. **Prayer Times Reminders:** Notifies the server of the official prayer times in Amman, Jordan (synced with the Ministry of Awqaf, Jordan) displayed in 12-hour AM/PM format.
2. **Daily Adhkar:** Reminds the server of **أذكار الصباح** (Morning Adhkar) 15 minutes after Fajr, and **أذكار المساء** (Evening Adhkar) 15 minutes after Asr.
3. **Periodic Reminders:** Sends periodic **الأذكار العامة والصلاة على النبي** (general dhikr and blessings upon the Prophet) with custom intervals. Mentions are sent directly in the message text so they display in full on your desktop/mobile notifications.
4. **Hydration Reminder:** Automatically reminds members to take a hydration break (defaulting to every 60 minutes) with the custom message `"Drink Water Nigga"`.
5. **Quran Playback:** Plays high-quality Quran recitation in voice channels from **11 popular reciters (imams)**, either as a **24/7 Live Radio** stream or **Surah-by-Surah** (Surahs 1 to 114) with auto-play of the next Surah!
6. **Rich Presence Status:** Dynamically displays what Surah and Reciter are currently playing in the bot's Discord activity status.

---

## 🛠️ Requirements & Setup

Before running the bot, you will need to register a bot application on Discord and obtain its credentials.

### Step 1: Create a Discord Application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and give it a name.
3. Navigate to the **Bot** tab on the left sidebar:
   - Click **Add Bot**.
   - Under **Token**, click **Reset Token** and copy the token. This is your `DISCORD_TOKEN`.
   - Scroll down to **Privileged Gateway Intents** and enable **Server Members Intent** (recommended for channel checks).
4. Navigate to the **OAuth2** tab:
   - Under **General**, copy the **Client ID** (Application ID). This is your `CLIENT_ID`.

### Step 2: Invite the Bot to Your Server
1. In the **OAuth2** -> **URL Generator** tab:
   - Select the `bot` and `applications.commands` scopes.
   - Under **Bot Permissions**, select the following permissions:
     - **Text Permissions:** `Send Messages`, `Embed Links`, `Read Message History`
     - **Voice Permissions:** `Connect`, `Speak`, `Use Voice Activity`
2. Copy the generated URL at the bottom and open it in your browser to invite the bot to your Discord server.

---

## 🚀 Running the Bot Locally

1. **Install Dependencies:**
   Make sure Node.js is installed. Run the following command in the project folder:
   ```bash
   npm install
   ```

2. **Configure Credentials:**
   Open the `.env` file in the project folder and fill in your credentials:
   ```env
   DISCORD_TOKEN=your_copied_bot_token
   CLIENT_ID=your_copied_client_id
   GUILD_ID=optional_your_test_server_id
   ```
   *Note: Providing a `GUILD_ID` registers commands instantly on that server for testing. If left empty, commands are registered globally (which may take up to an hour to sync across all servers).*

3. **Deploy Slash Commands:**
   Register the slash commands with the Discord API by running:
   ```bash
   npm run deploy
   ```

4. **Start the Bot:**
   Run the main bot script:
   ```bash
   npm start
   ```

---

## 📖 Bot Commands

Once the bot is online, use these commands inside your Discord server:

| Command | Description |
|---|---|
| `/help` | Displays a helpful user manual for the bot. |
| `/setchannel` | Sets the text channel where prayer times, Adhkar, and hydration reminders will be posted. *(Requires Manage Channels permission)* |
| `/setinterval` | Sets the Adhkar frequency in minutes (e.g. `/setinterval minutes:10`). Enter `0` to disable periodic reminders. *(Requires Manage Channels permission)* |
| `/setduainterval` | Sets the Dua frequency in minutes (e.g. `/setduainterval minutes:15`). Enter `0` to disable periodic supplications. *(Requires Manage Channels permission)* |
| `/sethydration` | Sets the Hydration reminder frequency in minutes (e.g. `/sethydration minutes:60`). Enter `0` to disable hydration reminders. *(Requires Manage Channels permission)* |
| `/setmention` | Choose the mention type for announcements (`everyone`, `here`, or `none`). If you have a role named **`تذكير`**, selecting `everyone` will automatically mention the role instead of `@everyone`! *(Requires Manage Channels permission)* |
| `/togglealldms` | Toggles whether the bot DMs every server member when a prayer time arrives. *(Requires Administrator permission)* |
| `/remindme` | Toggles personal prayer reminders in direct messages (DMs) for yourself (opt-in/opt-out). |
| `/prayer` | Displays today's prayer times for Amman, Jordan in 12-hour AM/PM format. |
| `/adhkar` | Sends a random dhikr/salawat immediately. |
| `/dua` | Sends a random supplication/Dua immediately. |
| `/hydration` | Sends a hydration break reminder immediately. |
| `/playquran` | Joins your voice channel and plays Quran. Select a `reciter` (from 11 options). Optionally specify a `surah` (1-114). If `surah` is left empty, it plays the **24/7 Live Radio** stream. |
| `/volume` | Sets the playback volume (0 to 100). |
| `/stop` | Stops Quran playback and disconnects the bot from the voice channel. |

---

## 🎙️ Supported Reciters (Imams)

1. **مشاري راشد العفاسي** (Mishary Alafasy)
2. **ماهر المعيقلي** (Maher Al-Muaiqly)
3. **عبد الرحمن السديس** (Abdul Rahman Al-Sudais)
4. **سعد الغامدي** (Saad Al-Ghamdi)
5. **ياسر الدوسري** (Yasser Al-Dosari)
6. **عبد الباسط عبد الصمد** (Abdul Basit)
7. **محمد صديق المنشاوي** (Al-Minshawi)
8. **محمود خليل الحصري** (Al-Husary)
9. **سعود الشريم** (Saud Al-Shuraim)
10. **فارس عباد** (Fares Abbad)
11. **أحمد العجمي** (Ahmed Al-Ajmi)

---

## 🔒 Automated & Rich Features
- **Auto-Disconnect on Empty:** If the bot is playing Quran in a voice channel and everyone leaves, the bot will automatically pause, announce it in the text channel, and disconnect after 30 seconds to save bandwidth.
- **Auto-Playlist:** When playing a specific Surah (e.g. Surah Al-Fatihah), the bot will automatically transition to the next Surah (Surah Al-Baqarah) when it completes, playing through the entire Quran unless stopped.
- **Dynamic Rich Presence:** The bot status dynamically shows which Surah and Reciter are playing (e.g. `Listening to سورة البقرة | ماهر المعيقلي`).
- **Dynamic Role Mentions:** Creates a smart fallback system: if you create a role named **`تذكير`** on your server, selecting `everyone` mentions will automatically ping that role instead of pinging `@everyone`!

