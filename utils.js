// utils.js - Utility functions for settings, caching, and prayer times fetch
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const CACHE_FILE = path.join(__dirname, 'prayer_cache.json');

const DEFAULT_SETTINGS = {
    channelId: null,
    adhkarInterval: 10, // in minutes
    adhkarEnabled: true,
    hydrationInterval: 60, // in minutes
    hydrationEnabled: true,
    duaInterval: 15, // in minutes
    duaEnabled: true,
    mentionType: 'everyone', // 'everyone', 'here', 'none'
    dmPrayersEnabled: false,
    dmSubscribers: [] // Array of user IDs
};

// --- Settings Operations ---

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            return JSON.parse(data || '{}');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    return {};
}

function getSettings(guildId) {
    const allSettings = loadSettings();
    const guildSettings = allSettings[guildId] || {};
    return { ...DEFAULT_SETTINGS, ...guildSettings };
}

function saveSettings(guildId, key, value) {
    try {
        const allSettings = loadSettings();
        if (!allSettings[guildId]) {
            allSettings[guildId] = {};
        }
        allSettings[guildId][key] = value;
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

// --- Date & Time Operations in Asia/Amman Timezone ---

function getAmmanDateString() {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Amman',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    // Formatter outputs "DD/MM/YYYY"
    return formatter.format(new Date()).replace(/\//g, '-');
}

function getAmmanTime() {
    // Returns string of current time in HH:MM format in Amman
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Amman',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    return formatter.format(new Date());
}

// --- Prayer Times Operations ---

async function fetchPrayerTimes(dateStr) {
    const targetDate = dateStr || getAmmanDateString();

    // Check cache first
    let cache = {};
    if (fs.existsSync(CACHE_FILE)) {
        try {
            cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8') || '{}');
            if (cache[targetDate]) {
                return cache[targetDate];
            }
        } catch (e) {
            console.error('Cache read error:', e);
        }
    }

    // Cache miss, fetch from Aladhan API
    const url = `https://api.aladhan.com/v1/timingsByCity/${targetDate}?city=Amman&country=Jordan&method=23`;
    console.log(`Fetching prayer times from API for date ${targetDate}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const json = await response.json();
        
        if (json && json.data && json.data.timings) {
            // Extracted timings (e.g. Fajr, Dhuhr, Asr, Maghrib, Isha)
            const timings = {
                Fajr: json.data.timings.Fajr,
                Sunrise: json.data.timings.Sunrise,
                Dhuhr: json.data.timings.Dhuhr,
                Asr: json.data.timings.Asr,
                Sunset: json.data.timings.Sunset,
                Maghrib: json.data.timings.Maghrib,
                Isha: json.data.timings.Isha
            };

            // Save to cache
            cache[targetDate] = timings;
            fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
            return timings;
        } else {
            throw new Error('Invalid API response structure');
        }
    } catch (error) {
        console.error(`Failed to fetch prayer times for ${targetDate}:`, error);
        // If fetch fails, try to return previous day's cache as fallback, or return null
        if (Object.keys(cache).length > 0) {
            const cachedDates = Object.keys(cache);
            const latestCachedDate = cachedDates[cachedDates.length - 1];
            console.warn(`Falling back to cached timings from ${latestCachedDate}`);
            return cache[latestCachedDate];
        }
        return null;
    }
}

module.exports = {
    getSettings,
    saveSettings,
    loadSettings,
    getAmmanDateString,
    getAmmanTime,
    fetchPrayerTimes
};
