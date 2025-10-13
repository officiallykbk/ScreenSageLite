import { getUsageMerged } from './storage.js';
import { renderChart } from './chart.js';
import { buildCategoryTotals, buildGentleNudges, truncateDomain, setLoadingState, showErrorCard, updateSection, generateManualAnalysis } from './helpers.js';
import { generateAIAnalysis } from './api.js';
import { activateTab } from '../ui.js';

export async function generateDigest() {
  const digestBtn = document.getElementById('digestBtn');
  const original = digestBtn.textContent;
  try {
    digestBtn.textContent = '⏳ Consulting the owl…';
    digestBtn.disabled = true;
    setLoadingState(true);
    const usageData = await getUsageMerged();
    const domains = Object.entries(usageData);
    if (domains.length === 0) {
      showErrorCard(null);
      const out = document.getElementById('output');
      out.style.display = 'block';
      out.innerText = 'No browsing data to analyze.\nVisit some websites first!';
      const chartContainer = document.querySelector('.chart-container');
      if (chartContainer) chartContainer.classList.add('hidden');
      return;
    }
    domains.sort((a,b)=>b[1]-a[1]);
    const { categoryTotals } = buildCategoryTotals(usageData);
    const nudges = buildGentleNudges(categoryTotals);
    const topDomains = domains.slice(0,10);
    const labels = topDomains.map(([d])=>truncateDomain(d));
    const values = topDomains.map(([_,ms])=>(ms/60000).toFixed(1));
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) chartContainer.classList.remove('hidden');
    renderChart(labels, values);
    const totalTime = domains.reduce((s,[_,ms])=>s+ms,0);
    const categoryLines = Object.entries(categoryTotals).filter(([_,ms])=>ms>0).sort((a,b)=>b[1]-a[1]).map(([c,ms])=>`${c}: ${(ms/60000).toFixed(1)} min`).join('\n');
    const domainText = domains.map(([d,ms])=>{ const m=(ms/60000).toFixed(1); const p=((ms/totalTime)*100).toFixed(1); return `${d}: ${m} min (${p}%)`; }).join('\n');
    const summaryText = `Total browsing time: ${(totalTime/60000).toFixed(1)} minutes across ${domains.length} websites.\n\nBy category:\n${categoryLines}\n\nTop domains:\n${domainText}`;
    try {
      const analysis = await generateAIAnalysis(summaryText);
      const formatted = `${analysis}\n\n${nudges.length?`⚠️ Gentle Nudges:\n- ${nudges.join('\n- ')}`:''}`.trim();
      showErrorCard(null);
      updateSection('reflectionContent', formatted);
      activateTab('reflection');
    } catch (e) {
      const manualAnalysis = generateManualAnalysis(domains, totalTime);
      const formattedFallback = `${manualAnalysis}\n\n${nudges.length?`⚠️ Gentle Nudges:\n- ${nudges.join('\n- ')}`:''}`.trim();
      showErrorCard('⚠️ Couldn’t reach Chrome AI APIs. Showing raw stats and tips.');
      updateSection('reflectionContent', `${summaryText}\n\n${formattedFallback}`);
      activateTab('reflection');
    }
  } finally {
    digestBtn.textContent = original;
    digestBtn.disabled = false;
    setLoadingState(false);
  }
}
