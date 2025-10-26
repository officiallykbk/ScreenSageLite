
import { getStoredData } from './data.js';

export async function summarizePage() {
    // ... (This function remains largely the same, but we will update its AI call)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found');

    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText.slice(0, 10000)
    });

    if (!result) {
        throw new Error('Could not retrieve content from the page.');
    }

    const canCreate = await chrome.ai.canCreateSummarizer();
    if (canCreate !== 'readily') {
        throw new Error(`Summarizer not ready. Status: ${canCreate}`);
    }

    const summarizer = await chrome.ai.createSummarizer();
    const summaryResult = await summarizer.summarize({ text: result });
    return summaryResult.summary;
}


export async function generateDigest(usageData) {
    try {
        const canCreate = await chrome.ai.canCreateSummarizer();
        if (canCreate !== 'readily') {
            throw new Error(`Summarizer not ready. Status: ${canCreate}`);
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

        const summarizer = await chrome.ai.createSummarizer();
        const result = await summarizer.summarize({ text: inputText });

        return { isFallback: false, content: result.summary };

    } catch (error) {
        console.warn("AI Digest generation failed, fetching motivational quote as fallback.", error);
        // ... (fallback logic remains the same)
        try {
            const response = await fetch('https://zenquotes.io/api/random');
            const data = await response.json();
            return { isFallback: true, quote: data[0].q, author: data[0].a };
        } catch (fallbackError) {
            return { isFallback: true, quote: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" };
        }
    }
}


export async function generateNudges(usageData) {
    const canCreate = await chrome.ai.canCreateTextSession();
     if (canCreate !== 'readily') {
        throw new Error(`Text session not ready. Status: ${canCreate}`);
    }

    const totalTime = Object.values(usageData).reduce((sum, ms) => sum + ms, 0);
    const topDomain = Object.keys(usageData).length > 0 ? Object.entries(usageData).sort((a, b) => b[1] - a[1])[0][0] : 'none';

    const prompt = `Based on my browsing data (Total time: ${(totalTime / 60000).toFixed(0)} mins, Top site: ${topDomain}), provide 1-2 friendly, actionable nudges for better digital wellness. Frame them as positive suggestions, not criticisms.`;

    const session = await chrome.ai.createTextSession();
    const resultStream = session.promptStreaming(prompt);

    let fullResponse = "";
    for await (const chunk of resultStream) {
        fullResponse += chunk;
    }

    session.destroy();
    return fullResponse;
}

// ... (resetData and exportData functions remain unchanged)
export async function resetData() {
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(allData).filter(key =>
        !['userGoals', 'theme', 'streakData'].includes(key)
    );
    await chrome.storage.local.remove(keysToRemove);
}

export async function exportData() {
    const data = await chrome.storage.local.get(null);
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
        url: url,
        filename: `ScreenSage_Export_${new Date().toISOString().split('T')[0]}.json`,
        saveAs: true
    });
}
