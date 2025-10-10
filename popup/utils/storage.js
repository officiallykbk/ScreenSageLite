/**
 * Retrieves usage data from chrome.storage.
 * @returns {Promise<Object>} A promise that resolves with the usage data.
 */
export function getUsageData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['usage', 'totalUsage'], (items) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(items.usage || items.totalUsage || {});
    });
  });
}

/**
 * Clears all data from chrome.storage.
 * @returns {Promise<void>} A promise that resolves when data is cleared.
 */
export function clearAllData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear((items) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  });
}

/**
 * Exports all browsing data to a JSON file.
 */
export async function exportAllData() {
    try {
        const usageData = await getUsageData();
        const { lastUpdated = null } = await new Promise(resolve => chrome.storage.local.get('lastUpdated', resolve));

        const dataStr = JSON.stringify({ totalUsage: usageData, lastUpdated }, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `browsing-data-${new Date().toISOString().split('T')[0]}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return "📁 Data exported successfully!";
    } catch (error) {
        console.error("Export failed", error);
        throw new Error("❌ Export failed.");
    }
}