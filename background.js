/**
 * @file background.js
 * @description This script runs in the background of the Chrome extension, handling core functionalities
 * such as tracking browsing activity, managing data storage, and setting up alarms and context menus.
 * It is the central nervous system of ScreenSage Lite.
 */

// --- GLOBAL STATE ---
/**
 * @description Tracks the currently active tab to monitor browsing sessions.
 */
let activeTabId = null;
/**
 * @description Stores the domain of the currently active tab.
 */
let activeDomain = null;
/**
 * @description Timestamp for when the current browsing session started.
 */
let startTime = null;
/**
 * @description Flag to check if the browser window is currently focused.
 */
let isWindowFocused = true;
/**
 * @description Timer for debouncing session saves to avoid excessive writes to storage.
 */
let debounceTimer = null;

// --- CONSTANTS ---
const DEBUG = false; // Set to false to disable verbose logging
const DEBOUNCE_MS = 1500; // Delay for saving session data after activity stops
const MAX_SESSION_MS = 24 * 60 * 60 * 1000; // Maximum duration for a single session to be considered valid
const CLEANUP_DAYS = 30; // Data older than this will be removed by the cleanup process

/**
 * @description A logging utility that only logs messages when DEBUG is true.
 * @param {...any} args - The arguments to log.
 */
function log(...args) {
  if (DEBUG) console.log('[ScreenSage]', ...args);
}

// --- DOMAIN & URL HELPERS ---

/**
 * @description Determines if a URL is trackable, ignoring internal Chrome pages, local files, and extensions.
 * @param {string} url - The URL to check.
 * @returns {boolean} - True if the URL is trackable, false otherwise.
 */
function isTrackableUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    const scheme = u.protocol;
    if (scheme === 'chrome:' || scheme === 'chrome-extension:' || scheme === 'moz-extension:' || scheme === 'edge:') return false;
    if (scheme === 'file:') return false;
    if (scheme === 'about:') return false;
    // Allow common dev and intranet hosts
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    // Track normal web hosts and intranet hosts (including .local)
    return !!u.hostname;
  } catch (e) {
    return false;
  }
}

function getDomain(url) {
  try {
    if (!isTrackableUrl(url)) return null;
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

// --- SESSION & DATA MANAGEMENT ---

/**
 * @description Saves the time spent on the current domain to Chrome's local storage.
 * It calculates the duration of the session and updates the total time spent on that domain.
 */
async function saveCurrentSession() {
  if (!activeTabId || !activeDomain || !startTime || !isWindowFocused) return;
  const duration = Date.now() - startTime;
  if (duration <= 0 || duration > MAX_SESSION_MS) {
    log('Skipping invalid duration', { duration, activeDomain });
    startTime = Date.now();
    return;
  }
  try {
    await updateUsage(activeDomain, duration);
    log('Saved session', { domain: activeDomain, duration });
  } catch (e) {
    console.error('Failed to update usage', e);
  } finally {
    startTime = Date.now();
  }
}

/**
 * @description Schedules a debounced save of the current session. This prevents excessive writes
 * to storage by waiting for a period of inactivity before saving.
 */
function scheduleSaveCurrentSession() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void saveCurrentSession();
  }, DEBOUNCE_MS);
}

/**
 * @description Immediately saves the current session, clearing any scheduled debounced saves.
 * This is used when the user navigates away from a page or closes a tab.
 * @returns {Promise<void>}
 */
function flushSave() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  return saveCurrentSession();
}

/**
 * @description Updates the usage statistics for a given domain in storage.
 * @param {string} domain - The domain to update.
 * @param {number} duration - The duration to add to the domain's usage, in milliseconds.
 */
async function updateUsage(domain, duration) {
  if (duration <= 0 || duration > MAX_SESSION_MS) {
    console.warn('Invalid duration detected:', duration);
    return;
  }
  try {
    const now = Date.now();
    const { usage = {}, usageMeta = {} } = await chrome.storage.local.get(['usage', 'usageMeta']);
    const previous = typeof usage[domain] === 'number' ? usage[domain] : 0;
    const nextTotal = previous + duration;
    usage[domain] = nextTotal;
    usageMeta[domain] = now;

    // Mirror per-domain key for backward compatibility
    const writeObject = { usage, usageMeta, [domain]: nextTotal };
    await chrome.storage.local.set(writeObject);
  } catch (e) {
    console.error('Storage update failed', e);
    throw e;
  }
}

