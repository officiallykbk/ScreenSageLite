// import { getApiKey, setApiKey } from './config.js';
// import { verifyApiKey } from './aiHandler.js';

// function initTheme() {
//     const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
//     const savedTheme = localStorage.getItem('theme');
//     const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
//     document.body.classList.toggle('dark-mode', isDark);
//     updateThemeIcon(isDark ? 'dark' : 'light');
//     if (!savedTheme) {
//         window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
//             document.body.classList.toggle('dark-mode', e.matches);
//             updateThemeIcon(e.matches ? 'dark' : 'light');
//         });
//     }
//     const themeToggle = document.getElementById('themeToggle');
//     if (themeToggle) {
//         themeToggle.addEventListener('click', () => {
//             const isDarkMode = !document.body.classList.contains('dark-mode');
//             document.body.classList.toggle('dark-mode', isDarkMode);
//             localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
//             updateThemeIcon(isDarkMode ? 'dark' : 'light');
//         });
//     }
// }

// function updateThemeIcon(theme) {
//     const themeIcon = document.querySelector('.theme-icon');
//     if (themeIcon) {
//         themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
//     }
// }

// document.addEventListener('DOMContentLoaded', async () => {
//     // Input elements
//     const socialLimitInput = document.getElementById('social-limit');
//     const videoLimitInput = document.getElementById('video-limit');
//     const workMinimumInput = document.getElementById('work-minimum');
//     const apiKeyInput = document.getElementById('apiKey');
//     const toggleApiKeyBtn = document.getElementById('toggleApiKey');
//     const statusMessage = document.getElementById('statusMessage');
//     const saveButton = document.getElementById('saveButton');

//     if (toggleApiKeyBtn) {
//         toggleApiKeyBtn.addEventListener('click', () => {
//             if (apiKeyInput.type === 'password') {
//                 apiKeyInput.type = 'text';
//                 toggleApiKeyBtn.textContent = 'Hide';
//             } else {
//                 apiKeyInput.type = 'password';
//                 toggleApiKeyBtn.textContent = 'Show';
//             }
//         });
//     }

//     const loadSettings = async () => {
//         const result = await chrome.storage.sync.get(['userGoals']);
//         if (result.userGoals) {
//             socialLimitInput.value = result.userGoals.socialLimit || '';
//             videoLimitInput.value = result.userGoals.videoLimit || '';
//             workMinimumInput.value = result.userGoals.workMinimum || '';
//         }
//         const apiKey = await getApiKey();
//         if (apiKey) {
//             apiKeyInput.value = apiKey;
//             apiKeyStatus.textContent = '✅';
//         } else {
//             apiKeyStatus.textContent = '❌';
//         }
//     };

//     const saveSettings = async () => {
//         try {
//             console.log('saveSettings called');
            
//             // Log all input elements
//             console.log('Input elements:', {
//                 socialLimitInput: !!socialLimitInput,
//                 videoLimitInput: !!videoLimitInput,
//                 workMinimumInput: !!workMinimumInput,
//                 apiKeyInput: !!apiKeyInput,
//                 statusMessage: !!statusMessage,
//                 saveButton: !!saveButton
//             });

//             if (!saveButton) {
//                 console.error('Save button not found in the DOM');
//                 return;
//             }

//             saveButton.disabled = true;
//             saveButton.textContent = 'Verifying...';

//             // Verify API key if the input exists
//             if (apiKeyInput) {
//                 const apiKey = apiKeyInput.value.trim();
//                 if (apiKey) {
//                     const isVerified = await verifyApiKey(apiKey);
//                     if (isVerified) {
//                         await setApiKey(apiKey);
//                         showStatus('API Key Verified and Saved!', 'success');
//                         apiKeyInput.classList.add('success');
//                         setTimeout(() => apiKeyInput.classList.remove('success'), 1500);
//                     } else {
//                         showStatus('API Key is invalid.', 'error');
//                         apiKeyInput.classList.add('error');
//                         setTimeout(() => apiKeyInput.classList.remove('error'), 1500);
//                     }
//                 }
//             }

//             // Save goals if the inputs exist
//             const goals = {};
            
//             if (socialLimitInput) {
//                 console.log('socialLimitInput value:', socialLimitInput.value);
//                 goals.socialLimit = parseInt(socialLimitInput.value, 10) || 0;
//             } else {
//                 console.log('socialLimitInput is null or undefined');
//             }
            
//             if (videoLimitInput) {
//                 console.log('videoLimitInput value:', videoLimitInput.value);
//                 goals.videoLimit = parseInt(videoLimitInput.value, 10) || 0;
//             } else {
//                 console.log('videoLimitInput is null or undefined');
//             }
            
//             if (workMinimumInput) {
//                 console.log('workMinimumInput value:', workMinimumInput.value);
//                 goals.workMinimum = parseInt(workMinimumInput.value, 10) || 0;
//             } else {
//                 console.log('workMinimumInput is null or undefined');
//             }

//             if (Object.keys(goals).length > 0) {
//                 await chrome.storage.sync.set({ userGoals: goals });
//             }

//         } catch (error) {
//             console.error('Error saving settings:', {
//                 error: error.message,
//                 stack: error.stack,
//                 lineNumber: error.lineNumber,
//                 columnNumber: error.columnNumber
//             });
//             showStatus('Failed to save settings. Please try again.', 'error');
//         } finally {
//             if (saveButton) {
//                 saveButton.disabled = false;
//                 saveButton.textContent = 'Save Settings';
//             }
//         }
//     };

//     const showStatus = (message, type) => {
//         if (!statusMessage) {
//             console.log(`[Status: ${type}] ${message}`);
//             return;
//         }
//         statusMessage.textContent = message;
//         statusMessage.className = `status-message ${type}`;
//         setTimeout(() => {
//             if (statusMessage) {
//                 statusMessage.className = 'status-message';
//             }
//         }, 3000);
//     };

//     saveButton?.addEventListener('click', saveSettings);

//     initTheme();
//     loadSettings();
// });
