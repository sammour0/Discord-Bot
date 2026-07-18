// Set FFmpeg path for @discordjs/voice before importing anything related to voice
try {
    process.env.FFMPEG_PATH = require('ffmpeg-static');
    console.log('Static FFmpeg path initialized:', process.env.FFMPEG_PATH);
} catch (err) {
    console.error('Failed to initialize static FFmpeg:', err);
}

const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
require('dotenv').config();

const adhkar = require('./adhkar');
const { 
    getSettings, 
    saveSettings, 
    loadSettings, 
    getAmmanDateString, 
    getAmmanTime, 
    fetchPrayerTimes 
} = require('./utils');

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// Map of voice channel sessions per guild: guildId -> { connection, player, volume, reciter, surah, textChannelId, leaveTimeout }
const voiceSessions = new Map();

// Map of last Adhkar reminders per guild: guildId -> timestamp (ms)
const lastAdhkarAlerts = new Map();

// Map of last hydration reminders per guild: guildId -> timestamp (ms)
const lastHydrationAlerts = new Map();

// Global prayer times cache for today
let todayTimings = null;
let currentCachedDate = "";

// 114 Surah Names in Arabic
const SURAH_NAMES = [
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
    "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
    "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
    "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
    "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
    "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
    "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
    "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
    "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
    "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
    "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
    "المسد", "الإخلاص", "الفلق", "الناس"
];

// 11 Popular Reciters
const RECITERS = {
    alafasy: {
        name: "مشاري راشد العفاسي",
        radioUrl: "https://backup.qurango.net/radio/mishary_alafasy",
        serverUrl: "https://server8.mp3quran.net/afs/"
    },
    sudais: {
        name: "عبد الرحمن السديس",
        radioUrl: "https://backup.qurango.net/radio/sudaes",
        serverUrl: "https://server11.mp3quran.net/sds/"
    },
    maher: {
        name: "ماهر المعيقلي",
        radioUrl: "https://backup.qurango.net/radio/maher",
        serverUrl: "https://server12.mp3quran.net/maher/"
    },
    ghamdi: {
        name: "سعد الغامدي",
        radioUrl: "https://backup.qurango.net/radio/s_ghamdi",
        serverUrl: "https://server7.mp3quran.net/s_gmd/"
    },
    dosari: {
        name: "ياسر الدوسري",
        radioUrl: "https://backup.qurango.net/radio/yasser_dousery",
        serverUrl: "https://server11.mp3quran.net/yasser/"
    },
    basit: {
        name: "عبد الباسط عبد الصمد",
        radioUrl: "https://backup.qurango.net/radio/basit",
        serverUrl: "https://server7.mp3quran.net/basit/"
    },
    minshawi: {
        name: "محمد صديق المنشاوي",
        radioUrl: "https://backup.qurango.net/radio/minshawi",
        serverUrl: "https://server10.mp3quran.net/minsh/"
    },
    husary: {
        name: "محمود خليل الحصري",
        radioUrl: "https://backup.qurango.net/radio/alhusary",
        serverUrl: "https://server13.mp3quran.net/husr/"
    },
    shuraim: {
        name: "سعود الشريم",
        radioUrl: "https://backup.qurango.net/radio/shuraim",
        serverUrl: "https://server7.mp3quran.net/shur/"
    },
    fares: {
        name: "فارس عباد",
        radioUrl: "https://backup.qurango.net/radio/fares",
        serverUrl: "https://server8.mp3quran.net/frs_a/"
    },
    ajmi: {
        name: "أحمد العجمي",
        radioUrl: "https://backup.qurango.net/radio/ahmed_alajmi",
        serverUrl: "https://server10.mp3quran.net/ajm/"
    }
};

// Error Handling to prevent crashes
client.on('error', error => {
    console.error('Discord client error:', error);
});

