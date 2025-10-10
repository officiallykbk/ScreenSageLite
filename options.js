// Settings page functionality
document.addEventListener('DOMContentLoaded', function() {
  loadCurrentGoals();
  setupEventListeners();
});

/**
 * Load current goals from storage
 */
function loadCurrentGoals() {
  chrome.storage.local.get(['userGoals'], (result) => {
    const goals = result.userGoals || {};
    
    if (goals.socialLimit) {
      document.getElementById('socialLimit').value = goals.socialLimit;
    }
    if (goals.workMinimum) {
      document.getElementById('workMinimum').value = goals.workMinimum;
    }
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  document.getElementById('saveGoals').addEventListener('click', saveGoals);
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('resetData').addEventListener('click', resetData);
  const viewKeys = document.getElementById('viewKeys');
  if (viewKeys) {
    viewKeys.addEventListener('click', () => {
      chrome.storage.local.get(null, (allData) => {
        const keysOutput = document.getElementById('keysOutput');
        keysOutput.style.display = 'block';
        const shallow = Object.fromEntries(Object.entries(allData).map(([k,v]) => [k, typeof v]));
        keysOutput.textContent = JSON.stringify(shallow, null, 2);
      });
    });
  }
}

/**
 * Save user goals
 */
function saveGoals() {
  const socialLimit = parseInt(document.getElementById('socialLimit').value);
  const workMinimum = parseInt(document.getElementById('workMinimum').value);
  
  // Validate inputs
  if (socialLimit < 0 || socialLimit > 480) {
    showStatus('Social limit must be between 0 and 480 minutes', 'error');
    return;
  }
  
  if (workMinimum < 0 || workMinimum > 480) {
    showStatus('Work minimum must be between 0 and 480 minutes', 'error');
    return;
  }
  
  if (socialLimit === 0 && workMinimum === 0) {
    showStatus('Please set at least one goal', 'error');
    return;
  }
  
  const goals = {
    socialLimit: socialLimit || null,
    workMinimum: workMinimum || null,
    lastUpdated: Date.now()
  };
  
  chrome.storage.local.set({ userGoals: goals }, () => {
    if (chrome.runtime.lastError) {
      showStatus('Error saving goals: ' + chrome.runtime.lastError.message, 'error');
    } else {
      showStatus('✅ Goals saved successfully!', 'success');
    }
  });
}

/**
 * Export all data
 */
function exportData() {
  chrome.storage.local.get(null, (allData) => {
    const exportData = {
      usage: allData.usage || {},
      usageMeta: allData.usageMeta || {},
      userGoals: allData.userGoals || {},
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `screensage-data-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showStatus('📁 Data exported successfully!', 'success');
  });
}

/**
 * Reset all data
 */
function resetData() {
  if (!confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
    return;
  }
  
  chrome.storage.local.clear(() => {
    if (chrome.runtime.lastError) {
      showStatus('Error clearing data: ' + chrome.runtime.lastError.message, 'error');
    } else {
      showStatus('✅ All data cleared!', 'success');
      // Clear form
      document.getElementById('socialLimit').value = '';
      document.getElementById('workMinimum').value = '';
    }
  });
}

/**
 * Show status message
 */
function showStatus(message, type) {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = `status-message status-${type}`;
  statusEl.style.display = 'block';
  
  // Hide after 3 seconds
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}
