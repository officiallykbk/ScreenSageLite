export async function getUsageMerged() {
  const items = await chrome.storage.local.get(['usage', 'totalUsage']);
  return items.usage || items.totalUsage || {};
}

export function exportMerged() {
  chrome.storage.local.get(['usage', 'totalUsage', 'lastUpdated'], (items) => {
    const merged = items.usage || items.totalUsage || {};
    const dataStr = JSON.stringify({ totalUsage: merged, lastUpdated: items.lastUpdated }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `browsing-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}


