
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
    if (!window.ai) {
        throw new Error('Built-in AI not available. Please check your Chrome version and flags.');
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


export async function generateDigest(usageData) {
    if (!window.ai) {
        console.warn("Built-in AI not available. Using fallback.");
        return fetchFallbackQuote();
    }

    try {
        const availability = await window.ai.summarizer.availability();
        if (availability !== 'readily') {
            throw new Error(`Summarizer not ready. Status: ${availability}`);
        }

        const { userGoals } = await getStoredData(['userGoals']);
        let goalContext = '';
        if (userGoals) {
            goalContext += "\nMy personal goals are:\n";
            if (userGoals.socialLimit) goalContext += `- Limit social media to ${userGoals.socialLimit} minutes.\n`;
            if (userGoals.videoLimit) goalContext += `- Limit video to ${userGoals.videoLimit} minutes.\n`;
            if (userGoals.workMinimum) goalContext += `- Spend at least ${userGoals.workMinimum} minutes on productivity.\n`;
        }

        const totalTime = Object.values(usageData).reduce((sum, ms) => sum + ms, 0);
        const domainText = Object.entries(usageData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([domain, ms]) => `${domain}: ${(ms / 60000).toFixed(0)} min`)
            .join('\n');

        const inputText = `Summarize the following browsing data into a concise, insightful summary. Be encouraging and non-judgmental. If personal goals are set, comment on the progress.\n\n---BEGIN DATA---\nTotal Time: ${(totalTime / 60000).toFixed(0)} minutes\nTop Sites:\n${domainText}${goalContext}\n---END DATA---`;

        const summarizer = await window.ai.summarizer.create();
        const result = await summarizer.summarize({ text: inputText });
        return { isFallback: false, content: result.summary };

    } catch (error) {
        console.warn("AI Digest generation failed, fetching motivational quote as fallback.", error);
        return fetchFallbackQuote();
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

export async function generateNudges(usageData) {
     if (!window.ai) {
        console.warn("Built-in AI not available for nudges.");
        return "Take a short break to stretch and rest your eyes!";
    }
    try {
        const availability = await window.ai.languageModel.availability();
        if (availability !== 'readily') {
            throw new Error(`Language model not ready. Status: ${availability}`);
        }

        const totalTime = Object.values(usageData).reduce((sum, ms) => sum + ms, 0);
        const topDomain = Object.keys(usageData).length > 0 ? Object.entries(usageData).sort((a, b) => b[1] - a[1])[0][0] : 'none';

        const prompt = `Based on my browsing data (Total time: ${(totalTime / 60000).toFixed(0)} mins, Top site: ${topDomain}), provide 1-2 friendly, actionable nudges for better digital wellness. Frame them as positive suggestions, not criticisms. Keep the response under 280 characters.`;

        const model = await window.ai.languageModel.create();
        const fullResponse = await model.prompt(prompt);

        return fullResponse;
    } catch (err) {
        console.error("Nudge Generation Error:", err);
        return "Consider taking a mindful moment away from the screen.";
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
