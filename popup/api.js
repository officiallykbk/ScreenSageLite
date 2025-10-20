export async function summarizePage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found');

    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            const getReadableText = () => {
                const article = document.querySelector('article');
                const main = document.querySelector('main');
                const body = document.body;
                const node = article || main || body;
                return node?.innerText?.trim()?.replace(/\s+/g, ' ').slice(0, 20000) || '';
            };
            return { text: getReadableText(), title: document.title };
        }
    });

    if (!result?.text) {
        throw new Error('Could not retrieve content from the page.');
    }

    if (!chrome.ai || !chrome.ai.summarizer) {
         // Fallback: return first few sentences if AI is not available
        return `This feature requires Chrome's built-in AI. As a fallback, here are the first few sentences of the page:\n\n"${result.text.split('. ').slice(0,3).join('. ')}"`;
    }

    const summary = await chrome.ai.summarizer.summarize({
        input: `Summarize the following content from "${result.title}" in 3 concise bullet points:\n\n${result.text}`
    });

    return summary.output;
}

import { getStoredData } from './data.js';

export async function generateDigest(usageData) {
    // Per the feature description, use the Summarizer API for the daily digest.
    if (!chrome.ai || !chrome.ai.summarizer) {
        throw new Error("Chrome AI Summarizer not available. Cannot generate digest.");
    }

    const { userGoals } = await getStoredData(['userGoals']);

    // Construct a detailed text block with browsing data and user goals for the summarizer.
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

    // Create a clear input string for the summarizer, providing context and instructions.
    const inputText = `Summarize the following browsing data into a concise, insightful summary (e.g., "Work: 3 hrs, Social: 1.5 hrs"). Be encouraging and non-judgmental. If personal goals are set, comment on the progress.\n\n---BEGIN DATA---\nTotal Time: ${(totalTime / 60000).toFixed(0)} minutes\nTop Sites:\n${domainText}${goalContext}\n---END DATA---`;

    const result = await chrome.ai.summarizer.summarize({ input: inputText });
    return result.output;
}

export async function generateNudges(usageData) {
    if (!chrome.ai || !chrome.ai.prompt) {
        throw new Error("Chrome AI Prompt API not available. Cannot generate nudges.");
    }

    const totalTime = Object.values(usageData).reduce((sum, ms) => sum + ms, 0);
    const topDomain = Object.keys(usageData).length > 0 ? Object.entries(usageData).sort((a, b) => b[1] - a[1])[0][0] : 'none';

    // The prompt is carefully crafted to be gentle, encouraging, and actionable.
    const prompt = `Based on my browsing data (Total time: ${(totalTime / 60000).toFixed(0)} mins, Top site: ${topDomain}), provide 1-2 friendly, actionable nudges for better digital wellness. Frame them as positive suggestions, not criticisms. For example: "Consider setting a timer on your top site," or "A short walk might be refreshing."`;

    const result = await chrome.ai.prompt.generate({ input: prompt });
    return result.output;
}

export async function resetData() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve();
        });
    });
}

export async function exportData() {
    const data = await new Promise(resolve => chrome.storage.local.get(null, resolve));
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
        url: url,
        filename: `ScreenSage_Export_${new Date().toISOString().split('T')[0]}.json`,
        saveAs: true
    });
}