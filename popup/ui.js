let chartInstance = null;

export function renderChart(labels, values) {
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
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          label: "Minutes spent",
          data: values,
          backgroundColor: [
            "#4f46e5", "#6366f1", "#a5b4fc", "#c7d2fe",
            "#facc15", "#f97316", "#fb923c", "#fbbf24",
            "#ef4444", "#dc2626", "#22c55e", "#16a34a",
          ],
          borderColor: "#1a202c",
          borderWidth: 4,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                return `${label}: ${value} min`;
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

export function updateStreakDisplay(streakData) {
    const streakIndicator = document.getElementById('streakIndicator');
    if (!streakIndicator) return;

    const today = new Date().toDateString();
    let currentStreak = streakData.current || 0;

    if (streakData.lastActive !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (streakData.lastActive === yesterday.toDateString()) {
            currentStreak++;
        } else {
            currentStreak = 1;
        }
        // Save the updated streak
        chrome.storage.local.set({ streakData: { current: currentStreak, lastActive: today } });
    }

    streakIndicator.textContent = `🔥 ${currentStreak}-day streak`;
}

export function showLoadingState(isLoading) {
  const reflectionContent = document.getElementById('reflectionContent');
  if (isLoading) {
    reflectionContent.classList.add('skeleton');
    reflectionContent.innerHTML = '<div class="skeleton-text"></div><div class="skeleton-text"></div>';
  } else {
    reflectionContent.classList.remove('skeleton');
  }
}

export function showError(message) {
    const errorCard = document.getElementById('errorCard');
    errorCard.textContent = message;
    errorCard.style.display = 'block';
    setTimeout(() => errorCard.style.opacity = 1, 10);
}

export function hideError() {
    const errorCard = document.getElementById('errorCard');
    errorCard.style.opacity = 0;
    setTimeout(() => errorCard.style.display = 'none', 300);
}

export function updateReflection(content) {
    const reflectionCard = document.getElementById('reflection-card');
    const reflectionContent = document.getElementById('reflectionContent');

    reflectionContent.innerHTML = content;
    reflectionCard.style.display = 'block';
    showLoadingState(false);
    setTimeout(() => reflectionCard.style.opacity = 1, 10);
}

export function updateQuickSummary(usageData) {
    const quickSummary = document.getElementById('quick-summary');
    if (!quickSummary) return;

    const topDomains = Object.entries(usageData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([domain, ms]) => `<div>${domain}: <strong>${(ms / 60000).toFixed(0)} min</strong></div>`)
        .join('');

    if (topDomains) {
        quickSummary.innerHTML = topDomains;
    } else {
        quickSummary.innerHTML = 'No data yet. Start browsing!';
    }
}