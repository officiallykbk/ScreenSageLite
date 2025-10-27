/**
 * @file main.js
 * @description This is the main entry point for the popup UI. It orchestrates the loading of data,
 * rendering of the UI, and handling of user interactions. It ties together modules for UI, data,
 * API calls, and goal management.
 */

import { renderChart, updateStreakDisplay, showLoadingState, showError, hideError, updateDigest, updateQuickSummary, renderGoals, addButtonRippleEffect, loadOwlMascot, addCardParallaxEffect, initTheme, updateNudges, showConfirmationModal } from './ui.js';
import { getStoredData } from './data.js';
// --- MODIFIED --- Import the new AI logging function
import { summarizePage, generateDigest, resetData, exportData, generateNudges, logAiAvailability, proofreadText } from './api.js';
import { checkGoals } from './goals.js';

/**
 * @description Main function that runs when the popup DOM is fully loaded.
 * It initializes the UI, fetches initial data, renders the chart and other components,
 * and sets up all necessary event listeners for user actions.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. INITIAL UI SETUP & DIAGNOSTICS ---
    logAiAvailability(); // Run the AI diagnostic check on popup open.
    hideError();
    loadOwlMascot();
    initTheme();

    // --- 2. LOAD INITIAL DATA & RENDER ---
    // --- MODIFIED --- Request real-time data from the background script
    // instead of just reading from storage. This gives an up-to-the-second view.
    try {
        const usageData = await chrome.runtime.sendMessage({ type: 'GET_USAGE_DATA' });
        const { streakData } = await getStoredData(['streakData']); // Streak data is still fine from storage

        updateQuickSummary(usageData || {});
        updateStreakDisplay(streakData || { current: 0, lastActive: null });

        const topDomains = Object.entries(usageData).sort((a, b) => b[1] - a[1]).slice(0, 10);
        if (topDomains.length > 0) {
            const labels = topDomains.map(([domain]) => domain);
            const values = topDomains.map(([, ms]) => (ms / 60000).toFixed(1));
            renderChart(labels, values);
        }

    } catch (error) {
        console.error("Initialization Error:", error);
        showError("Could not load initial data.");
    }

    // --- 3. CHECK & RENDER GOALS ---
    // Evaluate user-defined goals against the browsing data and render their status.
    // A confetti effect is triggered if any goals have been achieved.
    const goalResults = await checkGoals();
    if (goalResults && goalResults.some(goal => goal.achieved)) {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
    renderGoals(goalResults);

    // --- 4. SETUP EVENT LISTENERS ---
    // Attach listeners to all interactive elements in the popup, such as buttons and cards.
    addButtonRippleEffect();
    addCardParallaxEffect();
    document.getElementById('digestBtn').addEventListener('click', handleDigest);
    document.getElementById('summarizeBtn').addEventListener('click', handleSummarize);
    document.getElementById('resetBtn').addEventListener('click', handleReset);
    document.getElementById('exportBtn').addEventListener('click', handleExport);
    document.getElementById('proofreadBtn').addEventListener('click', handleProofread);
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
    digestBtn.querySelector('span').textContent = 'Generating...';
    showLoadingState(true);
    hideError();

    try {
        const { usage } = await getStoredData(['usage']);
        if (!usage || Object.keys(usage).length === 0) {
            // Even with no data, we can show a motivational quote as a fallback.
            const digest = await generateDigest(usage);
            updateDigest(digest);
            return;
        }
        // Generate both the digest and nudges in parallel for a faster response.
        const [digest, nudges] = await Promise.all([
            generateDigest(usage),
            generateNudges(usage)
        ]);

        updateDigest(digest);
        updateNudges(nudges);

    } catch (error) {
        console.error('Digest Error:', error);
        showError(`Could not generate digest: ${error.message}`);
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