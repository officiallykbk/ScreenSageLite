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

    // Accept shorter visits (>= 500ms) to improve accuracy for quick interactions
    if (duration >= 500 && duration < MAX_SESSION_MS) {
        const previousTime = usageCache[sessionToEnd.domain] || 0;
        usageCache[sessionToEnd.domain] = previousTime + duration;
        log(`END_SESSION: ✅ Committed. Domain: ${sessionToEnd.domain}, Duration: ${(duration/1000).toFixed(1)}s, New Total: ${(usageCache[sessionToEnd.domain]/60000).toFixed(1)}m`);
    } else {
        log(`END_SESSION: 👻 Discarded. Duration ${duration}ms was too short or too long.`);
    }
}

async function startSession(tab) {
    const domain = getDomain(tab?.url);
    if (!domain) {
        log(`START_SESSION: 🚫 Cannot start session for untrackable URL: ${tab?.url}`);
        return;
    }

    // If we're already tracking this exact tab/domain, do nothing to avoid restarting and losing time
    if (currentSession && currentSession.tabId === tab.id && currentSession.domain === domain) {
        // Already tracking this tab — keep the existing session
        log(`START_SESSION: ℹ️ Already tracking domain: ${domain} on tab ${tab.id}`);
        return;
    }

    // End any previous session before starting a new one
    await endSession();

    log(`START_SESSION: 🚀 Starting new session for domain: ${domain} on tab ${tab.id}`);
    currentSession = {
        domain: domain,
        startTime: Date.now(),
        tabId: tab.id,
    };
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
    // When the active tab's URL changes, restart tracking for that tab.
    if (tab.active && changeInfo.url) {
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
        try {
            // Try to get the active tab for the focused window directly
            const tabs = await chrome.tabs.query({ active: true, windowId });
            const tab = tabs && tabs[0];
            if (tab) {
                await startSession(tab);
                return;
            }
        } catch (e) {
            log('Could not query tabs by windowId, falling back to getCurrentTab', e);
        }

        // Fallback: use the last focused window's active tab
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

async function processWithBuiltInAI(tab, prompt) {
    try {
        // Execute in the context of the tab to access window.ai
        const [{result: aiResult}] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async (promptText) => {
                if (typeof window.ai === 'undefined') return { error: 'Built-in AI not available' };
                
                try {
                    const availability = await window.ai.languageModel.availability();
                    if (availability !== 'readily') {
                        return { error: `Language model not ready. Status: ${availability}` };
                    }
                    
                    const model = await window.ai.languageModel.create();
                        const response = await model.prompt(promptText);
                        // return the raw response so the extension can normalize different result shapes
                        return { raw: response };
                } catch (err) {
                        return { error: err.message };
                }
            },
            args: [prompt]
        });

        if (aiResult.error) throw new Error(aiResult.error);

        // Normalize various possible response shapes from model.prompt
        const raw = aiResult.raw;
        let text = '';
        if (!raw) text = '';
        else if (typeof raw === 'string') text = raw;
        else if (typeof raw === 'object') {
            // Common shapes: { text: '...' } or { candidates: [...] } or nested content
            if (typeof raw.text === 'string') text = raw.text;
            else if (raw?.candidates?.[0]?.content?.parts?.[0]?.text) text = raw.candidates[0].content.parts[0].text;
            else if (raw?.output?.[0]?.content?.[0]?.text) text = raw.output[0].content[0].text;
            else text = JSON.stringify(raw);
        }

        return { text: text, isCloud: false };
    } catch (err) {
        throw err;
    }
}

async function processWithCloudAI(prompt) {
    const { apiKey } = await chrome.storage.sync.get('apiKey');
    if (!apiKey) {
        throw new Error('No API key available for cloud processing');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`Cloud API failed (${response.status})`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from cloud API');
    
    return { text, isCloud: true };
}

async function getFallbackQuote() {
    try {
        const response = await fetch('https://api.quotable.io/random');
        const data = await response.json();
        return `Here's a thought for reflection:\n\n"${data.content}"\n— ${data.author}`;
    } catch {
        return 'Here\'s a thought for reflection:\n\n"The journey of a thousand miles begins with a single step."\n— Lao Tzu';
    }
}

// --- Message listeners for popup and content script requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_USAGE_DATA') {
        (async () => {
            await loadUsageCache();
            const dataWithCurrentSession = { ...usageCache };
            if (currentSession) {
                const duration = Date.now() - currentSession.startTime;
                dataWithCurrentSession[currentSession.domain] = (dataWithCurrentSession[currentSession.domain] || 0) + duration;
            }
            log('Popup requested data. Sending real-time usage cache.');
            sendResponse(dataWithCurrentSession);
        })();
        return true;
    }

    if (request.type === 'PROCESS_TEXT') {
        (async () => {
            try {
                let prompt;
                if (request.menuItemId === "proofreadText") {
                    prompt = `Proofread and correct the following text for grammar and spelling errors. Only return the corrected text, without any introductory phrases:\n\n"${request.selectionText}"`;
                } else if (request.menuItemId === "rewriteText") {
                    prompt = `Rewrite the following text to be clearer and more concise, while retaining the original meaning. Only return the rewritten text, without any introductory phrases:\n\n"${request.selectionText}"`;
                }

                // Try built-in AI first
                try {
                    const result = await processWithBuiltInAI(sender.tab, prompt);
                    sendResponse(result);
                    return;
                } catch (err) {
                    console.warn('Built-in AI failed, trying cloud:', err);
                }

                // Try cloud API
                try {
                    const result = await processWithCloudAI(prompt);
                    sendResponse(result);
                    return;
                } catch (err) {
                    console.warn('Cloud AI failed, using fallback:', err);
                }

                // Final fallback
                const fallbackText = await getFallbackQuote();
                sendResponse({ text: fallbackText, isCloud: false });

            } catch (error) {
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }
});

// --- NEW --- Listener for when the service worker is about to be terminated.
// This is a crucial part of the Manifest V3 lifecycle.
chrome.runtime.onSuspend.addListener(async () => {
    log('EVENT: runtime.onSuspend - Service worker is suspending.');
    await endSession();
    await commitUsageCache();
});
