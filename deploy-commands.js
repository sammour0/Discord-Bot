// deploy-commands.js - Register slash commands with Discord API
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('كيفية استخدام البوت وإعداداته (How to use the bot)'),
        
    new SlashCommandBuilder()
        .setName('setchannel')
        .setDescription('تحديد قناة لإرسال الأذكار ومواقيت الصلاة (Set notification channel)')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('القناة المستهدفة (The target channel)')
                .setRequired(true)
        ),
        
    new SlashCommandBuilder()
        .setName('prayer')
        .setDescription('عرض مواقيت الصلاة لليوم في عمان، الأردن (Today\'s prayer times for Amman)'),
        
    new SlashCommandBuilder()
        .setName('adhkar')
        .setDescription('إرسال ذكر عشوائي فوراً (Send a random Dhikr immediately)'),
        
    new SlashCommandBuilder()
        .setName('dua')
        .setDescription('إرسال دعاء عشوائي فوراً (Send a random Dua/Supplication immediately)'),
        
    new SlashCommandBuilder()
        .setName('setinterval')
        .setDescription('تعديل المدة الزمنية لتذكير الأذكار بالدقائق (Set periodic Adhkar interval)')
        .addIntegerOption(option => 
            option.setName('minutes')
                .setDescription('المدة بالدقائق، أدخل 0 لإيقاف التذكير (Interval in minutes, 0 to disable)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(1440)
        ),
        
    new SlashCommandBuilder()
        .setName('playquran')
        .setDescription('تشغيل القرآن الكريم بصوت أشهر القراء في القناة الصوتية (Play Quran in voice channel)')
        .addStringOption(option => 
            option.setName('reciter')
                .setDescription('القارئ المطلوب (Choose the reciter)')
                .setRequired(true)
                .addChoices(
                    { name: 'مشاري راشد العفاسي (Mishary Alafasy)', value: 'alafasy' },
                    { name: 'عبد الرحمن السديس (Abdul Rahman Al-Sudais)', value: 'sudais' },
                    { name: 'ماهر المعيقلي (Maher Al-Muaiqly)', value: 'maher' },
                    { name: 'سعد الغامدي (Saad Al-Ghamdi)', value: 'ghamdi' },
                    { name: 'ياسر الدوسري (Yasser Al-Dosari)', value: 'dosari' },
                    { name: 'عبد الباسط عبد الصمد (Abdul Basit)', value: 'basit' },
                    { name: 'محمد صديق المنشاوي (Al-Minshawi)', value: 'minshawi' },
                    { name: 'محمود خليل الحصري (Al-Husary)', value: 'husary' },
                    { name: 'سعود الشريم (Saud Al-Shuraim)', value: 'shuraim' },
                    { name: 'فارس عباد (Fares Abbad)', value: 'fares' },
                    { name: 'أحمد العجمي (Ahmed Al-Ajmi)', value: 'ajmi' }
                )
        )
        .addIntegerOption(option => 
            option.setName('surah')
                .setDescription('رقم السورة من 1 إلى 114. اتركه فارغاً لتشغيل راديو البث المباشر (Surah number, empty for 24/7 radio)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(114)
        ),
        
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('إيقاف تشغيل القرآن ومغادرة القناة الصوتية (Stop playback and leave voice channel)'),
        
    new SlashCommandBuilder()
        .setName('volume')
        .setDescription('تعديل مستوى الصوت (Adjust playback volume)')
        .addIntegerOption(option => 
            option.setName('level')
                .setDescription('مستوى الصوت من 0 إلى 100 (Volume level 0-100)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100)
        ),
        
    new SlashCommandBuilder()
        .setName('setmention')
        .setDescription('تحديد نوع الإشارة للأذكار والصلاة (Set mention type for alerts)')
        .addStringOption(option => 
            option.setName('type')
                .setDescription('نوع الإشارة (everyone, here, none)')
                .setRequired(true)
                .addChoices(
                    { name: 'الجميع (@everyone)', value: 'everyone' },
                    { name: 'المتواجدون (@here)', value: 'here' },
                    { name: 'تعطيل الإشارة (none)', value: 'none' }
                )
        ),
        
    new SlashCommandBuilder()
        .setName('togglealldms')
        .setDescription('تفعيل أو تعطيل إرسال رسائل خاصة لجميع الأعضاء عند كل صلاة (Toggle DM to all members for prayers)'),
        
    new SlashCommandBuilder()
        .setName('remindme')
        .setDescription('تفعيل أو تعطيل تذكيرك بالصلاة في الرسائل الخاصة (Toggle personal DM prayer reminders)'),

    new SlashCommandBuilder()
        .setName('sethydration')
        .setDescription('تعديل المدة الزمنية للتذكير بشرب الماء بالدقائق (Set periodic hydration reminder interval)')
        .addIntegerOption(option => 
            option.setName('minutes')
                .setDescription('المدة بالدقائق، أدخل 0 لإيقاف التذكير (Interval in minutes, 0 to disable)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(1440)
        ),
        
    new SlashCommandBuilder()
        .setName('hydration')
        .setDescription('تذكير بشرب الماء فوراً (Send hydration reminder immediately)')
].map(command => command.toJSON());

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error('Error: DISCORD_TOKEN and CLIENT_ID must be specified in the .env file.');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        if (process.env.GUILD_ID) {
            console.log(`Registering commands to a specific guild: ${process.env.GUILD_ID}`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
        } else {
            console.log('Registering commands globally (could take up to 1 hour to sync on all servers).');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
        }

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();
