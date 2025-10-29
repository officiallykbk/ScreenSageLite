# 🦉 ScreenSage Lite

A privacy-first Chrome extension that helps you understand your browsing habits with the power of on-device AI.

## ✨ Features

### 📊 **Daily Browsing Summary**
- Automatically tracks the time you spend on different websites.
- Generates a concise, AI-powered summary of your day's browsing activity.
- Provides a visual pie chart to see where your time goes.

### ✍️ **AI-Powered Writing Assistant**
- **Proofread:** Right-click on any selected text and choose "Polish with ScreenSage" to fix grammar and spelling errors instantly.
- **Rewrite:** Select text and choose "Rewrite with ScreenSage" to get a clearer, more concise version.
- All powered by Chrome's built-in, on-device AI for maximum privacy.

### 🎯 **Goal-Based Tracking**
- Set daily time limits for categories like "Social Media" and "Video".
- Set minimum daily goals for productive categories like "Work".
- The extension will track your progress and show you how you're doing.

### 🔒 **Privacy-First Design**
- All your browsing data is stored locally on your device.
- AI processing happens on-device, so your data never leaves your computer.
- No sign-up or personal information required.

## 🚀 Setup & Install

To get started with ScreenSage Lite, follow these steps:

1.  **Download the Extension**
    *   Clone this repository to your local machine using `git clone` or download it as a ZIP file.

2.  **Enable Chrome's Built-in AI**
    *   You need **Google Chrome Canary (version 127 or newer)**.
    *   Open Chrome Canary and navigate to `chrome://flags`.
    *   Enable the following three flags:
        *   `#prompt-api-for-gemini-nano`
        *   `#summarizer-api-for-gemini-nano`
        *   `#proofreader-api-for-gemini-nano`
    *   Relaunch your browser after enabling the flags.

3.  **Install the Extension**
    *   Navigate to `chrome://extensions`.
    *   Enable **"Developer mode"** using the toggle in the top-right corner.
    *   Click the **"Load unpacked"** button.
    *   Select the folder where you cloned or unzipped the repository.

4.  **(Optional) Add Your Gemini API Key**
    *   If you want to use the cloud-based AI as a fallback, you'll need a Gemini API key.
    *   Click the ScreenSage Lite extension icon, then click the settings gear (⚙️).
    *   Get your key from [Google AI Studio](https://aistudio.google.com/api-keys).
    *   Paste your key into the "Gemini API Key" field and click "Save Settings".

## 🤝 Contributing

Contributions are welcome! Please feel free to fork the repository, make your changes, and submit a pull request.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
