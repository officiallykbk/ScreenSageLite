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

export function updateDigest(digest) {
    const reflectionCard = document.getElementById('reflection-card');
    const reflectionContent = document.getElementById('reflectionContent');
    const fallbackCard = document.getElementById('fallback-card');
    const fallbackQuote = document.getElementById('fallback-quote');
    const fallbackAuthor = document.getElementById('fallback-author');

    // Hide both cards initially to ensure a clean slate
    reflectionCard.style.display = 'none';
    fallbackCard.style.display = 'none';

    if (digest.isFallback) {
        // We received a motivational quote
        fallbackQuote.textContent = `“${digest.quote}”`;
        fallbackAuthor.textContent = digest.author;
        fallbackCard.style.display = 'block';
        setTimeout(() => fallbackCard.style.opacity = 1, 10);
    } else {
        // We received a standard AI digest
        reflectionContent.innerHTML = digest.content;
        reflectionCard.style.display = 'block';
        setTimeout(() => reflectionCard.style.opacity = 1, 10);
    }
     showLoadingState(false);
}

// Keep updateReflection for any part of the code that might still use it for non-digest content.
export function updateReflection(content) {
    // This function can now be a simple wrapper or be deprecated over time.
    // For now, it will assume the content is a standard digest.
    updateDigest({ isFallback: false, content: content });
}

export function updateNudges(content) {
    const nudgesCard = document.getElementById('nudges-card');
    const nudgesContent = document.getElementById('nudgesContent');

    if (!content || !nudgesCard || !nudgesContent) return;

    // The AI may return nudges separated by newlines, so we format them into a list.
    const formattedContent = content.split('\n').map(nudge => `<div>${nudge}</div>`).join('');

    nudgesContent.innerHTML = formattedContent;
    nudgesCard.style.display = 'block';
    nudgesContent.classList.remove('skeleton'); // Ensure skeleton is removed
    setTimeout(() => nudgesCard.style.opacity = 1, 10);
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

export function renderGoals(goalResults) {
    const goalsCard = document.getElementById('goals-card');
    const goalsContent = document.getElementById('goals-content');

    if (!goalResults || goalResults.length === 0) {
        goalsCard.style.display = 'none';
        return;
    }

    goalsCard.style.display = 'block';
    goalsContent.innerHTML = goalResults.map(goal => {
        const percentage = Math.min((goal.spent / goal.goal) * 100, 100);
        const statusClass = goal.achieved ? 'achieved' : 'missed';

        return `
            <div class="goal-item">
                <div class="goal-info">
                    <span class="goal-name">${goal.achieved ? '✅' : '⚠️'} ${goal.name}</span>
                    <span class="goal-progress-text">${goal.spent} / ${goal.goal} min</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-bar-inner ${statusClass}" style="width: ${percentage}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

export function addButtonRippleEffect() {
    const buttons = document.querySelectorAll('.action-btn, .footer-btn, .icon-btn');

    buttons.forEach(button => {
        button.addEventListener('click', function (e) {
            const rect = button.getBoundingClientRect();
            const ripple = document.createElement('span');
            const diameter = Math.max(button.clientWidth, button.clientHeight);
            const radius = diameter / 2;

            ripple.style.width = ripple.style.height = `${diameter}px`;
            ripple.style.left = `${e.clientX - rect.left - radius}px`;
            ripple.style.top = `${e.clientY - rect.top - radius}px`;
            ripple.classList.add('ripple');

            // Remove existing ripples
            const existingRipple = button.querySelector('.ripple');
            if (existingRipple) {
                existingRipple.remove();
            }

            button.appendChild(ripple);
        });
    });
}

export function initTheme() {
    chrome.storage.local.get('theme', ({ theme }) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        }
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        chrome.storage.local.set({ theme });
    });
}

export function addCardParallaxEffect() {
    const container = document.querySelector('.container');
    const cards = document.querySelectorAll('.card');

    container.addEventListener('mousemove', (e) => {
        const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
        const yAxis = (window.innerHeight / 2 - e.pageY) / 25;

        cards.forEach(card => {
            card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
        });
    });

    container.addEventListener('mouseleave', () => {
        cards.forEach(card => {
            card.style.transform = `rotateY(0deg) rotateX(0deg)`;
        });
    });
}

export function loadOwlMascot() {
    const owlMascot = document.getElementById('owl-mascot');
    if (owlMascot) {
        fetch('/owl.svg')
            .then(response => response.text())
            .then(svg => {
                owlMascot.innerHTML = svg;
            });
    }
}