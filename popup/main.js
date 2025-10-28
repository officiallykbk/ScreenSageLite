/**
 * @file main.js
 * @description This is the main entry point for the popup UI. It orchestrates the loading of data,
 * rendering of the UI, and handling of user interactions. It ties together modules for UI, data,
 * API calls, and goal management.
 */

import { renderChart, updateStreakDisplay, showLoadingState, showError, hideError, updateDigest, updateQuickSummary, renderGoals, addButtonRippleEffect, loadOwlMascot, addCardParallaxEffect, initTheme, updateNudges, showConfirmationModal } from './ui.js';
import { getStoredData } from './data.js';
// --- MODIFIED --- Import the new AI logging function
import { summarizePage, resetData, exportData, generateNudges, logAiAvailability, proofreadText } from './api.js';
import { checkGoals } from './goals.js';
import { generateReflection } from '../aiHandler.js';

/**
 * @description Main function that runs when the popup DOM is fully loaded.
 * It initializes the UI, fetches initial data, renders the chart and other components,
 * and sets up all necessary event listeners for user actions.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. INITIAL UI SETUP ---
    // These are critical for the UI to be interactive and should run first,
    // outside of any data-loading logic that might fail.
    hideError();
    loadOwlMascot();
    initTheme();
    addButtonRippleEffect();
    addCardParallaxEffect();

    // --- 2. SETUP EVENT LISTENERS ---
    // Wire up the buttons before loading data, so the UI is responsive.
    document.getElementById('digestBtn').addEventListener('click', handleDigest);
    document.getElementById('summarizeBtn').addEventListener('click', handleSummarize);
    document.getElementById('resetBtn').addEventListener('click', handleReset);
    document.getElementById('exportBtn').addEventListener('click', handleExport);
    document.getElementById('proofreadBtn').addEventListener('click', handleProofread);

    // --- 3. LOAD DATA & RENDER DYNAMIC CONTENT ---
    // This is now wrapped in a try...catch to prevent a data-loading failure
    // from breaking the entire UI.
    try {
        logAiAvailability(); // Run the AI diagnostic check.

        // Request real-time data from the background script.
        const usageData = await chrome.runtime.sendMessage({ type: 'GET_USAGE_DATA' });
        const { streakData } = await getStoredData(['streakData']);

        updateQuickSummary(usageData || {});
        updateStreakDisplay(streakData || { current: 0, lastActive: null });

        // Render the main chart
        const topDomains = Object.entries(usageData || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
        if (topDomains.length > 0) {
            const labels = topDomains.map(([domain]) => domain);
            const values = topDomains.map(([, ms]) => (ms / 60000).toFixed(1));
            renderChart(labels, values);
        }

        // Check and render goals, with a celebratory confetti effect on success.
        const goalResults = await checkGoals();
        if (goalResults && goalResults.some(goal => goal.achieved)) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        renderGoals(goalResults);

    } catch (error) {
        console.error("Popup Initialization Error:", error);
        showError("Could not load dashboard data.");
    }
});

async function handleProofread() {
    const proofreadBtn = document.getElementById('proofreadBtn');
    const inputArea = document.getElementById('proofread-input');
    const outputContainer = document.getElementById('proofread-output');
    const text = inputArea.value;

    if (!text.trim()) {
        showError("Please enter some text to proofread.");
        return;
    }

    proofreadBtn.disabled = true;
    proofreadBtn.querySelector('span').textContent = 'Thinking...';
    hideError();
    outputContainer.style.display = 'none';

    try {
        // This function will be created in api.js next.
        const correctedText = await proofreadText(text);
        outputContainer.textContent = correctedText;
        outputContainer.style.display = 'block';
    } catch (error) {
        console.error('Proofread Error:', error);
        showError(`Proofreading failed: ${error.message}`);
    } finally {
        proofreadBtn.disabled = false;
        proofreadBtn.querySelector('span').textContent = 'Proofread';
    }
}

// --- ACTION HANDLERS ---

/**
 * @description Handles the 'Get Daily Digest' button click. It fetches browsing data,
 * requests a digest from the API, and displays it in the reflection area.
 */
async function handleDigest() {
    const digestBtn = document.getElementById('digestBtn');
    digestBtn.disabled = true;
    digestBtn.querySelector('span').textContent = 'Analyzing...';
    showLoadingState(true);
    hideError();

    try {
        const { usage } = await getStoredData(['usage']);
        if (!usage || Object.keys(usage).length === 0) {
            showError("No browsing data to analyze yet.");
            return;
        }

        const domains = Object.entries(usage)
            .map(([domain, ms]) => `${domain}: ${(ms / 60000).toFixed(1)} min`)
            .join('\n');

        const { summary, tip } = await generateReflection(domains);

        // Use the existing UI update functions
        updateDigest({ isFallback: false, content: summary });
        updateNudges(tip);

    } catch (error) {
        console.error('Reflection Error:', error);
        showError(`Could not generate reflection: ${error.message}`);
    } finally {
        digestBtn.disabled = false;
        digestBtn.querySelector('span').textContent = 'Get Daily Digest';
    }
}

/**
 * @description Handles the 'Summarize Page' button click. It calls the API to summarize the
 * content of the current page and displays the summary in the reflection area.
 */
async function handleSummarize() {
    const summarizeBtn = document.getElementById('summarizeBtn');
    summarizeBtn.disabled = true;
    summarizeBtn.querySelector('span').textContent = 'Summarizing...';
    showLoadingState(true);
    hideError();

    try {
        const summary = await summarizePage();
        // We wrap the summary text in the digest object structure for the UI function.
        updateDigest({ isFallback: false, content: summary });
    } catch (error) {
        console.error('Summarize Error:', error);
        showError(`Summarization failed: ${error.message}`);
    } finally {
        summarizeBtn.disabled = false;
        summarizeBtn.querySelector('span').textContent = 'Summarize Page';
    }
}

/**
 * @description Handles the 'Reset Data' button click. It displays a custom confirmation modal
 * before calling the API to clear all stored browsing data and resetting the UI.
 */
function handleReset() {
    showConfirmationModal(
        'Reset All Data?',
        'This will permanently delete all your browsing history. This action cannot be undone.',
        async () => {
            try {
                await resetData();
                // Clear UI
                updateQuickSummary({});
                renderChart([], []);
                updateStreakDisplay({ current: 0, lastActive: null });
                updateDigest({ isFallback: false, content: 'Your data has been successfully reset.' });
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 }
                });
            } catch (error) {
                console.error('Reset Error:', error);
                showError('Failed to reset data.');
            }
        }
    );
}

/**
 * @description Handles the 'Export Data' button click. It calls the API to export
 * the user's browsing data to a downloadable file.
 */
async function handleExport() {
    try {
        await exportData();
    } catch (error) {
        console.error('Export Error:', error);
        showError('Failed to export data.');
    }
}