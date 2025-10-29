
import { getStoredData } from './data.js';
import { getApiKey } from '../config.js';

// --- NEW --- Enhanced AI Availability Logging
// This function is exported to be called from main.js when the popup loads.
export async function logAiAvailability() {
    console.log("--- ScreenSage AI Diagnostic ---");
    if (typeof window.ai === 'undefined') {
        console.error("[AI-DIAG] ❌ `window.ai` object is not defined. The Built-in AI API is not available.");
        return;
    }
    console.log("[AI-DIAG] ✅ `window.ai` object is defined.");

    try {
        const lmAvailability = await window.ai.languageModel.availability();
        console.log(`[AI-DIAG] 💬 Language Model availability: '${lmAvailability}'`);
    } catch (e) {
        console.error("[AI-DIAG] ❌ Error checking Language Model availability:", e.message);
    }

    try {
        const sAvailability = await window.ai.summarizer.availability();
        console.log(`[AI-DIAG] ✍️ Summarizer availability: '${sAvailability}'`);
    } catch (e) {
        console.error("[AI-DIAG] ❌ Error checking Summarizer availability:", e.message);
    }
    console.log("--- End AI Diagnostic ---");
}


export async function summarizePage() {
    // Get page content first - we'll need this regardless of which AI we use
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found');

    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText.slice(0, 20000)
    });

    if (!result) {
        throw new Error('Could not retrieve content from the page.');
    }

    // Try built-in AI first
    if (typeof window.ai !== 'undefined') {
        try {
            const availability = await window.ai.summarizer.availability();
            if (availability === 'readily') {
                const summarizer = await window.ai.summarizer.create();
                const summaryResult = await summarizer.summarize({ text: result });
                return summaryResult.summary;
            } else if (availability === 'after-download') {
                throw new Error('Summarizer is downloading. Please try again in a moment.');
            }
            // If not readily/downloading, fall through to cloud fallback
        } catch (err) {
            console.log("Built-in summarizer not available, trying cloud fallback...");
            // Fall through to cloud fallback
        }
    }

    // Cloud Fallback using Gemini API
    console.log("☁️ Using Gemini Flash 2.5 (cloud fallback)");
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error("No Gemini API key found. Please set your API key in the extension options.");
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    const prompt = `Summarize this text in 2-3 concise sentences, focusing on the main points:\n\n${result}`;

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
    // Try built-in AI first
    if (typeof window.ai !== 'undefined') {
        try {
            const availability = await window.ai.languageModel.availability();
            if (availability === 'readily') {
                const totalTime = Object.values(usageData).reduce((sum, ms) => sum + ms, 0);
                const topDomain = Object.keys(usageData).length > 0 ? Object.entries(usageData).sort((a, b) => b[1] - a[1])[0][0] : 'none';

                const prompt = `Based on my browsing data (Total time: ${(totalTime / 60000).toFixed(0)} mins, Top site: ${topDomain}), provide 1-2 friendly, actionable nudges for better digital wellness. Frame them as positive suggestions, not criticisms. Keep the response under 280 characters.`;

                const model = await window.ai.languageModel.create();
                const fullResponse = await model.prompt(prompt);
                return fullResponse;
            }
        } catch (err) {
            console.warn("Built-in AI nudges failed, trying cloud fallback:", err);
        }
    }

    // Try cloud API fallback
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
        const allData = await chrome.storage.local.get(null);
        // We preserve goals, theme, and streak data on reset.
        const keysToKeep = ['userGoals', 'theme', 'streakData'];
        const keysToRemove = Object.keys(allData).filter(key => !keysToKeep.includes(key));

        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
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
    // Try built-in AI first
    if (typeof window.ai !== 'undefined') {
        try {
            const availability = await window.ai.languageModel.availability();
            if (availability === 'readily') {
                const model = await window.ai.languageModel.create();
                const prompt = `Proofread and correct the following text for grammar, spelling, and punctuation errors. Only return the corrected text, without any introductory phrases:\n\n"${text}"`;
                const resultText = await model.prompt(prompt);
                return resultText;
            }
        } catch (err) {
            console.warn("Built-in AI proofreading failed, trying cloud fallback:", err);
        }
    }

    // Try cloud API fallback
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
