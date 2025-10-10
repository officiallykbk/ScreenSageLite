let chartInstance = null;
let isGenerating = false;

// Streak tracking
let currentStreak = 0;

// deprecated: moved to popup/main.js

/**
 * Load and display recent browsing data when popup opens
 */
function loadRecentData() {
  chrome.storage.local.get(['usage', 'totalUsage', 'lastUpdated'], (items) => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
      document.getElementById("output").innerText = "❌ Error loading data";
      return;
    }

    console.log('Storage items:', items);
    const usageData = items.usage || items.totalUsage || {};
    console.log('Usage data:', usageData);
    const domains = Object.entries(usageData);
    
    if (domains.length === 0) {
      document.getElementById("output").innerText = "No browsing data collected yet.\nStart browsing to see your habits!";
      // Hide chart container when no data
      const chartContainer = document.querySelector('.chart-container');
      if (chartContainer) {
        chartContainer.classList.add('hidden');
      }
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
    
    // Show chart container when data is available
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
      chartContainer.classList.remove('hidden');
    }
  });
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  document.getElementById("digestBtn").addEventListener("click", generateDigest);
  const summarizeBtn = document.getElementById("summarizeBtn");
  if (summarizeBtn) {
    summarizeBtn.addEventListener("click", summarizeCurrentPage);
  }
  document.getElementById("resetBtn").addEventListener("click", resetData);
  document.getElementById("exportBtn").addEventListener("click", exportData);
  
  // Debug: Show all storage on popup open
  chrome.storage.local.get(null, (allItems) => {
    console.log('All storage keys:', Object.keys(allItems));
    console.log('All storage data:', allItems);
  });
  
  // Add settings button
  addSettingsButton();
}

/**
 * Summarize the currently active page (article or content page)
 */
async function summarizeCurrentPage() {
  const btn = document.getElementById("summarizeBtn");
  const original = btn.textContent;
  try {
    btn.textContent = "⏳ Summarizing...";
    btn.disabled = true;
    document.getElementById("output").innerText = "🔄 Summarizing current page...";

    // Get active tab content via scripting
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');

    const [{ result } = {}] = await chrome.scripting.executeScript({
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
      document.getElementById("output").innerText = "No readable content found on this page.";
      return;
    }

    if (!chrome.ai?.summarizer) {
      // Fallback simple summary: first 3 sentences
      const sentences = result.text.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
      document.getElementById("output").innerText = `📰 ${result.title}\n\n${sentences}`;
      return;
    }

    const summary = await chrome.ai.summarizer.summarize({
      input: `Title: ${result.title}\n\nContent:\n${result.text}\n\nSummarize in 3 concise bullet points.`
    });
    document.getElementById("output").innerText = `📰 ${result.title}\n\n${summary.output}`;
  } catch (e) {
    console.error('Summarization failed', e);
    document.getElementById("output").innerText = `❌ Summarization failed: ${e.message}`;
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
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
    digestBtn.textContent = "⏳ Consulting the owl…";
    digestBtn.disabled = true;
    setLoadingState(true);

    chrome.storage.local.get(['usage', 'totalUsage'], async (items) => {
      if (chrome.runtime.lastError) {
        throw new Error(`Storage error: ${chrome.runtime.lastError.message}`);
      }

      console.log('Digest storage items:', items);
      const usageData = items.usage || items.totalUsage || {};
      console.log('Digest usage data:', usageData);
      const domains = Object.entries(usageData);

      if (domains.length === 0) {
        showErrorCard(null);
        const out = document.getElementById("output");
        out.style.display = 'block';
        out.innerText = "No browsing data to analyze.\nVisit some websites first!";
        // Hide chart container when no data
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
          chartContainer.classList.add('hidden');
        }
        resetButtonState();
        setLoadingState(false);
        return;
      }

      // Sort by time spent (descending)
      domains.sort((a, b) => b[1] - a[1]);

      // Build categories and nudges
      const { categoryTotals, categoryBreakdown } = buildCategoryTotals(usageData);
      const nudges = buildGentleNudges(categoryTotals);

      // Prepare chart data - limit to top 10 domains for readability
      const topDomains = domains.slice(0, 10);
      const labels = topDomains.map(([domain]) => truncateDomain(domain));
      const values = topDomains.map(([_, ms]) => (ms / 60000).toFixed(1));

      // Show chart container and render chart
      const chartContainer = document.querySelector('.chart-container');
      if (chartContainer) {
        chartContainer.classList.remove('hidden');
      }
      renderChart(labels, values);

      // Build detailed text for AI analysis
      const totalTime = domains.reduce((sum, [_, ms]) => sum + ms, 0);
      const categoryLines = Object.entries(categoryTotals)
        .filter(([_, ms]) => ms > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, ms]) => `${cat}: ${(ms / 60000).toFixed(1)} min`)
        .join("\n");
      const domainText = domains
        .map(([domain, ms]) => {
          const minutes = (ms / 60000).toFixed(1);
          const percentage = ((ms / totalTime) * 100).toFixed(1);
          return `${domain}: ${minutes} min (${percentage}%)`;
        })
        .join("\n");

      const summaryText = `Total browsing time: ${(totalTime / 60000).toFixed(1)} minutes across ${domains.length} websites.\n\nBy category:\n${categoryLines}\n\nTop domains:\n${domainText}`;

      try {
        // Generate AI analysis
        const analysis = await generateAIAnalysis(summaryText);
        const formatted = `${analysis}\n\n${nudges.length ? `⚠️ Gentle Nudges:\n- ${nudges.join("\n- ")}` : ''}`.trim();
        showErrorCard(null);
        updateSection('reflectionContent', formatted);
        updateSection('goalsContent', buildGoalsFeedback());
        
      } catch (aiError) {
        console.error("AI analysis failed:", aiError);
        // Fallback to manual analysis
        const manualAnalysis = generateManualAnalysis(domains, totalTime);
        const formattedFallback = `${manualAnalysis}\n\n${nudges.length ? `⚠️ Gentle Nudges:\n- ${nudges.join("\n- ")}` : ''}`.trim();
        showErrorCard("⚠️ Couldn’t reach Chrome AI APIs. Showing raw stats and tips.");
        updateSection('reflectionContent', `${summaryText}\n\n${formattedFallback}`);
        updateSection('goalsContent', buildGoalsFeedback());
      }
    });

  } catch (error) {
    console.error("Digest generation error:", error);
    showErrorCard("❌ Error generating digest. Please try again.\n\n" + error.message);
  } finally {
    resetButtonState();
    setLoadingState(false);
  }

  function resetButtonState() {
    digestBtn.textContent = originalText;
    digestBtn.disabled = false;
    isGenerating = false;
  }
}

