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
    if (!currentSession) {
        log('END_SESSION: No active session to end.');
        return;
    }
    const sessionToEnd = { ...currentSession };
    currentSession = null; // End session immediately
    const duration = Date.now() - sessionToEnd.startTime;

    // Log the raw ending details
    log(`END_SESSION: Ending session for domain: ${sessionToEnd.domain}, Tab ID: ${sessionToEnd.tabId}`);

    if (duration > 1500 && duration < MAX_SESSION_MS) {
        const previousTime = usageCache[sessionToEnd.domain] || 0;
        usageCache[sessionToEnd.domain] = previousTime + duration;
        log(`END_SESSION: ✅ Committed. Domain: ${sessionToEnd.domain}, Duration: ${(duration/1000).toFixed(1)}s, New Total: ${(usageCache[sessionToEnd.domain]/60000).toFixed(1)}m`);
    } else {
        log(`END_SESSION: 👻 Discarded. Duration ${duration}ms was too short or too long.`);
    }
}

async function startSession(tab) {
    await endSession(); // Ensure any previous session is ended before starting a new one.

    const domain = getDomain(tab?.url);
    if (domain) {
        log(`START_SESSION: 🚀 Starting new session for domain: ${domain} on tab ${tab.id}`);
        currentSession = {
            domain: domain,
            startTime: Date.now(),
            tabId: tab.id,
        };
    } else {
        log(`START_SESSION: 🚫 Cannot start session for untrackable URL: ${tab?.url}`);
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
  log(`EVENT: tabs.onActivated - Tab ${activeInfo.tabId} activated.`);
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab) await startSession(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url && currentSession?.tabId === tabId) {
    log(`EVENT: tabs.onUpdated - URL changed for active tab ${tabId}: ${changeInfo.url}`);
    await startSession(tab);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  log(`EVENT: windows.onFocusChanged - Window focus changed to ID: ${windowId}`);
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    log('Window lost focus. Ending session and committing cache.');
    await endSession();
    await commitUsageCache();
  } else {
    const tab = await getCurrentTab();
    if (tab) await startSession(tab);
  }
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  log(`EVENT: idle.onStateChanged - State changed to: ${newState}`);
  if (newState === 'active') {
    const tab = await getCurrentTab();
    if (tab) await startSession(tab);
  } else {
    // Covers 'idle' and 'locked' states
    log('User is idle or screen is locked. Ending session and committing cache.');
    await endSession();
    await commitUsageCache();
  }
});

// --- INITIALIZATION, ALARMS & CONTEXT MENUS ---
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "proofreadText", title: "Polish with ScreenSage", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "rewriteText", title: "Rewrite with ScreenSage", contexts: ["selection"] });
  });
  chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS);
  chrome.alarms.create('commit-cache', { periodInMinutes: COMMIT_INTERVAL_MINUTES });
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

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!info.selectionText || !tab?.id) return;

    // With content.js now statically injected via the manifest, we can just send
    // a message directly without needing to programmatically inject the script.
    chrome.tabs.sendMessage(tab.id, {
        type: 'CONTEXT_MENU_COMMAND',
        menuItemId: info.menuItemId,
        selectionText: info.selectionText,
    });
});

// --- NEW --- Message listener for real-time data requests from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // This is made async to handle the race condition where the popup opens
    // before the background script has loaded its cache from storage.
    if (request.type === 'GET_USAGE_DATA') {
        (async () => {
            await loadUsageCache(); // Ensure cache is loaded before responding.

            const dataWithCurrentSession = { ...usageCache };
            if (currentSession) {
                const duration = Date.now() - currentSession.startTime;
                dataWithCurrentSession[currentSession.domain] = (dataWithCurrentSession[currentSession.domain] || 0) + duration;
            }
            log('Popup requested data. Sending real-time usage cache.');
            sendResponse(dataWithCurrentSession);
        })();
    }
    // Return true to indicate that the response is sent asynchronously.
    return true;
});

// --- NEW --- Listener for when the service worker is about to be terminated.
// This is a crucial part of the Manifest V3 lifecycle.
chrome.runtime.onSuspend.addListener(async () => {
    log('EVENT: runtime.onSuspend - Service worker is suspending.');
    await endSession();
    await commitUsageCache();
});
