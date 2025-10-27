import { getApiKey, setApiKey } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const socialLimitInput = document.getElementById('socialLimit');
    const videoLimitInput = document.getElementById('videoLimit');
    const workMinimumInput = document.getElementById('workMinimum');
    const saveButton = document.getElementById('saveButton');
    const statusMessage = document.getElementById('statusMessage');
    const apiKeyInput = document.getElementById('apiKey');
    const toggleApiKeyBtn = document.getElementById('toggleApiKey');

    // Toggle API key visibility
    toggleApiKeyBtn?.addEventListener('click', () => {
        const type = apiKeyInput.type === 'password' ? 'text' : 'password';
        apiKeyInput.type = type;
        toggleApiKeyBtn.textContent = type === 'password' ? 'Show' : 'Hide';
    });

    // Load settings from storage
    const loadSettings = async () => {
        try {
            // Load goals from sync storage
            const result = await chrome.storage.sync.get(['userGoals']);
            
            if (result.userGoals) {
                socialLimitInput.value = result.userGoals.socialLimit || '';
                videoLimitInput.value = result.userGoals.videoLimit || '';
                workMinimumInput.value = result.userGoals.workMinimum || '';
            }

            // Load API key
            const apiKey = await getApiKey();
            if (apiKey) {
                apiKeyInput.value = apiKey;
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showStatus('Failed to load settings', 'error');
        }
    };

    // Save settings to storage
    const saveSettings = async () => {
        try {
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';

            // Save API key
            await setApiKey(apiKeyInput.value.trim());
            
            // Save goals to sync storage
            const goals = {
                socialLimit: parseInt(socialLimitInput.value, 10) || 0,
                videoLimit: parseInt(videoLimitInput.value, 10) || 0,
                workMinimum: parseInt(workMinimumInput.value, 10) || 0,
            };

            await chrome.storage.sync.set({ userGoals: goals });
            showStatus('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            showStatus('Failed to save settings', 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Settings';
        }
    };

    // Show status message
    const showStatus = (message, type = 'info') => {
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.style.opacity = '1';
        
        // Update styles based on message type
        if (type === 'success') {
            statusMessage.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            statusMessage.style.color = '#10b981';
        } else if (type === 'error') {
            statusMessage.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            statusMessage.style.color = '#ef4444';
        } else {
            statusMessage.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
            statusMessage.style.color = '#6366f1';
        }

        // Hide after 3 seconds
        setTimeout(() => {
            if (statusMessage) {
                statusMessage.style.opacity = '0';
            }
        }, 3000);
    };

    // Event Listeners
    saveButton?.addEventListener('click', saveSettings);
    
    // Initialize
    loadSettings();
});