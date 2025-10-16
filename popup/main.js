import { renderChart, updateStreakDisplay, showLoadingState, showError, hideError, updateReflection, updateQuickSummary } from './ui.js';
import { getStoredData } from './data.js';
import { summarizePage, generateDigest, resetData, exportData } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Initial UI setup
    hideError();

    // Load initial data and render UI
    const { usage, streakData } = await getStoredData(['usage', 'streakData']);
    const usageData = usage || {};

    updateQuickSummary(usageData);
    updateStreakDisplay(streakData || { current: 0, lastActive: null });

    const topDomains = Object.entries(usageData).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (topDomains.length > 0) {
        const labels = topDomains.map(([domain]) => domain);
        const values = topDomains.map(([, ms]) => (ms / 60000).toFixed(1));
        renderChart(labels, values);
    }

    // Setup event listeners
    document.getElementById('digestBtn').addEventListener('click', handleDigest);
    document.getElementById('summarizeBtn').addEventListener('click', handleSummarize);
    document.getElementById('resetBtn').addEventListener('click', handleReset);
    document.getElementById('exportBtn').addEventListener('click', handleExport);
    document.getElementById('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
});

async function handleDigest() {
    const digestBtn = document.getElementById('digestBtn');
    digestBtn.disabled = true;
    digestBtn.querySelector('span').textContent = 'Generating...';
    showLoadingState(true);
    hideError();

    try {
        const { usage } = await getStoredData(['usage']);
        if (!usage || Object.keys(usage).length === 0) {
            updateReflection('No browsing data to analyze yet.');
            return;
        }
        const digest = await generateDigest(usage);
        updateReflection(digest);
    } catch (error) {
        console.error('Digest Error:', error);
        showError(`Could not generate digest: ${error.message}`);
    } finally {
        digestBtn.disabled = false;
        digestBtn.querySelector('span').textContent = 'Get Daily Digest';
        showLoadingState(false);
    }
}

async function handleSummarize() {
    const summarizeBtn = document.getElementById('summarizeBtn');
    summarizeBtn.disabled = true;
    summarizeBtn.querySelector('span').textContent = 'Summarizing...';
    showLoadingState(true);
    hideError();

    try {
        const summary = await summarizePage();
        updateReflection(summary);
    } catch (error) {
        console.error('Summarize Error:', error);
        showError(`Summarization failed: ${error.message}`);
    } finally {
        summarizeBtn.disabled = false;
        summarizeBtn.querySelector('span').textContent = 'Summarize Page';
        showLoadingState(false);
    }
}

async function handleReset() {
    if (!confirm('Are you sure you want to reset all your browsing data? This cannot be undone.')) {
        return;
    }
    try {
        await resetData();
        // Clear UI
        updateQuickSummary({});
        renderChart([], []);
        updateStreakDisplay({ current: 0, lastActive: null });
        updateReflection('Data has been reset.');
    } catch (error) {
        console.error('Reset Error:', error);
        showError('Failed to reset data.');
    }
}

async function handleExport() {
    try {
        await exportData();
    } catch (error) {
        console.error('Export Error:', error);
        showError('Failed to export data.');
    }
}