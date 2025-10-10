let chartInstance = null;

/**
 * Truncate long domain names for chart labels
 * @param {string} domain The domain name to truncate.
 * @param {number} maxLength The maximum length of the domain name.
 * @returns {string} The truncated domain name.
 */
function truncateDomain(domain, maxLength = 20) {
  if (domain.length <= maxLength) return domain;
  return domain.substring(0, maxLength - 3) + '...';
}

/**
 * Render or update the pie chart
 * @param {string[]} labels The labels for the chart.
 * @param {number[]} values The values for the chart.
 */
export function renderChart(labels, values) {
  const ctx = document.getElementById("usageChart");
  if (!ctx) {
    console.error("Chart canvas not found");
    return;
  }

  if (chartInstance) {
    chartInstance.destroy();
  }

  const truncatedLabels = labels.map(label => truncateDomain(label));

  chartInstance = new Chart(ctx, {
    type: "pie",
    data: {
      labels: truncatedLabels,
      datasets: [{
        label: "Minutes spent",
        data: values,
        backgroundColor: [
          "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe",
          "#f97316", "#fb923c", "#fbbf24", "#fcd34d",
          "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"
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
          labels: { boxWidth: 12, font: { size: 11, family: "'Inter', sans-serif" }, padding: 15, color: '#4b5563' }
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
}

/**
 * Destroys the chart instance.
 */
export function destroyChart() {
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
}