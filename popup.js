let chartInstance = null;
let isGenerating = false;

// Initialize when popup loads
document.addEventListener('DOMContentLoaded', function() {
  loadRecentData();
  setupEventListeners();
});

/**
 * Load and display recent browsing data when popup opens
 */
function loadRecentData() {
  chrome.storage.local.get(['totalUsage', 'lastUpdated'], (items) => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
      document.getElementById("output").innerText = "❌ Error loading data";
      return;
    }

    const usageData = items.totalUsage || {};
    const domains = Object.entries(usageData);
    
    if (domains.length === 0) {
      document.getElementById("output").innerText = "No browsing data collected yet.\nStart browsing to see your habits!";
      return;
    }

    // Show quick summary of top domains
    const topDomains = domains
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([domain, ms]) => `${domain}: ${(ms / 60000).toFixed(1)} min`)
      .join("\n");

    document.getElementById("output").innerText = 
      `Recent activity:\n${topDomains}\n\nClick "Generate Digest" for full analysis!`;
  });
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  document.getElementById("digestBtn").addEventListener("click", generateDigest);
  document.getElementById("resetBtn").addEventListener("click", resetData);
  document.getElementById("exportBtn").addEventListener("click", exportData);
}

/**
 * Generate the daily digest with AI analysis
 */
async function generateDigest() {
  if (isGenerating) {
    return; // Prevent multiple simultaneous requests
  }

  isGenerating = true;
  const digestBtn = document.getElementById("digestBtn");
  const originalText = digestBtn.textContent;
  
  try {
    // Show loading state
    digestBtn.textContent = "⏳ Analyzing...";
    digestBtn.disabled = true;
    document.getElementById("output").innerText = "🔄 Analyzing your browsing habits...";

    chrome.storage.local.get(['totalUsage'], async (items) => {
      if (chrome.runtime.lastError) {
        throw new Error(`Storage error: ${chrome.runtime.lastError.message}`);
      }

      const usageData = items.totalUsage || {};
      const domains = Object.entries(usageData);

      if (domains.length === 0) {
        document.getElementById("output").innerText = "No browsing data to analyze.\nVisit some websites first!";
        resetButtonState();
        return;
      }

      // Sort by time spent (descending)
      domains.sort((a, b) => b[1] - a[1]);

      // Prepare chart data - limit to top 10 domains for readability
      const topDomains = domains.slice(0, 10);
      const labels = topDomains.map(([domain]) => truncateDomain(domain));
      const values = topDomains.map(([_, ms]) => (ms / 60000).toFixed(1));

      // Show chart
      renderChart(labels, values);

      // Build detailed text for AI analysis
      const totalTime = domains.reduce((sum, [_, ms]) => sum + ms, 0);
      const domainText = domains
        .map(([domain, ms]) => {
          const minutes = (ms / 60000).toFixed(1);
          const percentage = ((ms / totalTime) * 100).toFixed(1);
          return `${domain}: ${minutes} min (${percentage}%)`;
        })
        .join("\n");

      const summaryText = `Total browsing time: ${(totalTime / 60000).toFixed(1)} minutes across ${domains.length} websites.\n\nDetailed breakdown:\n${domainText}`;

      try {
        // Generate AI analysis
        const analysis = await generateAIAnalysis(summaryText);
        document.getElementById("output").innerText = analysis;
        
      } catch (aiError) {
        console.error("AI analysis failed:", aiError);
        // Fallback to manual analysis
        const manualAnalysis = generateManualAnalysis(domains, totalTime);
        document.getElementById("output").innerText = 
          `🤖 AI temporarily unavailable\n\n${summaryText}\n\n${manualAnalysis}`;
      }
    });

  } catch (error) {
    console.error("Digest generation error:", error);
    document.getElementById("output").innerText = 
      "❌ Error generating digest. Please try again.\n\nError: " + error.message;
  } finally {
    resetButtonState();
  }

  function resetButtonState() {
    digestBtn.textContent = originalText;
    digestBtn.disabled = false;
    isGenerating = false;
  }
}

