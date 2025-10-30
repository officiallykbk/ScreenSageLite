
import { getStoredData } from './data.js';
import { getApiKey, setApiKey } from '../config.js';

// --- NEW --- Enhanced AI Availability Logging
// This function is exported to be called from main.js when the popup loads.
export async function logAiAvailability() {
    console.log("--- ScreenSage AI Diagnostic ---");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
        console.error("[AI-DIAG] ❌ No active tab found to check for AI availability.");
        console.log("--- End AI Diagnostic ---");
        return;
    }

    // Skip known-ineligible pages where executeScript or window.ai won't work
    const url = tab.url || "";
    const ineligible = /^(chrome|edge|about|devtools|chrome-extension|chrome-untrusted):/i.test(url)
        || /https?:\/\/chromewebstore\./i.test(url);
    if (ineligible) {
        console.info(`[AI-DIAG] ℹ️ Skipping AI check on ineligible page: ${url}`);
        console.log("--- End AI Diagnostic ---");
        return;
    }

    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async () => {
                if (typeof window.ai === 'undefined') {
                    return { defined: false };
                }
                const lmAvailability = await window.ai.languageModel.availability();
                const sAvailability = await window.ai.summarizer.availability();
                return {
                    defined: true,
                    lm: lmAvailability,
                    s: sAvailability
                };
            }
        });

        if (!result) {
            throw new Error("Script execution failed or returned no result.");
        }

        if (!result.defined) {
            console.warn("[AI-DIAG] ⚠️ `window.ai` is undefined in the active tab. Ensure Chrome Canary flags are enabled and test on a regular http/https page.");
        } else {
            console.log("[AI-DIAG] ✅ `window.ai` object is defined in the active tab.");
            console.log(`[AI-DIAG] 💬 Language Model availability: '${result.lm}'`);
            console.log(`[AI-DIAG] ✍️ Summarizer availability: '${result.s}'`);
        }

    } catch (e) {
        console.error(`[AI-DIAG] ❌ An error occurred while checking for AI availability in the tab:`, e.message);
        console.info("[AI-DIAG] Note: This can happen on special pages like 'chrome://' pages or the store, where content scripts are not allowed to run.");
    } finally {
        console.log("--- End AI Diagnostic ---");
    }
}


export async function summarizePage() {
    // Attempt to run summarizer in the active tab (page context) first
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found');

    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async () => {
                const text = document.body.innerText.slice(0, 20000);
                if (typeof window.ai === 'undefined') return { error: 'unavailable' };
                try {
                    const sAvail = typeof window.ai.summarizer?.availability === 'function'
                        ? await window.ai.summarizer.availability()
                        : 'unavailable';
                    if (sAvail === 'after-download') return { status: 'after-download' };
                    if (sAvail !== 'readily') return { error: `summarizer:${sAvail}` };

                    const summ = await window.ai.summarizer.create();
                    const out = await summ.summarize({ text });
                    return { summary: out?.summary || null };
                } catch (e) {
                    return { error: e?.message || String(e) };
                }
            }
        });

        if (result) {
            if (result.status === 'after-download') {
                throw new Error('Summarizer is downloading. Please try again in a moment.');
            }
            if (result.error) {
                console.log('Built-in summarizer not available on page:', result.error);
                // fall through to cloud
            } else if (result.summary) {
                return result.summary;
            }
        }
    } catch (err) {
        console.warn('Error while attempting built-in summarizer in page context:', err.message || err);
        // fall through to cloud fallback
    }

    // Cloud fallback
    console.log("☁️ Using Gemini Flash 2.5 (cloud fallback)");
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error("No Gemini API key found. Please set your API key in the extension options.");
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    const pageText = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.body.innerText.slice(0, 20000) })
        .then(res => res[0]?.result || '')
        .catch(() => '');

    const prompt = `Summarize this text in 2-3 concise sentences, focusing on the main points:\n\n${pageText}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cloud summarization failed (${response.status}): ${error}`);
    }

    const data = await response.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!summary) {
        console.warn("Cloud API failed to generate summary, falling back to quote");
        const fallback = await fetchFallbackQuote();
        return `Unable to summarize page content. Here's a thought for reflection:\n\n"${fallback.quote}" — ${fallback.author}`;
    }

    return summary;
}



