import { getUsageMerged, exportMerged } from './utils/storage.js';
import { renderChart } from './utils/chart.js';
import { summarizeCurrentPage } from './utils/summarize.js';
import { generateDigest } from './utils/digest.js';

export function setupEventListeners() {
  try {
    const digestBtn = document.getElementById('digestBtn');
    if (digestBtn) digestBtn.addEventListener('click', generateDigest);
    const summarizeBtn = document.getElementById('summarizeBtn');
    if (summarizeBtn) summarizeBtn.addEventListener('click', summarizeCurrentPage);
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetData);
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportData);
  } catch (e) {
    console.error('Failed to attach popup listeners:', e);
  }
  addSettingsButton();
  wireTabs();
}

export async function loadRecentData() {
  try {
    const usageData = await getUsageMerged();
    const domains = Object.entries(usageData);
    if (domains.length === 0) {
      // No content: hide output to collapse, hide chart too
      updateOutput('<h3 class="activity-title">No browsing data collected yet.</h3><p>Start browsing to see your habits!</p>', true);
      hideChart();
      return;
    }
    const topDomains = domains
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Show top 5 for a better list

    let html = '<h3 class="activity-title">Recent Activity</h3><ul class="domain-list">';
    for (const [domain, ms] of topDomains) {
        const minutes = (ms / 60000).toFixed(1);
        html += `
            <li>
                <span class="domain-name">${domain}</span>
                <span class="domain-time">${minutes} min</span>
            </li>`;
    }
    html += '</ul>';

    updateOutput(html, true);
    showChart();
  } catch (error) {
    console.error('Error loading recent data:', error);
    updatePopupHeight();
  }
}

function wireTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const sections = Array.from(document.querySelectorAll('[data-section]'));
  const showSection = (name) => {
    sections.forEach(sec => {
      sec.style.display = sec.getAttribute('data-section') === name ? 'block' : 'none';
    });
  };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const name = tab.getAttribute('data-tab');
      showSection(name);
    });
  });
  // default
  showSection('overview');
}

function setOutput(text) {
  const el = document.getElementById('output');
  if (!el) return;
  const empty = !text || text.trim() === '';
  if (empty) {
    el.classList.add('collapsed');
    el.textContent = '';
  } else {
    el.classList.remove('collapsed');
    el.style.display = 'block';
    el.innerText = text;
  }
  updatePopupHeight();
}

function hideChart() {
  const chartContainer = document.querySelector('.chart-container');
  if (chartContainer) chartContainer.classList.add('hidden');
  updatePopupHeight();
}

function showChart() {
  const chartContainer = document.querySelector('.chart-container');
  if (chartContainer) chartContainer.classList.remove('hidden');
  updatePopupHeight();
}

function addSettingsButton() {
  const container = document.querySelector('.container');
  if (!container) return;
  const existing = document.getElementById('settingsBtn');
  if (existing) existing.remove();
  const btn = document.createElement('button');
  btn.id = 'settingsBtn';
  btn.textContent = '⚙️ Settings';
  btn.style.cssText = 'background:#6b7280;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;position:absolute;top:10px;right:10px;z-index:1000;';
  btn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  container.style.position = 'relative';
  container.appendChild(btn);
}

function exportData() {
  exportMerged();
}

function resetData() {
  if (!confirm('Are you sure you want to clear all your browsing data? This cannot be undone.')) return;
  const resetBtn = document.getElementById('resetBtn');
  if (!resetBtn) return;
  const original = resetBtn.textContent;
  resetBtn.textContent = '🔄 Clearing...';
  resetBtn.disabled = true;

  clearAllData().then(() => {
    // Immediately collapse visible content
    updateOutput('<h3 class="activity-title">No browsing data collected yet.</h3><p>Start browsing to see your habits!</p>', true);
    hideChart();

    // Restore button state
    setTimeout(() => {
      resetBtn.textContent = original;
      resetBtn.disabled = false;
    }, 500);
  });
}

function isContentEmpty() {
  const output = document.getElementById('output');
  const chartHidden = document.querySelector('.chart-container')?.classList.contains('hidden');
  const outputEmptyOrHidden = !output || output.classList.contains('collapsed');
  return (!!chartHidden) && (!!outputEmptyOrHidden);
}

function updatePopupHeight() {
  if (isContentEmpty()) {
    document.documentElement.style.setProperty('--popup-height', 'auto');
  } else {
    document.documentElement.style.removeProperty('--popup-height');
  }
}

export function activateTab(name) {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const target = tabs.find(t => t.getAttribute('data-tab') === name);
  if (target) target.click();
}
