/**
 * Track active tab and domain information
 */
let activeTabId = null;
let activeDomain = null;
let startTime = null;
let isWindowFocused = true;
let debounceTimer = null;

const DEBUG = true; // Set to false to disable verbose logging
const DEBOUNCE_MS = 1500;
const MAX_SESSION_MS = 24 * 60 * 60 * 1000;
const CLEANUP_DAYS = 30; // remove entries not seen in this many days

function log(...args) {
  if (DEBUG) console.log('[ScreenSage]', ...args);
}

/**
 * Extract domain from a URL
 * @param {string} url - The URL to extract domain from
 * @returns {string|null} - The domain name or null if invalid URL
 */
function isTrackableUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    const scheme = u.protocol;
    if (scheme === 'chrome:' || scheme === 'chrome-extension:' || scheme === 'moz-extension:' || scheme === 'edge:') return false;
    if (scheme === 'file:') return false;
    if (scheme === 'about:') return false;
    return u.hostname && u.hostname.includes('.') && !u.hostname.endsWith('.local');
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

/**
 * Save the current session time
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

function scheduleSaveCurrentSession() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void saveCurrentSession();
  }, DEBOUNCE_MS);
}

function flushSave() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  return saveCurrentSession();
}

/**
 * Save domain usage statistics to storage
 * @param {string} domain - The domain name
 * @param {number} duration - Time spent on the domain in milliseconds
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

// Track tab activation
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

// Track URL changes within tabs
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

// Track window focus
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

// Save data periodically (every minute) as a safety net
setInterval(() => {
  void flushSave();
}, 60000);

// Save data when extension is about to be unloaded
chrome.runtime.onSuspend.addListener(() => {
  void flushSave();
});

// Create context menu on install
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "proofreadText",
    title: "Polish with ScreenSage",
    contexts: ["selection"]
  });
  // Setup cleanup alarm and migrate legacy data
  try {
    await migrateLegacyToUsage();
  } catch (e) {
    // already logged
  }
  chrome.alarms.create('screensage-cleanup', { periodInMinutes: 24 * 60 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('screensage-cleanup', { periodInMinutes: 24 * 60 });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "proofreadText" && info.selectionText) {
    try {
      const result = await chrome.ai.proofreader.correct({
        input: info.selectionText
      });

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text) => {
          alert("✅ Proofread Text:\n\n" + text);
        },
        args: [result.output]
      });
    } catch (err) {
      console.error("Proofreader API error:", err);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          alert("⚠️ Couldn’t reach Proofreader API.");
        }
      });
    }
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === 'screensage-cleanup') {
    void cleanupOldData();
  }
});