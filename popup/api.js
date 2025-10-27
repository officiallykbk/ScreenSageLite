
import { getStoredData } from './data.js';

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
    // --- MODIFIED --- This check now gives more specific advice.
    if (typeof window.ai === 'undefined') {
        throw new Error('Built-in AI is not available. Ensure you are using Chrome Canary 127+ and have enabled the required flags.');
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found');

    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText.slice(0, 20000)
    });

    if (!result) {
        throw new Error('Could not retrieve content from the page.');
    }

    try {
        const availability = await window.ai.summarizer.availability();
        if (availability !== 'readily') {
            throw new Error(`Summarizer not ready. Status: ${availability}`);
        }
        const summarizer = await window.ai.summarizer.create();
        const summaryResult = await summarizer.summarize({ text: result });
        return summaryResult.summary;
    } catch (err) {
        console.error("Summarization Error:", err);
        throw new Error(`AI Summarization failed: ${err.message}`);
    }
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
    if (typeof window.ai === 'undefined') {
        throw new Error('Built-in AI is not available. Please check your Chrome settings.');
    }

    try {
        const availability = await window.ai.languageModel.availability();
        if (availability !== 'readily') {
            throw new Error(`Language model not ready. Status: ${availability}`);
        }
        const model = await window.ai.languageModel.create();
        const prompt = `Proofread and correct the following text for grammar, spelling, and punctuation errors. Only return the corrected text, without any introductory phrases:\n\n"${text}"`;
        const resultText = await model.prompt(prompt);
        return resultText;
    } catch (err) {
        console.error("Proofreading Error:", err);
        throw new Error(`AI proofreading failed: ${err.message}`);
    }
}
