/**
 * @file background.js
 * @description This script runs in the background of the Chrome extension, handling core functionalities
 * such as tracking browsing activity, managing data storage, and setting up alarms and context menus.
 * It is the central nervous system of ScreenSage Lite.
 *
 * @version 2.2 - Restored Tracking Logic & Standardized AI
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

// --- SESSION & DATA MANAGEMENT ---
async function loadUsageCache() {
    try {
        const { usage = {} } = await chrome.storage.local.get('usage');
        usageCache = usage;
        log('Usage cache loaded from storage.');
    } catch (e) {
        console.error('Failed to load usage cache', e);
    }
}

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

// --- INITIALIZATION, ALARMS & CONTEXT MENUS ---
chrome.runtime.onInstalled.addListener(async () => {
  chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS);
  chrome.alarms.create('commit-cache', { periodInMinutes: COMMIT_INTERVAL_MINUTES });
  chrome.contextMenus.create({ id: "proofreadText", title: "Polish with ScreenSage", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "rewriteText", title: "Rewrite with ScreenSage", contexts: ["selection"] });
});

chrome.runtime.onStartup.addListener(() => {
  loadUsageCache();
  chrome.alarms.create('commit-cache', { periodInMinutes: COMMIT_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'commit-cache') {
    commitUsageCache();
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info.selectionText) return;

    let resultText = '';
    let title = '';
    let error = null;

    try {
        const canCreate = await chrome.ai.canCreateTextSession();
        if (canCreate !== 'readily') {
            throw new Error(`AI Text Session not ready. Status: ${canCreate}`);
        }

        const session = await chrome.ai.createTextSession();

        if (info.menuItemId === "proofreadText") {
            title = '✅ Proofread Text';
            const prompt = `Proofread and correct the following text for grammar and spelling errors:\n\n"${info.selectionText}"`;
            resultText = await session.prompt(prompt);

        } else if (info.menuItemId === "rewriteText") {
            title = '✍️ Rewritten Text';
            const prompt = `Rewrite the following text to be clearer and more concise, while retaining the original meaning:\n\n"${info.selectionText}"`;
            resultText = await session.prompt(prompt);
        }

        session.destroy();

    } catch (err) {
        console.error("Context Menu AI Error:", err);
        error = `Could not perform AI action: ${err.message}`;
    }

    const url = new URL(chrome.runtime.getURL('modal/modal.html'));
    url.searchParams.set('title', title || 'Error');
    url.searchParams.set('content', error || resultText);

    chrome.windows.create({
        url: url.href,
        type: 'popup',
        width: 400,
        height: 320,
    });
});