function setLoadingState(isLoading) {
  const reflection = document.getElementById('reflectionContent');
  const goals = document.getElementById('goalsContent');
  if (!reflection || !goals) return;
  if (isLoading) {
    reflection.classList.add('skeleton');
    goals.classList.add('skeleton');
    reflection.textContent = '';
    goals.textContent = '';
  } else {
    reflection.classList.remove('skeleton');
    goals.classList.remove('skeleton');
  }
}

function showErrorCard(message) {
  const card = document.getElementById('errorCard');
  if (!card) return;
  if (!message) {
    card.style.display = 'none';
    card.textContent = '';
    return;
  }
  card.style.display = 'block';
  card.textContent = message;
}

function updateSection(id, content) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('skeleton');
  el.textContent = content;
}

function buildGoalsFeedback() {
  return '✅ Wins and ⚠️ Areas will appear here based on your goals.';
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
    // Get user goals for personalized analysis
    const goals = await new Promise((resolve) => {
      chrome.storage.local.get(['userGoals'], (result) => {
        resolve(result.userGoals || {});
      });
    });

    const goalsContext = goals.socialLimit || goals.workMinimum ? 
      `\n\nUser Goals:\n${goals.socialLimit ? `- Social media limit: ${goals.socialLimit} minutes\n` : ''}${goals.workMinimum ? `- Work/research minimum: ${goals.workMinimum} minutes\n` : ''}` : '';

    const [summary, tip] = await Promise.all([
      chrome.ai.summarizer.summarize({
        input: `Here is my browsing activity for today:\n${summaryText}${goalsContext}\n
        Please provide a brief, insightful summary (2-3 sentences) of my browsing habits. 
        Focus on patterns, productivity, and balance. Be constructive and non-judgmental.
        If goals are set, compare actual usage against those goals.`
      }),
      chrome.ai.prompt.generate({
        input: `Based on this browsing data:\n${summaryText}${goalsContext}\n
        Generate one short, practical tip (1 sentence) to improve digital wellbeing or productivity tomorrow. 
        Make it supportive and actionable. If goals are set, reference them in your tip.`
      })
    ]);

    return formatAIResponse(summary.output, tip.output, goals);
    
  } catch (aiError) {
    throw new Error(`AI service error: ${aiError.message}`);
  }
}

/**
 * Format AI response with structured wins and areas
 */