async function fetchFallbackQuote() {
    try {
        // Using a more reliable quote API
        const response = await fetch('https://api.quotable.io/random');
        const data = await response.json();
        return { isFallback: true, quote: data.content, author: data.author };
    } catch (fallbackError) {
        return { isFallback: true, quote: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" };
    }
}

export async function generateNudges(usageData) {
    // Try to run in page context (languageModel) first
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            const totalTime = Object.values(usageData).reduce((sum, ms) => sum + ms, 0);
            const topDomain = Object.keys(usageData).length > 0 ? Object.entries(usageData).sort((a, b) => b[1] - a[1])[0][0] : 'none';
            const prompt = `Based on my browsing data (Total time: ${(totalTime / 60000).toFixed(0)} mins, Top site: ${topDomain}), provide 1-2 friendly, actionable nudges for better digital wellness. Frame them as positive suggestions, not criticisms. Keep the response under 280 characters.`;

            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async (p) => {
                    if (typeof window.ai === 'undefined') return { error: 'unavailable' };
                    try {
                        const avail = typeof window.ai.languageModel?.availability === 'function'
                            ? await window.ai.languageModel.availability()
                            : 'unavailable';
                        if (avail !== 'readily') return { error: `languageModel:${avail}` };
                        const model = await window.ai.languageModel.create();
                        const out = await model.prompt(p);
                        return { text: out };
                    } catch (e) { return { error: e?.message || String(e) } }
                },
                args: [prompt]
            });

            if (result && result.text) return result.text;
        }
    } catch (err) {
        console.warn('Built-in nudges failed in page context:', err);
    }

    // Cloud fallback
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error("No API key available for cloud fallback");
        }

        const totalTime = Object.values(usageData).reduce((sum, ms) => sum + ms, 0);
        const topDomain = Object.keys(usageData).length > 0 ? Object.entries(usageData).sort((a, b) => b[1] - a[1])[0][0] : 'none';
        
        const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
        const prompt = `Based on browsing data (${(totalTime / 60000).toFixed(0)} mins, mainly on ${topDomain}), give one short, friendly productivity tip.`;

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
            throw new Error(`Cloud API failed: ${response.status}`);
        }

        const data = await response.json();
        const nudge = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (nudge) return nudge;
        throw new Error("Empty response from cloud API");

    } catch (err) {
        console.warn("Cloud nudges failed, using quote fallback:", err);
        // Final fallback - use an inspirational quote
        const fallback = await fetchFallbackQuote();
        return `"${fallback.quote}" — ${fallback.author}`;
    }
}

// Data management functions remain unchanged
export async function resetData() {
    try {
        // Preserve only the Gemini API key and wipe everything else
        const apiKey = await getApiKey();
        await chrome.storage.local.clear();
        if (apiKey) {
            await setApiKey(apiKey);
        }
    } catch (error) {
        console.error("Error resetting data:", error);
        throw new Error("Failed to reset user data.");
    }
}


export async function exportData() {
     try {
        const data = await chrome.storage.local.get(null);
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
            url: url,
            filename: `ScreenSage_Export_${new Date().toISOString().split('T')[0]}.json`,
            saveAs: true
        });
    } catch (error) {
        console.error("Error exporting data:", error);
        throw new Error("Failed to export user data.");
    }
}

// --- NEW --- Function for the in-popup proofreader
export async function proofreadText(text) {
    // Try running proofread in page context (languageModel) first
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            const prompt = `Proofread and correct the following text for grammar, spelling, and punctuation errors. Only return the corrected text, without any introductory phrases:\n\n"${text}"`;
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async (p) => {
                    if (typeof window.ai === 'undefined') return { error: 'unavailable' };
                    try {
                        const avail = typeof window.ai.languageModel?.availability === 'function'
                            ? await window.ai.languageModel.availability()
                            : 'unavailable';
                        if (avail !== 'readily') return { error: `languageModel:${avail}` };
                        const model = await window.ai.languageModel.create();
                        const out = await model.prompt(p);
                        return { text: out };
                    } catch (e) { return { error: e?.message || String(e) } }
                },
                args: [prompt]
            });

            if (result && result.text) return result.text;
        }
    } catch (err) {
        console.warn('Built-in proofreading failed in page context:', err);
    }

    // Cloud fallback
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error("No API key available for cloud fallback");
        }

        const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
        const prompt = `Proofread and correct this text for grammar, spelling, and punctuation. Return only the corrected text:\n\n${text}`;

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
            throw new Error(`Cloud API failed: ${response.status}`);
        }

        const data = await response.json();
        const corrected = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (corrected) return corrected;
        throw new Error("Empty response from cloud API");

    } catch (err) {
        console.warn("Cloud proofreading failed, using quote fallback:", err);
        // Final fallback - return original text with a quote
        const fallback = await fetchFallbackQuote();
        return `${text}\n\nNote: Proofreading unavailable. Here's a thought instead:\n"${fallback.quote}" — ${fallback.author}`;
    }
}
