// ScreenSage Lite Configuration (v1 Stable)
export const CONFIG = {
    // API Configuration
    API: {
        BASE_URL: 'https://generativelanguage.googleapis.com/v1/models/',
        MODEL: 'gemini-1.5-flash',  // Use latest stable model
        GENERATION_CONFIG: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            stopSequences: []
        },
        SAFETY_SETTINGS: [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
    },

    // Extension Behavior
    BEHAVIOR: {
        IDLE_THRESHOLD_MINUTES: 10,  // Time before considering user idle
        SUMMARY_INTERVAL_MINUTES: 30, // How often to generate summaries
        MAX_SUMMARY_ITEMS: 10,       // Max number of items to include in summary
        AI_CHECK_TIMEOUT: 2000,      // 2 seconds timeout for AI availability check
        PROMPT: `You are ScreenSage, a helpful AI assistant.
                 Summarize the following browsing activity in a concise,
                 insightful way. Highlight key topics and important information.`
    },

    // Storage Keys
    STORAGE_KEYS: {
        ACTIVITY_LOG: 'activityLog',
        LAST_SUMMARY_TIME: 'lastSummaryTime',
        USER_PREFERENCES: 'userPreferences',
        GEMINI_API_KEY: 'geminiApiKey'
    },

    // Default User Preferences
    DEFAULT_PREFERENCES: {
        theme: 'light',  // 'light' or 'dark'
        notifications: true,
        autoSummary: true,
        summaryTime: '20:00'  // Default summary time (24h format)
    }
};

// Safe wrapper for AI API calls with timeout
export async function safeAI(apiCall, timeout = CONFIG.BEHAVIOR.AI_CHECK_TIMEOUT) {
    return Promise.race([
        apiCall(),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI check timeout')), timeout)
        )
    ]);
}

// Get API key from storage
export async function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(
            [CONFIG.STORAGE_KEYS.GEMINI_API_KEY],
            (result) => resolve(result[CONFIG.STORAGE_KEYS.GEMINI_API_KEY] || '')
        );
    });
}

// Set API key in storage
export async function setApiKey(apiKey) {
    return new Promise((resolve) => {
        chrome.storage.local.set(
            { [CONFIG.STORAGE_KEYS.GEMINI_API_KEY]: apiKey },
            () => resolve()
        );
    });
}