/**
 * Generate AI analysis using Chrome's AI APIs
 */
async function generateAIAnalysis(summaryText) {
  // Check if AI APIs are available
  if (!chrome.ai?.summarizer || !chrome.ai?.prompt) {
    throw new Error("AI APIs not available");
  }

  try {
    const [summary, tip] = await Promise.all([
      chrome.ai.summarizer.summarize({
        input: `Here is my browsing activity for today:\n${summaryText}\n
        Please provide a brief, insightful summary (2-3 sentences) of my browsing habits. 
        Focus on patterns, productivity, and balance. Be constructive and non-judgmental.`
      }),
      chrome.ai.prompt.generate({
        input: `Based on this browsing data:\n${summaryText}\n
        Generate one short, practical tip (1 sentence) to improve digital wellbeing or productivity tomorrow. 
        Make it supportive and actionable.`
      })
    ]);

    return `📊 Daily Browsing Summary:\n${summary.output}\n\n💡 Tomorrow's Tip:\n${tip.output}`;
    
  } catch (aiError) {
    throw new Error(`AI service error: ${aiError.message}`);
  }
}

/**
 * Generate manual analysis as fallback when AI is unavailable
 */
function generateManualAnalysis(domains, totalTime) {
  const topDomain = domains[0];
  const totalMinutes = (totalTime / 60000).toFixed(1);
  const topDomainMinutes = (topDomain[1] / 60000).toFixed(1);
  const topDomainPercentage = ((topDomain[1] / totalTime) * 100).toFixed(1);

  let insight = "";
  if (totalMinutes > 240) { // More than 4 hours
    insight = "You've spent significant time online today. Consider taking regular screen breaks tomorrow.";
  } else if (domains.length > 15) {
    insight = "You visited many different sites. Focusing on fewer tasks might boost productivity.";
  } else if (parseFloat(topDomainPercentage) > 50) {
    insight = `You focused heavily on ${topDomain[0]}. Great for deep work!`;
  } else {
    insight = "Your browsing looks balanced today. Keep up the good habits!";
  }

  return `📈 Manual Analysis:\nTotal: ${totalMinutes} min | Sites: ${domains.length}\nTop: ${topDomain[0]} (${topDomainMinutes} min)\n\n💡 Insight:\n${insight}`;
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
    }
    
    // Reset button after a delay
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
  chrome.storage.local.get(['totalUsage', 'lastUpdated'], (items) => {
    const dataStr = JSON.stringify(items, null, 2);
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

  // Clear previous chart
  if (chartInstance) {
    chartInstance.destroy();
  }

  try {
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
            "#ef4444", "#dc2626", "#22c55e", "#16a34a",
            "#06b6d4", "#0ea5e9", "#8b5cf6", "#a855f7"
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
            labels: {
              boxWidth: 12,
              font: {
                size: 10
              },
              padding: 15
            }
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
        },
        animation: {
          animateScale: true,
          animateRotate: true
        }
      }
    });
  } catch (chartError) {
    console.error("Chart rendering error:", chartError);
  }
}

/**
 * Truncate long domain names for chart labels
 */
function truncateDomain(domain, maxLength = 20) {
  if (domain.length <= maxLength) return domain;
  return domain.substring(0, maxLength - 3) + '...';
}

/**
 * Format time for display
 */
function formatTime(minutes) {
  if (minutes < 60) {
    return `${minutes.toFixed(0)} min`;
  } else {
    const hours = (minutes / 60).toFixed(1);
    return `${hours} hours`;
  }
}

// Add CSS for responsive chart container
const style = document.createElement('style');
style.textContent = `
  .chart-container {
    position: relative;
    height: 200px;
    width: 100%;
    margin: 10px 0;
  }
  
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .loading {
    opacity: 0.7;
  }
`;
document.head.appendChild(style);