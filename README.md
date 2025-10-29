# 🦉 ScreenSage Lite

A **privacy-first Chrome extension** that helps you understand your browsing habits using the power of **on-device AI** — with a seamless Gemini cloud fallback.  
Your personal, mindful mentor for digital wellness 💻✨

---

## 🎥 Demo Video
👉 [Watch on YouTube](https://youtu.be/your-demo-link) *(2 min overview)*

## 🖼️ Screenshots
| Dashboard | AI Summary | Proofreader |
|------------|-------------|--------------|
| ![Dashboard](demo/dashboard.png) | ![Summary](demo/summary.png) | ![Proofreader](demo/proofreader.png) |

---

## ✨ Features

### 📊 **Daily Browsing Summary**
- Tracks how much time you spend on different websites automatically.
- Generates an AI-powered summary of your browsing day.
- Displays beautiful visual charts for time distribution.

### ✍️ **AI Writing Assistant**
- **Proofread**: Right-click selected text → *Polish with ScreenSage* (grammar + spelling fix).  
- **Rewrite**: Right-click selected text → *Rewrite with ScreenSage* (clearer, more concise version).  
- Powered by **Chrome’s built-in Gemini Nano AI** for instant, private results.

### 🎯 **Goal-Based Tracking**
- Set time limits for “Social Media” or “Video” sites.
- Set *minimum productive time* goals for “Work”.
- Get visual feedback and even celebratory confetti for hitting targets 🥳

### 💡 **Smart Insights & Nudges**
- AI-generated reflections and small productivity nudges.
- Local summaries feel instant and private, while cloud fallbacks add deeper insight.

### 🔒 **Privacy-First Architecture**
- 100% local data storage — **nothing leaves your computer**.
- On-device AI (Gemini Nano) ensures private inference.
- Cloud AI (Gemini Flash 2.5) only activates with your consent and API key.

---

## 🧠 Tech Stack

- **Frontend:** HTML, CSS (Inter Font, animated minimal UI)
- **Logic Layer:** JavaScript (ES Modules)
- **Storage:** Chrome Local Storage API
- **AI Engine:**
  - 🧩 *Primary:* Chrome Built-in AI (Gemini Nano via `window.ai`)
  - ☁️ *Fallback:* Gemini Flash 2.5 (Google AI Studio API)
- **Charting:** Chart.js
- **Animation:** Confetti.js + Parallax UI Motion

---

## 🏗️ How It Works

1. **Background Script (`background.js`)**
   - Tracks active tabs and usage time per domain.
   - Stores session data locally and manages Chrome events.

2. **Popup (`popup/main.js`)**
   - Displays charts, summaries, and goals.
   - Calls AI functions for daily digest or page summary.

3. **Content Script (`content.js`)**
   - Handles context menu commands like proofreading or rewriting.
   - Injects clean modals to show AI output instantly.

4. **AI Core (`api.js`)**
   - Uses `window.ai` (Gemini Nano) when available.
   - Falls back to Gemini Flash 2.5 through the **Generative Language API**.
   - Smartly merges both experiences for seamless results.

---

### 🔒 **Privacy-First**
- All data stays on your device (no cloud sync)
- No tracking of personal information
- Local storage only - you're in complete control

### ✍️ **Writing Assistant**
- Right-click any selected text → "Polish with ScreenSage"
- Uses Chrome's built-in AI to improve your writing
- Perfect for emails, documents, and more

1.  **Download the Extension**
```bash
git clone https://github.com/officiallykbk/ScreenSageLite.git
```
2.  **Enable Chrome's Built-in AI**
    *   You need **Google Chrome Canary (version 127 or newer)**.
    *   Open Chrome Canary and navigate to `chrome://flags`.
    *   Enable the following three flags:
        *   `#prompt-api-for-gemini-nano`
        *   `#summarizer-api-for-gemini-nano`
        *   `#proofreader-api-for-gemini-nano`
    *   Relaunch your browser after enabling the flags.
## 🚀 Quick Start

1. **Install the Extension**
   - Download or clone this repository
   - Open Chrome → Extensions → Developer mode
   - Click "Load unpacked" → Select the ScreenSageLite folder

2. **Set Your Goals**
   - Click the extension icon → ⚙️ Settings
   - Set your daily social media limit and work minimums
   - Save your preferences

3. **Start Browsing**
   - Visit websites normally - ScreenSage tracks automatically
   - Click "✨ Get Daily Digest" for AI insights
   - Use right-click → "Polish with ScreenSage" on any text

## 🎯 How It Works

### Phase 1: Basic Tracking
- Tracks time spent on each website
- Filters out Chrome internal pages and extensions
- Stores data locally with debounced saves
- Shows basic usage statistics

### Phase 2: AI-Powered Insights
- Personalized goal-based feedback
- AI analysis comparing usage against your goals
- Productivity streak tracking
- Structured "Wins" and "Areas to Improve" reports

## 🛠️ Technical Details

### Architecture
- **Background Script**: Tracks tab usage, manages storage
- **Popup Interface**: Shows analytics and AI insights
- **Settings Page**: Goal management and data controls
- **Context Menu**: Text polishing functionality

### Storage
- `usage`: Domain → time spent mapping
- `usageMeta`: Last seen timestamps for cleanup
- `userGoals`: Personal goal settings
- `streakData`: Productivity streak tracking

### AI Integration
- Uses Chrome's built-in AI APIs (Summarizer, Prompt)
- Fallback to manual analysis if AI unavailable
- Goal-aware prompting for personalized insights

## 📁 File Structure

```
ScreenSageLite/
├── manifest.json          # Extension configuration
├── background.js          # Tab tracking & storage
├── popup.html            # Main interface
├── popup.js              # Analytics & AI integration
├── options.html          # Settings page
├── options.js            # Goal management
├── style.css             # Styling
├── chart.umd.min.js      # Chart.js library
└── README.md             # This file
```

## 🔧 Development

### Prerequisites
- Chrome browser with AI APIs enabled
- Basic knowledge of Chrome extension development

### Local Development
1. Clone the repository
2. Open Chrome → Extensions → Developer mode
3. Click "Load unpacked" → Select project folder
4. Make changes and reload the extension

### Testing
- Visit various websites to generate tracking data
- Check browser console for debug logs
- Test AI features (requires Chrome with AI APIs)
- Verify goal-based feedback works correctly

## 🎯 Demo Flow (3 minutes)

1. **Setup** (30s)
   - Install extension
   - Set goals in settings (e.g., 30 min social, 60 min work)

2. **Browsing** (60s)
   - Visit a few websites
   - Switch between tabs
   - Use right-click text polishing

3. **Insights** (90s)
   - Click "Get Daily Digest"
   - See pie chart and AI analysis
   - Check goal progress and streak

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Check the browser console for debug information
- Ensure Chrome has AI APIs enabled
- Verify extension permissions are granted
- Report issues on GitHub

---

**Built with ❤️ for better digital habits**