/**
 * @description Migrates legacy data stored in individual, per-domain keys to the new `usage` map format.
 * This ensures backward compatibility for users updating from older versions of the extension.
 */
async function migrateLegacyToUsage() {
  try {
    const all = await chrome.storage.local.get(null);
    const usage = all.usage || {};
    const usageMeta = all.usageMeta || {};
    let changed = false;
    for (const [key, value] of Object.entries(all)) {
      if (key === 'usage' || key === 'usageMeta') continue;
      if (typeof value === 'number' && key.includes('.')) {
        if (typeof usage[key] !== 'number') usage[key] = 0;
        usage[key] += value;
        if (!usageMeta[key]) usageMeta[key] = Date.now();
        changed = true;
      }
    }
    if (changed) {
      await chrome.storage.local.set({ usage, usageMeta });
      log('Migrated legacy per-domain keys into usage map');
    }
  } catch (e) {
    console.error('Migration failed', e);
  }
}

/**
 * @description Removes old data from storage to prevent it from growing indefinitely. It removes entries
 * that have not been accessed in a number of days defined by `CLEANUP_DAYS`.
 */
async function cleanupOldData() {
  try {
    const now = Date.now();
    const cutoff = now - CLEANUP_DAYS * 24 * 60 * 60 * 1000;
    const { usage = {}, usageMeta = {} } = await chrome.storage.local.get(['usage', 'usageMeta']);
    let removed = 0;
    for (const [domain, lastSeen] of Object.entries(usageMeta)) {
      if (typeof lastSeen === 'number' && lastSeen < cutoff) {
        delete usage[domain];
        delete usageMeta[domain];
        await chrome.storage.local.remove(domain); // remove mirrored key
        removed++;
      }
    }
    if (removed > 0) {
      await chrome.storage.local.set({ usage, usageMeta });
      log('Cleanup removed stale entries', { removed });
    }
  } catch (e) {
    console.error('Cleanup failed', e);
  }
}

// --- CHROME EVENT LISTENERS ---
// These listeners monitor browser events to track user activity accurately.

/**
 * @description Fired when the active tab in a window changes. Used to save the session
 * for the previously active tab and start a new session for the newly activated tab.
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    await flushSave(); // Save time for previous tab
  } catch (e) {
    // already logged
  }

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    activeTabId = activeInfo.tabId;
    activeDomain = getDomain(tab.url);
    startTime = Date.now();
    log('Activated tab', { tabId: activeTabId, activeDomain });
  } catch (e) {
    console.error('Failed to get activated tab', e);
    activeTabId = null;
    activeDomain = null;
    startTime = null;
  }
});

/**
 * @description Fired when a tab is updated. This is crucial for single-page applications (SPAs)
 * where navigation doesn't always trigger a tab activation change.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (tabId === activeTabId && changeInfo.url) {
      void flushSave(); // Save time for previous URL
      activeDomain = getDomain(changeInfo.url);
      startTime = Date.now();
      log('Tab URL updated', { tabId, activeDomain });
    }
  } catch (e) {
    console.error('onUpdated error', e);
  }
});

/**
 * @description Fired when a tab is closed. This ensures that the session for the closed
 * tab is saved correctly.
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    if (tabId === activeTabId) {
      await flushSave();
      activeTabId = null;
      activeDomain = null;
      startTime = null;
      log('Active tab closed, reset state');
    }
  } catch (e) {
    console.error('onRemoved error', e);
  }
});

/**
 * @description Fired when the currently focused window changes. This allows the extension to
 * pause and resume tracking when the user switches away from the browser.
 */
