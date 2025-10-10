let chartInstance = null;

/**
 * Load and display recent browsing data when popup opens
 */
function loadRecentData() {
  chrome.storage.local.get(['usage', 'totalUsage'], (items) => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
      document.getElementById("output").innerText = "❌ Error loading data";
      return;
    }

    const usageData = items.usage || items.totalUsage || {};
    const domains = Object.entries(usageData);
    
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
        chartContainer.classList.add('hidden');
    }

    if (domains.length === 0) {
      document.getElementById("output").innerText = "No browsing data collected yet.\nStart browsing to see your habits!";
    } else {
      const topDomains = domains
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([domain, ms]) => `${domain}: ${(ms / 60000).toFixed(1)} min`)
        .join("\n");
      document.getElementById("output").innerText = `Recent activity:\n${topDomains}`;
    }
  });
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  document.getElementById("showChartBtn").addEventListener("click", toggleUsageChart);
  document.getElementById("resetBtn").addEventListener("click", resetData);
  document.getElementById("exportBtn").addEventListener("click", exportData);
}

/**
 * Toggles the visibility of the usage chart
 */
function toggleUsageChart() {
  const chartContainer = document.querySelector('.chart-container');
  const showChartBtn = document.getElementById('showChartBtn');
  if (!chartContainer) return;

  const isHidden = chartContainer.classList.contains('hidden');

  if (isHidden) {
    chrome.storage.local.get(['usage', 'totalUsage'], (items) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        return;
      }
      const usageData = items.usage || items.totalUsage || {};
      const domains = Object.entries(usageData);

      if (domains.length === 0) {
        return; // Don't show chart if no data
      }

      domains.sort((a, b) => b[1] - a[1]);
      const topDomains = domains.slice(0, 10);
      const labels = topDomains.map(([domain]) => truncateDomain(domain));
      const values = topDomains.map(([_, ms]) => (ms / 60000).toFixed(1));

      chartContainer.classList.remove('hidden');
      renderChart(labels, values);
      showChartBtn.textContent = '🙈 Hide Chart';
    });
  } else {
    chartContainer.classList.add('hidden');
    showChartBtn.textContent = '📊 Show Chart';
  }
}


/**
 * Reset all stored data
 */
function resetData() {
  if (!confirm("Are you sure you want to clear all your browsing data? This cannot be undone.")) {
    return;
  }

  const resetBtn = document.getElementById("resetBtn");
  const originalText = resetBtn.textContent;
  
  resetBtn.textContent = "🔄 Clearing...";
  resetBtn.disabled = true;

  chrome.storage.local.clear(() => {
    if (chrome.runtime.lastError) {
      document.getElementById("output").innerText = "❌ Error clearing data";
    } else {
      document.getElementById("output").innerText = "✅ All data cleared! Starting fresh...";
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      const chartContainer = document.querySelector('.chart-container');
      if (chartContainer) {
        chartContainer.classList.add('hidden');
      }
      const showChartBtn = document.getElementById('showChartBtn');
      if(showChartBtn) {
        showChartBtn.textContent = '📊 Show Chart';
      }
    }
    
    setTimeout(() => {
      resetBtn.textContent = originalText;
      resetBtn.disabled = false;
    }, 1000);
  });
}

/**
 * Export data as JSON
 */
function exportData() {
  chrome.storage.local.get(['usage', 'totalUsage', 'lastUpdated'], (items) => {
    const merged = items.usage || items.totalUsage || {};
    const dataStr = JSON.stringify({ totalUsage: merged, lastUpdated: items.lastUpdated }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `browsing-data-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    document.getElementById("output").innerText = "📁 Data exported successfully!";
  });
}

/**
 * Render or update the pie chart
 */
function renderChart(labels, values) {
  const ctx = document.getElementById("usageChart");
  if (!ctx) {
    console.error("Chart canvas not found");
    return;
  }

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        label: "Minutes spent",
        data: values,
        backgroundColor: [
          "#4f46e5", "#6366f1", "#a5b4fc", "#c7d2fe",
          "#facc15", "#f97316", "#fb923c", "#fbbf24",
          "#ef4444", "#dc2626", "#22c55e", "#16a34a"
        ],
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, font: { size: 10 }, padding: 15 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => parseFloat(a) + parseFloat(b), 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} min (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * Truncate long domain names for chart labels
 */
function truncateDomain(domain, maxLength = 20) {
  if (domain.length <= maxLength) return domain;
  return domain.substring(0, maxLength - 3) + '...';
}

// Initial setup when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
  loadRecentData();
  setupEventListeners();
});