/**
 * @file background.js
 * @description This script runs in the background of the Chrome extension, handling core functionalities
 * such as tracking browsing activity, managing data storage, and setting up alarms and context menus.
 * It is the central nervous system of ScreenSage Lite.
 *
 * @version 2.1 - Refactored for Efficient Data Storage
 */

// --- GLOBAL STATE ---
let currentSession = null;
let usageCache = {};

// --- CONSTANTS ---
const DEBUG = true;
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;
const IDLE_DETECTION_SECONDS = 60;
const COMMIT_INTERVAL_MINUTES = 5;

function log(...args) {
  if (DEBUG) console.log(`[${new Date().toLocaleTimeString()}] ScreenSage:`, ...args);
}

// --- DOMAIN & URL HELPERS ---
function isTrackableUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    if (['chrome:', 'chrome-extension:', 'moz-extension:', 'edge:', 'file:', 'about:'].includes(u.protocol)) return false;
    return !!u.hostname;
  } catch (e) { return false; }
}

function getDomain(url) {
  try {
    if (!isTrackableUrl(url)) return null;
    return new URL(url).hostname;
  } catch (e) { return null; }
}

// --- SESSION & DATA MANAGEMENT (REFINED) ---

/**
 * @description Loads the usage data from storage into the in-memory cache on startup.
 */
async function loadUsageCache() {
    try {
        const { usage = {} } = await chrome.storage.local.get('usage');
        usageCache = usage;
        log('Usage cache loaded from storage.');
    } catch (e) {
        console.error('Failed to load usage cache', e);
    }
}

/**
 * @description Commits the in-memory usage cache to chrome.storage.local.
 */
async function commitUsageCache() {
    if (Object.keys(usageCache).length === 0) return;

    try {
        await chrome.storage.local.set({ usage: usageCache });
        log('💾 Usage cache committed to storage.', { domains: Object.keys(usageCache).length });
    } catch (e) {
        console.error('Failed to commit usage cache', e);
    }
}

async function endSession() {
    if (!currentSession) return;

    const sessionToEnd = { ...currentSession };
    currentSession = null;

    const duration = Date.now() - sessionToEnd.startTime;

    if (duration > 1000 && duration < MAX_SESSION_MS) {
        usageCache[sessionToEnd.domain] = (usageCache[sessionToEnd.domain] || 0) + duration;
        log('✅ Session Ended, cache updated:', { domain: sessionToEnd.domain, duration: `${(duration/1000).toFixed(1)}s` });
    }
}

async function startSession(tab) {
    await endSession();

    const domain = getDomain(tab?.url);
    if (domain) {
        currentSession = {
            domain: domain,
            startTime: Date.now(),
            tabId: tab.id,
        };
        log('🚀 Session Started:', { domain, tabId: tab.id });
    }
}

// --- CHROME EVENT LISTENERS ---

async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab;
  } catch (e) {
    log('Could not get current tab', e);
    return null;
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab) await startSession(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    await startSession(tab);
  }
});

function scheduleDailyReflectionNotification() {
  const now = new Date();
  const next8PM = new Date();
  next8PM.setHours(20, 0, 0, 0);
  if (now.getTime() > next8PM.getTime()) {
    next8PM.setDate(next8PM.getDate() + 1);
  }
  chrome.alarms.create('screensage-reflection-notification', {
    when: next8PM.getTime(),
    periodInMinutes: 24 * 60
  });
  log('Scheduled daily reflection notification for', new Date(next8PM.getTime()));
}

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await endSession();
    await commitUsageCache();
  } else {
    const tab = await getCurrentTab();
    if (tab) await startSession(tab);
  }
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === 'active') {
    const tab = await getCurrentTab();
    if (tab) await startSession(tab);
  } else {
    await endSession();
    await commitUsageCache();
  }
});

// --- INITIALIZATION & ALARMS ---

chrome.runtime.onInstalled.addListener(async () => {
  chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS);
  chrome.alarms.create('commit-cache', { periodInMinutes: COMMIT_INTERVAL_MINUTES });
  chrome.contextMenus.create({ id: "proofreadText", title: "Polish with ScreenSage", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "rewriteText", title: "Rewrite with ScreenSage", contexts: ["selection"] });
  scheduleDailyReflectionNotification();
});

chrome.runtime.onStartup.addListener(() => {
  loadUsageCache();
  chrome.alarms.create('commit-cache', { periodInMinutes: COMMIT_INTERVAL_MINUTES });
  scheduleDailyReflectionNotification();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'commit-cache') {
    commitUsageCache();
  } else if (alarm.name === 'screensage-reflection-notification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/logo.png',
      title: 'Daily Reflection',
      message: 'Time to reflect on your day with ScreenSage Lite!'
    });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info.selectionText || !chrome.ai) return;

    let resultText = '';
    let alertTitle = '';
    let errorMsg = "⚠️ Could not perform AI action.";

    try {
        if (info.menuItemId === "proofreadText") {
            alertTitle = '✅ Proofread Text';
            if (!chrome.ai.proofreader) throw new Error("Proofreader API not available");
            const result = await chrome.ai.proofreader.correct({ input: info.selectionText });
            resultText = result.output;

        } else if (info.menuItemId === "rewriteText") {
            alertTitle = '✍️ Rewritten Text';
            if (!chrome.ai.prompt) throw new Error("Prompt API not available");
            const result = await chrome.ai.prompt.generate({
                input: `Rewrite the following text to be clearer and more concise, while retaining the original meaning:\n\n"${info.selectionText}"`
            });
            resultText = result.output;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text, title) => {
                alert(title + ":\n\n" + text);
            },
            args: [resultText, alertTitle]
        });

    } catch (err) {
        console.error("Context Menu AI Error:", err);
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (msg) => alert(msg),
            args: [errorMsg]
        });
    }
});
