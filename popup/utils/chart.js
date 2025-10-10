let chartInstance = null;

export function renderChart(labels, values) {
  const ctx = document.getElementById('usageChart');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets: [{ label: 'Minutes spent', data: values, backgroundColor: [
      '#4f46e5','#6366f1','#a5b4fc','#c7d2fe','#facc15','#f97316','#fb923c','#fbbf24','#ef4444','#dc2626','#22c55e','#16a34a','#06b6d4','#0ea5e9','#8b5cf6','#a855f7'
    ], borderColor: '#fff', borderWidth: 2, hoverOffset: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 }, padding: 15 } } } }
  });
}