client.on('shardError', error => {
    console.error('WebSocket connection error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Ready Event
client.once('ready', async () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    
    // Set Discord Presence
    client.user.setPresence({
        activities: [{ name: 'مواقيت الصلاة والقرآن الكريم', type: ActivityType.Watching }],
        status: 'online',
    });

    // Initial Fetch of prayer times
    const ammanDate = getAmmanDateString();
    todayTimings = await fetchPrayerTimes(ammanDate);
    if (todayTimings) {
        currentCachedDate = ammanDate;
        console.log(`Loaded prayer times for Amman, Jordan [${ammanDate}]:`, todayTimings);
    }

    // Initialize Adhkar and hydration periodic timers
    const allSettings = loadSettings();
    const now = Date.now();
    for (const guildId in allSettings) {
        lastAdhkarAlerts.set(guildId, now);
        lastHydrationAlerts.set(guildId, now);
    }

    // Start Unified 1-Minute Scheduler Loop
    startSchedulerLoop();
});

// Helper: Add minutes to HH:MM time string
function addMinutesToTime(timeStr, minutesToAdd) {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(':').map(Number);
    let date = new Date();
    date.setHours(hours, minutes, 0, 0);
    date = new Date(date.getTime() + minutesToAdd * 60 * 1000);
    const newHours = String(date.getHours()).padStart(2, '0');
    const newMins = String(date.getMinutes()).padStart(2, '0');
    return `${newHours}:${newMins}`;
}

// Helper: Formats articles list into a bullet list safe for Discord's 1024 char embed field limit
function formatNewsList(articles) {
    if (!articles || articles.length === 0) return '*لا توجد أخبار حالياً (No updates available)*';
    let list = '';
    for (const art of articles) {
        const item = `• [${art.title}](${art.link}) *(المصدر: ${art.source})*`;
        if (list.length + item.length + 2 > 1024) {
            break; // Stop adding items to prevent exceeding 1024 limit
        }
        list += (list ? '\n\n' : '') + item;
    }
    return list || '*لا توجد أخبار حالياً (No updates available)*';
}

// Unified Scheduler Loop (Checks every minute)
function startSchedulerLoop() {
    let lastProcessedMinute = "";

    setInterval(async () => {
        const ammanDate = getAmmanDateString();
        const ammanTime = getAmmanTime(); // Format: HH:MM
        const currentMinuteStr = `${ammanDate}_${ammanTime}`;

        // Prevent duplicate execution within the same minute
        if (currentMinuteStr === lastProcessedMinute) return;
        lastProcessedMinute = currentMinuteStr;

        console.log(`[Scheduler] Checking for date: ${ammanDate}, time: ${ammanTime}...`);

        // Rollover: If date changed, fetch new prayer times
        if (ammanDate !== currentCachedDate) {
            console.log(`New day detected (${ammanDate}), fetching new prayer times...`);
            const timings = await fetchPrayerTimes(ammanDate);
            if (timings) {
                todayTimings = timings;
                currentCachedDate = ammanDate;
                console.log(`Loaded prayer times for new day:`, todayTimings);
            }
        }

        if (todayTimings) {
            // 1. Check Prayer Times
            const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
            for (const prayer of prayers) {
                if (todayTimings[prayer] === ammanTime) {
                    console.log(`[Scheduler] Triggering alert for ${prayer} at ${ammanTime}`);
                    await sendPrayerAlert(prayer);
                }
            }

            // 2. Check Morning Adhkar (Fajr + 15 mins)
            const morningTriggerTime = addMinutesToTime(todayTimings.Fajr, 15);
            if (ammanTime === morningTriggerTime) {
                console.log(`[Scheduler] Triggering morning Adhkar at ${ammanTime}`);
                await sendMorningEveningAdhkarAlert('morning');
            }

            // 3. Check Evening Adhkar (Asr + 15 mins)
            const eveningTriggerTime = addMinutesToTime(todayTimings.Asr, 15);
            if (ammanTime === eveningTriggerTime) {
                console.log(`[Scheduler] Triggering evening Adhkar at ${ammanTime}`);
                await sendMorningEveningAdhkarAlert('evening');
            }
        }

        // 5. Check Periodic Adhkar for each guild
        const allSettings = loadSettings();
        const now = Date.now();
        for (const guildId in allSettings) {
            const guildSettings = getSettings(guildId);
            if (guildSettings.channelId && guildSettings.adhkarEnabled && guildSettings.adhkarInterval > 0) {
                const lastAlert = lastAdhkarAlerts.get(guildId) || now;
                const diffMinutes = (now - lastAlert) / (1000 * 60);

                if (diffMinutes >= guildSettings.adhkarInterval - 0.1) {
                    console.log(`[Scheduler] Triggering periodic Adhkar for guild ${guildId}`);
                    await sendPeriodicAdhkar(guildId);
                    lastAdhkarAlerts.set(guildId, now);
                }
            }
        }

        // 6. Check Periodic Hydration Reminder for each guild
        for (const guildId in allSettings) {
            const guildSettings = getSettings(guildId);
            if (guildSettings.channelId && guildSettings.hydrationEnabled && guildSettings.hydrationInterval > 0) {
                const lastHydration = lastHydrationAlerts.get(guildId) || now;
                const diffMinutes = (now - lastHydration) / (1000 * 60);

                if (diffMinutes >= guildSettings.hydrationInterval - 0.1) {
                    console.log(`[Scheduler] Triggering periodic hydration reminder for guild ${guildId}`);
                    await sendHydrationReminder(guildId);
                    lastHydrationAlerts.set(guildId, now);
                }
            }
        }

    }, 30000); // Checks every 30 seconds for stability
}

// Helper: Send private message reminders for prayer times
async function triggerDMPrayers(guildId, prayerAr, prayerTime) {
    const guildSettings = getSettings(guildId);
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const dmEmbed = new EmbedBuilder()
        .setTitle('🕌 تذكير بالصلاة (Prayer Reminder)')
        .setDescription(`أخي المسلم / أختي المسلمة، حان الآن موعد صلاة **${prayerAr}** في عمان.`)
        .addFields(
            { name: 'الوقت', value: prayerTime, inline: true },
            { name: 'التنبيه', value: 'حيّ على الصلاة، حيّ على الفلاح. يرجى أداء الصلاة في وقتها.', inline: true }
        )
        .setColor('#1D8F6F')
        .setTimestamp();

    if (guildSettings.dmPrayersEnabled) {
        // Send to all members in the guild (guild-wide DM)
        try {
            const members = await guild.members.fetch();
            console.log(`[DMs] Attempting to send DM reminders to all ${members.size} members in guild ${guild.name}...`);
            members.forEach(member => {
                if (!member.user.bot) {
                    member.send({ embeds: [dmEmbed] }).catch(err => {
                        // Silently fail if user has DMs disabled
                    });
                }
            });
        } catch (err) {
            console.error(`Failed to fetch members for server-wide DMs in guild ${guildId}:`, err);
        }
    } else if (guildSettings.dmSubscribers && guildSettings.dmSubscribers.length > 0) {
        // Send only to opt-in subscribers
        console.log(`[DMs] Sending personal DM reminders to ${guildSettings.dmSubscribers.length} subscribers in guild ${guild.name}...`);
        for (const userId of guildSettings.dmSubscribers) {
            try {
                const member = await guild.members.fetch(userId);
                if (member && !member.user.bot) {
                    member.send({ embeds: [dmEmbed] }).catch(err => {
                        // Silently fail
                    });
                }
            } catch (err) {
                // Member might have left the guild
            }
        }
    }
}

// (News digest helper removed)

// Helper: Resolve mention text (checks for a role named 'تذكير' if mention type is 'everyone')
async function getMentionText(guildId, mentionType) {
    if (mentionType === 'none') return "";
    if (mentionType === 'here') return "@here";
    
    if (mentionType === 'everyone') {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            try {
                const roles = await guild.roles.fetch();
                const role = roles.find(r => r.name.trim() === 'تذكير');
                if (role) return `<@&${role.id}>`;
            } catch (e) {
                console.error('Error fetching roles for mention:', e);
                // Fallback to cache
                const role = guild.roles.cache.find(r => r.name.trim() === 'تذكير');
                if (role) return `<@&${role.id}>`;
            }
        }
        return "@everyone";
    }
    return "";
}

// Helper: Format 24h time string (e.g. "13:45") to 12h format with AM/PM (e.g. "1:45 PM")
function formatTo12Hour(timeStr) {
    if (!timeStr) return "";
    let [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strMinutes = String(minutes).padStart(2, '0');
    return `${hours}:${strMinutes} ${ampm}`;
}

// Send Prayer Alert
async function sendPrayerAlert(prayerName) {
    const allSettings = loadSettings();
    const prayerTranslations = {
        Fajr: "الفجر",
        Dhuhr: "الظهر",
        Asr: "العصر",
        Maghrib: "المغرب",
        Isha: "العشاء"
    };
    const prayerAr = prayerTranslations[prayerName];

    const embed = new EmbedBuilder()
        .setTitle('🕌 مواقيت الصلاة في عمان')
        .setDescription(`حان الآن موعد أذان **${prayerAr}** في مدينة عمان وضواحيها.`)
        .addFields(
            { name: 'وقت الأذان', value: formatTo12Hour(todayTimings[prayerName]), inline: true },
            { name: 'التاريخ الهجري/الميلادي', value: getAmmanDateString(), inline: true }
        )
        .setColor('#1D8F6F')
        .setFooter({ text: 'صَلِّ صَلَاتَكَ قَبْلَ أَنْ يُصَلَّى عَلَيْك (أقم صلاتك تنعم بحياتك)' })
        .setTimestamp();

    for (const guildId in allSettings) {
        const guildSettings = getSettings(guildId);
        
        // 1. Send text channel alert
        if (guildSettings.channelId) {
            const channel = client.channels.cache.get(guildSettings.channelId);
            if (channel) {
                const mentionText = await getMentionText(guildId, guildSettings.mentionType);

                const content = mentionText 
                    ? `🕌 ${mentionText} | حان الآن موعد صلاة **${prayerAr}**` 
                    : `🕌 | حان الآن موعد صلاة **${prayerAr}**`;

                channel.send({ content, embeds: [embed] }).catch(console.error);
            }
        }

        // 2. Send DM alerts
        triggerDMPrayers(guildId, prayerAr, formatTo12Hour(todayTimings[prayerName]));
    }
}

// Send Morning/Evening Adhkar Alert
async function sendMorningEveningAdhkarAlert(type) {
    const allSettings = loadSettings();
    const isMorning = type === 'morning';
    const title = isMorning ? '🌅 أذكار الصباح' : '🌇 أذكار المساء';
    const color = isMorning ? '#FF9900' : '#4A90E2';
    const adhkarList = isMorning ? adhkar.morning : adhkar.evening;
    
    // Select 5 key supplications
    const selectedAdhkar = adhkarList.slice(0, 6);
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription('حان وقت قراءة الأذكار اليومية لحفظ نفسك وتحصينها. إليك بعض منها:')
        .setColor(color)
        .setTimestamp();

    selectedAdhkar.forEach((text, index) => {
        embed.addFields({ name: `الذكر ${index + 1}`, value: text });
    });

    for (const guildId in allSettings) {
        const guildSettings = getSettings(guildId);
        if (guildSettings.channelId) {
            const channel = client.channels.cache.get(guildSettings.channelId);
            if (channel) {
                const mentionText = getMentionText(guildId, guildSettings.mentionType);
                const content = mentionText ? `${mentionText} | ${title}` : `${title}`;
                channel.send({ content, embeds: [embed] }).catch(console.error);
            }
        }
    }
}

// Send Periodic Adhkar
async function sendPeriodicAdhkar(guildId) {
    const guildSettings = getSettings(guildId);
    if (!guildSettings.channelId) return;

    const channel = client.channels.cache.get(guildSettings.channelId);
    if (!channel) return;

    // Combine general adhkar and salawat
    const pool = [...adhkar.general, ...adhkar.salawat];
    const randomDhikr = pool[Math.floor(Math.random() * pool.length)];

    const embed = new EmbedBuilder()
        .setTitle('✨ ذكر الله | تذكير دوري')
        .setDescription(`**${randomDhikr}**`)
        .setColor('#5865F2')
        .setFooter({ text: `تذكير كل ${guildSettings.adhkarInterval} دقائق | استخدم /setinterval لتغييره` });

    const mentionText = await getMentionText(guildId, guildSettings.mentionType);
    const mentionPrefix = mentionText ? `${mentionText} ` : "";

    channel.send({ content: `${mentionPrefix}✨ **ذكر الله**: ${randomDhikr}`, embeds: [embed] }).catch(console.error);
}

// Send Hydration Reminder
async function sendHydrationReminder(guildId) {
    const guildSettings = getSettings(guildId);
    if (!guildSettings.channelId) return;

    const channel = client.channels.cache.get(guildSettings.channelId);
    if (!channel) return;

    const message = "Drink Water Nigga";
    const embed = new EmbedBuilder()
        .setTitle('💧 تذكير بشرب الماء | Hydration Break')
        .setDescription(`**${message}**`)
        .setColor('#3B82F6')
        .setFooter({ text: `تذكير كل ${guildSettings.hydrationInterval} دقائق | استخدم /sethydration لتغييره` })
        .setTimestamp();

    const mentionText = await getMentionText(guildId, guildSettings.mentionType);
    const mentionPrefix = mentionText ? `${mentionText} ` : "";

    channel.send({ content: `${mentionPrefix}💧 **Hydration Reminder**: ${message}`, embeds: [embed] }).catch(console.error);
}

// Helper: Update Bot Presence based on active voice sessions
function updatePresence() {
    let activeSession = null;
    for (const [guildId, session] of voiceSessions) {
        if (session.connection && session.reciter) {
            activeSession = session;
            break;
        }
    }

    if (activeSession) {
        const reciter = RECITERS[activeSession.reciter];
        let statusText = `القرآن الكريم بصوت ${reciter.name}`;
        if (activeSession.surah) {
            statusText = `سورة ${SURAH_NAMES[activeSession.surah - 1]} | ${reciter.name}`;
        }
        client.user.setPresence({
            activities: [{ name: statusText, type: ActivityType.Listening }],
            status: 'online',
        });
    } else {
        client.user.setPresence({
            activities: [{ name: 'مواقيت الصلاة والقرآن الكريم', type: ActivityType.Watching }],
            status: 'online',
        });
    }
}

// Clean up Voice Session
function cleanupVoice(guildId) {
    const session = voiceSessions.get(guildId);
    if (session) {
        if (session.leaveTimeout) clearTimeout(session.leaveTimeout);
        try {
            session.player.stop();
        } catch (e) {}
        try {
            session.connection.destroy();
        } catch (e) {}
        voiceSessions.delete(guildId);
        updatePresence();
    }
}

// Play Audio Stream Helper
function playStream(guildId, streamUrl, reciterKey, surahNum = null) {
    const session = voiceSessions.get(guildId);
    if (!session) return;

    const resource = createAudioResource(streamUrl, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true
    });
    
    // Default to 50% volume (0.5) if not set
    const currentVolume = session.volume !== undefined ? session.volume : 0.5;
    resource.volume.setVolume(currentVolume);

    session.player.play(resource);
    session.reciter = reciterKey;
    session.surah = surahNum;
    session.currentResource = resource;
    session.volume = currentVolume;
    updatePresence();
}

// Interaction Handler (Commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const { commandName, guildId } = interaction;

    // --- /help command ---
    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('📖 دليل استخدام بوت الأذكار ومواقيت الصلاة')
            .setDescription('أهلاً بك! هذا البوت مخصص لتذكيرك بمواقيت الصلاة في عمان، الأردن، وقراءة الأذكار، وتشغيل القرآن الكريم، والتذكير بشرب الماء.')
            .addFields(
                { name: '⚙️ الإعدادات (Setup)', value: '`/setchannel` - لتحديد القناة النصية لإرسال التذكيرات (مهم جداً)\n`/setinterval` - لتحديد وقت تذكير الأذكار بالدقائق (مثلاً كل 10 دقائق)\n`/sethydration` - لتحديد وقت التذكير بشرب الماء بالدقائق (مثلاً كل 60 دقيقة)\n`/setmention` - لتحديد نوع الإشارة للمجموعات (@everyone, @here, none)\n`/togglealldms` - لتفعيل/تعطيل إرسال رسائل خاصة لجميع الأعضاء عند الصلاة (للإدارة)' },
                { name: '🕌 الصلاة والأذكار والأدعية (Prayer, Adhkar & Duas)', value: '`/prayer` - لعرض مواقيت الصلاة اليوم في عمان\n`/adhkar` - لإرسال ذكر عشوائي فوراً\n`/dua` - لإرسال دعاء عشوائي فوراً\n`/hydration` - لتذكير بشرب الماء فوراً\n`/remindme` - للاشتراك/إلغاء الاشتراك في التذكير بالصلاة عبر الرسائل الخاصة (شخصي)' },
                { name: '🔊 تشغيل القرآن (Play Quran)', value: '`/playquran` - لتشغيل القرآن بصوت قارئ محدد في قناتك الصوتية. يمكنك تحديد رقم السورة (من 1 إلى 114) أو تركها فارغة لتشغيل البث المباشر 24/7.\n`/volume` - لتعديل مستوى الصوت (0-100)\n`/stop` - لإيقاف القراءة ومغادرة القناة الصوتية' }
            )
            .setColor('#1D8F6F')
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    // --- /setchannel command ---
    if (commandName === 'setchannel') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ يجب أن تمتلك صلاحية إدارة القنوات لاستخدام هذا الأمر. (You need Manage Channels permission)', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        if (!channel.isTextBased()) {
            return interaction.reply({ content: '❌ يجب تحديد قناة نصية فقط. (Must be a text channel)', ephemeral: true });
        }

        saveSettings(guildId, 'channelId', channel.id);
        
        // Reset the periodic timer for this guild
        lastAdhkarAlerts.set(guildId, Date.now());

        const embed = new EmbedBuilder()
            .setTitle('✅ تم إعداد قناة التذكيرات')
            .setDescription(`سيتم إرسال مواقيت الصلاة وتذكيرات الأذكار الدورية إلى القناة: <#${channel.id}>`)
            .setColor('#1D8F6F');

        return interaction.reply({ embeds: [embed] });
    }

    // --- /setinterval command ---
    if (commandName === 'setinterval') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ يجب أن تمتلك صلاحية إدارة القنوات لاستخدام هذا الأمر. (You need Manage Channels permission)', ephemeral: true });
        }

        const minutes = interaction.options.getInteger('minutes');
        
        if (minutes === 0) {
            saveSettings(guildId, 'adhkarEnabled', false);
            saveSettings(guildId, 'adhkarInterval', 0);
            return interaction.reply({ content: '✅ تم إيقاف تذكير الأذكار الدوري بنجاح. ستبقى تنبيهات الصلاة وأذكار الصباح/المساء مفعلة.' });
        } else {
            saveSettings(guildId, 'adhkarEnabled', true);
            saveSettings(guildId, 'adhkarInterval', minutes);
            
            // Reset countdown timer
            lastAdhkarAlerts.set(guildId, Date.now());
            
            return interaction.reply({ content: `✅ تم ضبط التذكير بالأذكار الدورية كل **${minutes}** دقيقة.` });
        }
    }

    // --- /prayer command ---
    if (commandName === 'prayer') {
        const ammanDate = getAmmanDateString();
        const timings = await fetchPrayerTimes(ammanDate);

        if (!timings) {
            return interaction.reply({ content: '❌ فشل في جلب مواقيت الصلاة حالياً، يرجى المحاولة لاحقاً.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🕌 مواقيت الصلاة لمدينة عمان | ${ammanDate}`)
            .addFields(
                { name: 'الفجر (Fajr)', value: formatTo12Hour(timings.Fajr), inline: true },
                { name: 'الشروق (Sunrise)', value: formatTo12Hour(timings.Sunrise), inline: true },
                { name: 'الظهر (Dhuhr)', value: formatTo12Hour(timings.Dhuhr), inline: true },
                { name: 'العصر (Asr)', value: formatTo12Hour(timings.Asr), inline: true },
                { name: 'المغرب (Maghrib)', value: formatTo12Hour(timings.Maghrib), inline: true },
                { name: 'العشاء (Isha)', value: formatTo12Hour(timings.Isha), inline: true }
            )
            .setColor('#1D8F6F')
            .setFooter({ text: 'حسب توقيت وزارة الأوقاف والشؤون الإسلامية الأردنية' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    // --- /adhkar command ---
    if (commandName === 'adhkar') {
        const pool = [...adhkar.general, ...adhkar.salawat];
        const randomDhikr = pool[Math.floor(Math.random() * pool.length)];

        const embed = new EmbedBuilder()
            .setTitle('✨ ذكر الله')
            .setDescription(`**${randomDhikr}**`)
            .setColor('#5865F2')
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    // --- /dua command ---
    if (commandName === 'dua') {
        const pool = adhkar.duas;
        const randomDua = pool[Math.floor(Math.random() * pool.length)];

        const embed = new EmbedBuilder()
            .setTitle('🤲 دعاء مستجاب')
            .setDescription(`**${randomDua}**`)
            .setColor('#1D8F6F')
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    // --- /playquran command ---
    if (commandName === 'playquran') {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ يجب أن تكون في قناة صوتية أولاً! (You must join a voice channel)', ephemeral: true });
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            return interaction.reply({ content: '❌ لا أملك صلاحية الدخول أو التحدث في قناتك الصوتية. (I need Connect and Speak permissions)', ephemeral: true });
        }

        await interaction.deferReply();

        const reciterKey = interaction.options.getString('reciter');
        const surahNum = interaction.options.getInteger('surah');
        const reciter = RECITERS[reciterKey];

        // Close any existing session
        cleanupVoice(guildId);

        // Join voice channel
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        // Create voice session object
        const session = {
            connection,
            player,
            volume: 0.5, // 50% default
            reciter: reciterKey,
            surah: surahNum,
            textChannelId: interaction.channelId,
            leaveTimeout: null
        };
        voiceSessions.set(guildId, session);

        // Build Stream URL
        let streamUrl = "";
        let isRadio = false;

        if (surahNum) {
            const surahStr = String(surahNum).padStart(3, '0');
            streamUrl = `${reciter.serverUrl}${surahStr}.mp3`;
        } else {
            streamUrl = reciter.radioUrl;
            isRadio = true;
        }

        // Setup Player Error Handler
        player.on('error', error => {
            console.error(`Audio player error on guild ${guildId}:`, error.message, error);
            interaction.channel.send('❌ حدث خطأ أثناء تشغيل الملف الصوتي، جاري تخطي الملف...').catch(console.error);
            // If it was a Surah, try to skip to the next one
            if (session.surah) {
                player.emit(AudioPlayerStatus.Idle);
            } else {
                cleanupVoice(guildId);
            }
        });

        // Setup Player State Change (Track end logic)
        player.on(AudioPlayerStatus.Idle, () => {
            const currentSession = voiceSessions.get(guildId);
            if (currentSession && currentSession.surah) {
                const nextSurah = currentSession.surah + 1;
                if (nextSurah <= 114) {
                    const reciterData = RECITERS[currentSession.reciter];
                    const nextSurahStr = String(nextSurah).padStart(3, '0');
                    const nextUrl = `${reciterData.serverUrl}${nextSurahStr}.mp3`;
                    
                    playStream(guildId, nextUrl, currentSession.reciter, nextSurah);
                    
                    if (currentSession.textChannelId) {
                        const textChannel = client.channels.cache.get(currentSession.textChannelId);
                        if (textChannel) {
                            const embed = new EmbedBuilder()
                                .setTitle('📖 السورة التالية')
                                .setDescription(`تم الانتقال تلقائياً إلى **سورة ${SURAH_NAMES[nextSurah - 1]}** بصوت القارئ **${reciterData.name}**`)
                                .setColor('#1D8F6F');
                            textChannel.send({ embeds: [embed] }).catch(console.error);
                        }
                    }
                } else {
                    // Quran ended
                    if (currentSession.textChannelId) {
                        const textChannel = client.channels.cache.get(currentSession.textChannelId);
                        if (textChannel) {
                            textChannel.send('📖 تم إكمال قراءة المصحف كاملاً، شكراً لاستماعكم.').catch(console.error);
                        }
                    }
                    cleanupVoice(guildId);
                }
            }
        });

        // Play the stream
        try {
            playStream(guildId, streamUrl, reciterKey, surahNum);
            
            const embed = new EmbedBuilder()
                .setTitle('🔊 تشغيل القرآن الكريم')
                .setColor('#1D8F6F')
                .setTimestamp();

            if (isRadio) {
                embed.setDescription(`جاري تشغيل **البث المباشر (24/7)** بصوت القارئ **${reciter.name}** في قناتك الصوتية.`);
            } else {
                embed.setDescription(`جاري تشغيل **سورة ${SURAH_NAMES[surahNum - 1]}** بصوت القارئ **${reciter.name}** في قناتك الصوتية.`);
            }

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Playback trigger error:', error);
            cleanupVoice(guildId);
            return interaction.editReply({ content: '❌ فشل في تشغيل البث المباشر أو السورة، يرجى المحاولة لاحقاً.' });
        }
    }

    // --- /stop command ---
    if (commandName === 'stop') {
        const session = voiceSessions.get(guildId);
        if (!session) {
            return interaction.reply({ content: '❌ البوت غير متصل بأي قناة صوتية حالياً.', ephemeral: true });
        }

        cleanupVoice(guildId);
        return interaction.reply({ content: '🔇 تم إيقاف التشغيل بنجاح ومغادرة القناة الصوتية.' });
    }

    // --- /volume command ---
    if (commandName === 'volume') {
        const session = voiceSessions.get(guildId);
        if (!session) {
            return interaction.reply({ content: '❌ البوت غير متصل بأي قناة صوتية حالياً.', ephemeral: true });
        }

        const level = interaction.options.getInteger('level');
        const volFloat = level / 100;
        
        session.volume = volFloat;
        if (session.currentResource && session.currentResource.volume) {
            session.currentResource.volume.setVolume(volFloat);
        }

        return interaction.reply({ content: `🔊 تم تعديل مستوى الصوت إلى **${level}%**.` });
    }

    // --- /setmention command ---
    if (commandName === 'setmention') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ يجب أن تمتلك صلاحية إدارة القنوات لاستخدام هذا الأمر. (You need Manage Channels permission)', ephemeral: true });
        }

        const type = interaction.options.getString('type');
        saveSettings(guildId, 'mentionType', type);

        const mentionNames = {
            everyone: '@everyone',
            here: '@here',
            none: 'بدون إشارة (none)'
        };

        return interaction.reply({ content: `✅ تم تغيير نوع الإشارة للتنبيهات إلى: **${mentionNames[type]}**.` });
    }

    // --- /togglealldms command ---
    if (commandName === 'togglealldms') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ يجب أن تمتلك صلاحية مدير (Administrator) لاستخدام هذا الأمر.', ephemeral: true });
        }

        const guildSettings = getSettings(guildId);
        const nextState = !guildSettings.dmPrayersEnabled;
        saveSettings(guildId, 'dmPrayersEnabled', nextState);

        if (nextState) {
            return interaction.reply({ content: '⚠️ **تم تفعيل تنبيهات الرسائل الخاصة لجميع أعضاء السيرفر!**\n*ملاحظة: قد يواجه البوت بطئاً أو قيوداً من ديسكورد في السيرفرات الكبيرة لضمان عدم حظره كرسائل مزعجة (Spam).* ' });
        } else {
            return interaction.reply({ content: '✅ **تم تعطيل تنبيهات الرسائل الخاصة لجميع الأعضاء.** سيتلقى الرسائل فقط الأعضاء المشتركون يدوياً عبر `/remindme`.' });
        }
    }

    // --- /remindme command ---
    if (commandName === 'remindme') {
        const guildSettings = getSettings(guildId);
        let subscribers = guildSettings.dmSubscribers || [];
        const userId = interaction.user.id;

        const isSubscribed = subscribers.includes(userId);
        if (isSubscribed) {
            subscribers = subscribers.filter(id => id !== userId);
            saveSettings(guildId, 'dmSubscribers', subscribers);
            return interaction.reply({ content: '✅ تم إلغاء اشتراكك في تنبيهات الصلاة بالرسائل الخاصة بنجاح.', ephemeral: true });
        } else {
            subscribers.push(userId);
            saveSettings(guildId, 'dmSubscribers', subscribers);
            return interaction.reply({ content: '✅ تم تفعيل اشتراكك في تنبيهات الصلاة بالرسائل الخاصة! سأقوم بمراسلتك في كل وقت صلاة.', ephemeral: true });
        }
    }

    // --- /sethydration command ---
    if (commandName === 'sethydration') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ يجب أن تمتلك صلاحية إدارة القنوات لاستخدام هذا الأمر. (You need Manage Channels permission)', ephemeral: true });
        }

        const minutes = interaction.options.getInteger('minutes');
        
        if (minutes === 0) {
            saveSettings(guildId, 'hydrationEnabled', false);
            saveSettings(guildId, 'hydrationInterval', 0);
            return interaction.reply({ content: '✅ تم إيقاف تذكير شرب الماء الدوري بنجاح.' });
        } else {
            saveSettings(guildId, 'hydrationEnabled', true);
            saveSettings(guildId, 'hydrationInterval', minutes);
            
            // Reset countdown timer
            lastHydrationAlerts.set(guildId, Date.now());
            
            return interaction.reply({ content: `✅ تم ضبط التذكير بشرب الماء الدوري كل **${minutes}** دقيقة.` });
        }
    }

    // --- /hydration command ---
    if (commandName === 'hydration') {
        const message = "Drink Water Nigga";
        const embed = new EmbedBuilder()
            .setTitle('💧 تذكير بشرب الماء | Hydration Break')
            .setDescription(`**${message}**`)
            .setColor('#3B82F6')
            .setTimestamp();

        return interaction.reply({ content: `💧 **Hydration Reminder**: ${message}`, embeds: [embed] });
    }
    } catch (error) {
        console.error('Error handling interaction:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر. (An error occurred executing this command.)' });
            } else {
                await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر. (An error occurred executing this command.)', ephemeral: true });
            }
        } catch (e) {
            // Ignore if interaction is expired or already replied
        }
    }
});

