import { getApiKey, setApiKey } from './config.js';
import { verifyApiKey } from './aiHandler.js';

function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    document.body.classList.toggle('dark-mode', isDark);
    updateThemeIcon(isDark ? 'dark' : 'light');
    if (!savedTheme) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            document.body.classList.toggle('dark-mode', e.matches);
            updateThemeIcon(e.matches ? 'dark' : 'light');
        });
    }
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDarkMode = !document.body.classList.contains('dark-mode');
            document.body.classList.toggle('dark-mode', isDarkMode);
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            updateThemeIcon(isDarkMode ? 'dark' : 'light');
        });
    }
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const socialLimitInput = document.getElementById('social-limit');
    const videoLimitInput = document.getElementById('video-limit');
    const workMinimumInput = document.getElementById('work-minimum');
    const saveButton = document.getElementById('saveButton');
    const statusMessage = document.getElementById('statusMessage');
    const apiKeyInput = document.getElementById('api-key');
    const toggleApiKeyBtn = document.getElementById('toggleApiKey');
    const apiKeyStatus = document.getElementById('apiKeyStatus');

    if (toggleApiKeyBtn) {
        toggleApiKeyBtn.addEventListener('click', () => {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                toggleApiKeyBtn.textContent = 'Hide';
            } else {
                apiKeyInput.type = 'password';
                toggleApiKeyBtn.textContent = 'Show';
            }
        });
    }

    const loadSettings = async () => {
        const result = await chrome.storage.sync.get(['userGoals']);
        if (result.userGoals) {
            socialLimitInput.value = result.userGoals.socialLimit || '';
            videoLimitInput.value = result.userGoals.videoLimit || '';
            workMinimumInput.value = result.userGoals.workMinimum || '';
        }
        const apiKey = await getApiKey();
        if (apiKey) {
            apiKeyInput.value = apiKey;
            apiKeyStatus.textContent = '✅';
        } else {
            apiKeyStatus.textContent = '❌';
        }
    };

    const saveSettings = async () => {
        saveButton.disabled = true;
        saveButton.textContent = 'Verifying...';

        const apiKey = apiKeyInput.value.trim();
        const isVerified = await verifyApiKey(apiKey);

        if (isVerified) {
            await setApiKey(apiKey);
            showStatus('API Key Verified and Saved!', 'success');
            apiKeyInput.classList.add('success');
            apiKeyStatus.textContent = '✅';
            setTimeout(() => apiKeyInput.classList.remove('success'), 1500);
        } else {
            showStatus('API Key is invalid.', 'error');
            apiKeyInput.classList.add('error');
            apiKeyStatus.textContent = '❌';
            setTimeout(() => apiKeyInput.classList.remove('error'), 1500);
        }

        const goals = {
            socialLimit: parseInt(socialLimitInput.value, 10) || 0,
            videoLimit: parseInt(videoLimitInput.value, 10) || 0,
            workMinimum: parseInt(workMinimumInput.value, 10) || 0,
        };
        await chrome.storage.sync.set({ userGoals: goals });

        saveButton.disabled = false;
        saveButton.textContent = 'Save Settings';
    };

    const showStatus = (message, type) => {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        setTimeout(() => statusMessage.className = 'status-message', 3000);
    };

    saveButton?.addEventListener('click', saveSettings);

    initTheme();
    loadSettings();
});