chrome.windows.onFocusChanged.addListener((windowId) => {
  try {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      void flushSave();
      isWindowFocused = false;
      log('Window lost focus');
    } else {
      isWindowFocused = true;
      startTime = Date.now();
      log('Window gained focus');
    }
  } catch (e) {
    console.error('onFocusChanged error', e);
  }
});

// --- PERIODIC & LIFECYCLE EVENTS ---

/**
 * @description A safety net that periodically saves the current session every minute.
 * This ensures that data is not lost in case of a browser crash.
 */
setInterval(() => {
  void flushSave();
}, 60000);

/**
 * @description Saves the final session data when the extension's service worker is about to be terminated.
 */
chrome.runtime.onSuspend.addListener(() => {
  void flushSave();
});

// --- NOTIFICATIONS & ALARMS ---

/**
 * @description Schedules a daily notification to remind the user to reflect on their browsing habits.
 * The notification is scheduled for 8 PM every day.
 */
function scheduleDailyReflectionNotification() {
  const now = new Date();
  const next8PM = new Date();

  next8PM.setHours(20, 0, 0, 0); // Set to 8 PM today

  // If 8 PM today has already passed, set it for 8 PM tomorrow
  if (now.getTime() > next8PM.getTime()) {
    next8PM.setDate(next8PM.getDate() + 1);
  }

  chrome.alarms.create('screensage-reflection-notification', {
    when: next8PM.getTime(),
    periodInMinutes: 24 * 60 // 24 hours
  });
  log('Scheduled daily reflection notification for', new Date(next8PM.getTime()));
}

// --- INITIALIZATION & CONTEXT MENUS ---

/**
 * @description Sets up the extension when it is first installed or updated.
 * This includes creating context menus, migrating legacy data, and scheduling alarms.
 */
chrome.runtime.onInstalled.addListener(async () => {
  // Create context menus for text proofreading and rewriting
  chrome.contextMenus.create({
    id: "proofreadText",
    title: "Polish with ScreenSage",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "rewriteText",
    title: "Rewrite with ScreenSage",
    contexts: ["selection"]
  });
  // Setup cleanup alarm and migrate legacy data
  try {
    await migrateLegacyToUsage();
  } catch (e) {
    // already logged
  }
  chrome.alarms.create('screensage-cleanup', { periodInMinutes: 24 * 60 });
  chrome.alarms.create('screensage-save-tick', { periodInMinutes: 1 });
  scheduleDailyReflectionNotification();
});

/**
 * @description Re-schedules alarms when the browser is started.
 */
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('screensage-cleanup', { periodInMinutes: 24 * 60 });
  chrome.alarms.create('screensage-save-tick', { periodInMinutes: 1 });
  scheduleDailyReflectionNotification();
});

/**
 * @description Handles clicks on the context menu items. It uses the Chrome AI API to
 * proofread or rewrite the selected text and displays the result in an alert.
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info.selectionText || !chrome.ai) {
        return;
    }

    let resultText = '';
    let alertTitle = '';
    let errorMsg = "⚠️ Could not perform AI action.";

    try {
        if (info.menuItemId === "proofreadText") {
            alertTitle = '✅ Proofread Text';
            errorMsg = "⚠️ Couldn’t reach Proofreader API.";
            if (!chrome.ai.proofreader) throw new Error("Proofreader API not available");
            const result = await chrome.ai.proofreader.correct({ input: info.selectionText });
            resultText = result.output;

        } else if (info.menuItemId === "rewriteText") {
            alertTitle = '✍️ Rewritten Text';
            errorMsg = "⚠️ Couldn’t reach Prompt API.";
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

/**
 * @description Handles incoming alarms. This is used for periodic tasks like cleaning up old data,
 * saving session data, and triggering the daily reflection notification.
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === 'screensage-cleanup') {
    void cleanupOldData();
    return;
  }
  if (alarm && alarm.name === 'screensage-save-tick') {
    void flushSave();
    return;
  }
  if (alarm && alarm.name === 'screensage-reflection-notification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/logo.png',
      title: 'Daily Reflection',
      message: 'Time to reflect on your day with ScreenSage Lite!'
    });
    return;
  }
});