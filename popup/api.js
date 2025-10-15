export async function summarizePage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found');

    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
            text: document.body.innerText.trim().slice(0, 15000),
            title: document.title
        })
    });

    if (!result?.text) {
        throw new Error('Could not retrieve content from the page.');
    }

    if (!chrome.ai || !chrome.ai.summarizer) {
         // Fallback: return first few sentences if AI is not available
        return `This feature requires Chrome's built-in AI. As a fallback, here are the first few sentences of the page:\n\n"${result.text.split('. ').slice(0,3).join('. ')}"`;
    }

    const summary = await chrome.ai.summarizer.summarize({
        input: `Summarize the following content from "${result.title}":\n\n${result.text}`
    });

    return summary.output;
}

export async function generateDigest(usageData) {
    if (!chrome.ai || !chrome.ai.prompt) {
        throw new Error("Chrome AI not available. Cannot generate digest.");
    }

    const totalTime = Object.values(usageData).reduce((sum, ms) => sum + ms, 0);
    const domainText = Object.entries(usageData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([domain, ms]) => `${domain}: ${(ms / 60000).toFixed(0)} min`)
        .join('\n');

    const prompt = `Analyze my browsing data and provide a short, insightful summary (2-3 sentences) and one actionable tip for digital wellness. Be encouraging and non-judgmental. Data:\nTotal Time: ${(totalTime / 60000).toFixed(0)} minutes\nTop Sites:\n${domainText}`;

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