// Voice State Update Event (Handles auto-disconnect on empty channels)
client.on('voiceStateUpdate', (oldState, newState) => {
    const guildId = oldState.guild.id;
    const session = voiceSessions.get(guildId);
    if (!session) return;

    // Get current bot voice channel
    const botMember = oldState.guild.members.me;
    if (!botMember || !botMember.voice || !botMember.voice.channel) {
        // Bot was disconnected from voice channel externally
        cleanupVoice(guildId);
        return;
    }

    const botVoiceChannel = botMember.voice.channel;

    // Count human users in channel
    const humanCount = botVoiceChannel.members.filter(member => !member.user.bot).size;

    if (humanCount === 0) {
        // Setup leave timeout if not already set
        if (!session.leaveTimeout) {
            console.log(`Voice channel empty in guild ${guildId}, starting 30s leave timeout...`);
            session.leaveTimeout = setTimeout(() => {
                const currentChannel = oldState.guild.members.me.voice.channel;
                if (currentChannel && currentChannel.members.filter(m => !m.user.bot).size === 0) {
                    if (session.textChannelId) {
                        const channel = client.channels.cache.get(session.textChannelId);
                        if (channel) {
                            channel.send('🔇 تم مغادرة القناة الصوتية تلقائياً لعدم وجود مستمعين.').catch(console.error);
                        }
                    }
                    cleanupVoice(guildId);
                }
            }, 30000); // 30 seconds
        }
    } else {
        // Someone joined back, cancel timeout
        if (session.leaveTimeout) {
            console.log(`User joined back in voice channel of guild ${guildId}, cancelling leave timeout.`);
            clearTimeout(session.leaveTimeout);
            session.leaveTimeout = null;
        }
    }
});

// Start the client
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(err => {
        console.error('Error logging in to Discord:', err);
    });
} else {
    console.error('Error: DISCORD_TOKEN is missing in the .env file.');
}
