import { getApiKey, setApiKey } from '../config.js';
import { verifyApiKey } from '../aiHandler.js';

// Theme management
async function initTheme() {
    // Get the current theme from storage or system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Get saved theme from chrome.storage.local
    const result = await chrome.storage.local.get('theme');
    const savedTheme = result.theme;
    
    // Determine initial theme
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    // Apply the theme
    applyTheme(isDark);
    
    // Listen for system theme changes if no saved preference
    if (!savedTheme) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            const isSystemDark = e.matches;
            applyTheme(isSystemDark);
        });
    }
    
    // Toggle theme when button is clicked
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', async (e) => {
            e.preventDefault();
            const isDarkMode = !document.body.classList.contains('dark-mode');
            await applyTheme(isDarkMode);
            // Notify other parts of the extension about theme change
            chrome.runtime.sendMessage({ 
                type: 'THEME_CHANGED', 
                isDark: isDarkMode 
            });
        });
    }
    
    // Listen for theme changes from other parts of the extension
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'THEME_CHANGED') {
            applyTheme(message.isDark);
        }
    });
}

// Apply theme and save preference
async function applyTheme(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    updateThemeIcon(isDark ? 'dark' : 'light');
    // Save to chrome.storage.local for persistence
    await chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeIcon.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const socialLimitInput = document.getElementById('socialLimit');
    const videoLimitInput = document.getElementById('videoLimit');
    const workMinimumInput = document.getElementById('workMinimum');
    const saveButton = document.getElementById('saveButton');
    const statusMessage = document.getElementById('statusMessage');
    const apiKeyInput = document.getElementById('apiKey');

    // Set initial button text
    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', () => {
            saveButton.textContent = 'Verify & Save';
        });
    }
    const toggleApiKeyBtn = document.getElementById('toggleApiKey');

    // Toggle API key visibility
    toggleApiKeyBtn?.addEventListener('click', () => {
        apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
        toggleApiKeyBtn.textContent = apiKeyInput.type === 'password' ? 'Show' : 'Hide';
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
        saveButton.textContent = 'Verifying...';

        // Verify and Save API key
        const apiKey = apiKeyInput.value.trim();
        const isVerified = await verifyApiKey(apiKey);

        if (isVerified) {
            await setApiKey(apiKey);
            showStatus('API Key Verified and Saved!', 'success');
            setTimeout(() => {
                saveButton.textContent = 'API Key Verified';
            }, 500);
        } else {
            showStatus('API Key is invalid. Please check and try again.', 'error');
            saveButton.textContent = 'Verification Failed';
            return; // Stop execution if key is invalid
        }

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
        setTimeout(() => {
            saveButton.textContent = 'Save Settings';
        }, 2000); // Revert after 2 seconds
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
    initTheme();
    loadSettings();
});