function formatAIResponse(summary, tip, goals) {
  let response = `📊 Daily Browsing Summary:\n${summary}\n\n`;
  
  // Add goal-specific feedback if goals are set
  if (goals.socialLimit || goals.workMinimum) {
    response += `🎯 Goal Check:\n`;
    if (goals.socialLimit) {
      response += `• Social media limit: ${goals.socialLimit} min\n`;
    }
    if (goals.workMinimum) {
      response += `• Work/research minimum: ${goals.workMinimum} min\n`;
    }
    response += `\n`;
  }
  
  response += `💡 Tomorrow's Tip:\n${tip}`;
  
  return response;
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
      // Hide chart container when data is cleared
      const chartContainer = document.querySelector('.chart-container');
      if (chartContainer) {
        chartContainer.classList.add('hidden');
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

/**
 * Map domains to categories and compute totals
 */
function buildCategoryTotals(usage) {
  const mapping = getCategoryMapping();
  const categoryTotals = { Work: 0, Social: 0, Video: 0, Shopping: 0, News: 0, Other: 0 };
  const categoryBreakdown = {};
  for (const [domain, ms] of Object.entries(usage)) {
    const cat = mapping(domain);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + ms;
    if (!categoryBreakdown[cat]) categoryBreakdown[cat] = [];
    categoryBreakdown[cat].push([domain, ms]);
  }
  return { categoryTotals, categoryBreakdown };
}

function getCategoryMapping() {
  const social = ['twitter.com','x.com','facebook.com','instagram.com','tiktok.com','reddit.com','pinterest.com'];
  const video = ['youtube.com','vimeo.com','twitch.tv','netflix.com','hulu.com'];
  const work = ['github.com','gitlab.com','stackoverflow.com','notion.so','notion.site','docs.google.com','drive.google.com','figma.com','slack.com'];
  const shopping = ['amazon.com','ebay.com','etsy.com','aliexpress.com','bestbuy.com'];
  const news = ['nytimes.com','cnn.com','bbc.com','theverge.com','wsj.com','bloomberg.com'];
  return (domain) => {
    const d = domain.toLowerCase();
    if (social.some(s => d.endsWith(s))) return 'Social';
    if (video.some(s => d.endsWith(s))) return 'Video';
    if (work.some(s => d.endsWith(s))) return 'Work';
    if (shopping.some(s => d.endsWith(s))) return 'Shopping';
    if (news.some(s => d.endsWith(s))) return 'News';
    return 'Other';
  };
}

function buildGentleNudges(categoryTotals) {
  const nudges = [];
  const toMin = (ms) => Math.round(ms / 60000);
  if (categoryTotals.Social > 60 * 60000) nudges.push(`High social time (${toMin(categoryTotals.Social)} min). Consider batching checks.`);
  if (categoryTotals.Video > 90 * 60000) nudges.push(`Lots of video (${toMin(categoryTotals.Video)} min). Try a timer for intentional breaks.`);
  if (categoryTotals.Work < 45 * 60000) nudges.push(`Low focus time (${toMin(categoryTotals.Work)} min). Block a 25-min deep work session.`);
  return nudges;
}

/**
 * Update streak display
 */
function updateStreakDisplay() {
  chrome.storage.local.get(['streakData'], (result) => {
    const streakData = result.streakData || { current: 0, lastActive: null };
    const today = new Date().toDateString();
    
    if (streakData.lastActive === today) {
      currentStreak = streakData.current;
    } else {
      // Check if yesterday was active
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      
      if (streakData.lastActive === yesterdayStr) {
        currentStreak = streakData.current + 1;
      } else {
        currentStreak = 1; // Reset streak
      }
      
      // Update streak data
      chrome.storage.local.set({
        streakData: {
          current: currentStreak,
          lastActive: today
        }
      });
    }
    
    // Add streak indicator to popup if streak > 0
    if (currentStreak > 0) {
      addStreakIndicator();
    }
  });
}

/**
 * Add streak indicator to popup
 */
function addStreakIndicator() {
  const container = document.querySelector('.container');
  const existingStreak = document.getElementById('streakIndicator');
  
  if (existingStreak) {
    existingStreak.remove();
  }
  
  if (currentStreak > 0) {
    const streakEl = document.createElement('div');
    streakEl.id = 'streakIndicator';
    streakEl.style.cssText = `
      background: linear-gradient(45deg, #ff6b6b, #ffa500);
      color: white;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    streakEl.textContent = `🔥 ${currentStreak}-day productivity streak!`;
    
    // Insert after h1
    const h1 = container.querySelector('h1');
    h1.insertAdjacentElement('afterend', streakEl);
  }
}

/**
 * Add settings button to popup
 */
function addSettingsButton() {
  const container = document.querySelector('.container');
  const existingSettings = document.getElementById('settingsBtn');
  
  if (existingSettings) {
    existingSettings.remove();
  }
  
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'settingsBtn';
  settingsBtn.textContent = '⚙️ Settings';
  settingsBtn.style.cssText = `
    background: #6b7280;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
  `;
  
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  container.style.position = 'relative';
  container.appendChild(settingsBtn);
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