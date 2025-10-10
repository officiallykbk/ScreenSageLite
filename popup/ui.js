import { getUsageData, clearAllData, exportAllData } from './utils/storage.js';
import { renderChart, destroyChart } from './utils/chart.js';

const outputDiv = document.getElementById("output");
const showChartBtn = document.getElementById('showChartBtn');
const chartContainer = document.querySelector('.chart-container');

/**
 * Updates the content of the output div.
 * @param {string} text The text to display.
 */
function setOutputText(text) {
    if (outputDiv) {
        outputDiv.innerText = text;
    }
}

/**
 * Loads and displays the initial summary of browsing data.
 */
export async function loadInitialData() {
    try {
        const usageData = await getUsageData();
        const domains = Object.entries(usageData);

        chartContainer.classList.add('hidden');

        if (domains.length === 0) {
            setOutputText("No browsing data collected yet.\nStart browsing to see your habits!");
        } else {
            const topDomains = domains
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([domain, ms]) => `${domain}: ${(ms / 60000).toFixed(1)} min`)
                .join("\n");
            setOutputText(`Recent activity:\n${topDomains}`);
        }
    } catch (error) {
        console.error('Storage error:', error);
        setOutputText("❌ Error loading data");
    }
}

/**
 * Toggles the visibility of the usage chart.
 */
async function toggleUsageChart() {
    if (!chartContainer) return;

    const isHidden = chartContainer.classList.contains('hidden');

    if (isHidden) {
        try {
            const usageData = await getUsageData();
            const domains = Object.entries(usageData);

            if (domains.length === 0) return;

            domains.sort((a, b) => b[1] - a[1]);
            const topDomains = domains.slice(0, 10);
            const labels = topDomains.map(([domain]) => domain);
            const values = topDomains.map(([_, ms]) => (ms / 60000).toFixed(1));

            chartContainer.classList.remove('hidden');
            renderChart(labels, values);
            showChartBtn.textContent = '🙈 Hide Chart';
        } catch (error) {
            console.error("Error showing chart:", error);
            setOutputText("❌ Could not display chart.");
        }
    } else {
        chartContainer.classList.add('hidden');
        showChartBtn.textContent = '📊 Show Chart';
    }
}

/**
 * Handles the logic for resetting all user data.
 */
async function handleResetData() {
    if (!confirm("Are you sure you want to clear all your browsing data? This cannot be undone.")) {
        return;
    }

    const resetBtn = document.getElementById("resetBtn");
    const originalText = resetBtn.textContent;

    resetBtn.textContent = "🔄 Clearing...";
    resetBtn.disabled = true;

    try {
        await clearAllData();
        setOutputText("✅ All data cleared! Starting fresh...");
        destroyChart();
        chartContainer.classList.add('hidden');
        showChartBtn.textContent = '📊 Show Chart';
    } catch (error) {
        setOutputText("❌ Error clearing data");
    } finally {
        setTimeout(() => {
            resetBtn.textContent = originalText;
            resetBtn.disabled = false;
        }, 1000);
    }
}

/**
 * Handles the logic for exporting user data.
 */
async function handleExportData() {
    try {
        const message = await exportAllData();
        setOutputText(message);
    } catch (error) {
        setOutputText(error.message);
    }
}

/**
 * Sets up all event listeners for the popup UI.
 */
export function setupEventListeners() {
    showChartBtn.addEventListener("click", toggleUsageChart);
    document.getElementById("resetBtn").addEventListener("click", handleResetData);
    document.getElementById("exportBtn").addEventListener("click", handleExportData);
}