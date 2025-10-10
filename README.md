# 🦉 ScreenSage Lite

A privacy-first Chrome extension that tracks your browsing habits and provides AI-powered insights to help you build better digital habits.

## ✨ Features

### 🎯 **Goal-Based Tracking**
- Set personalized daily goals (social media limits, work minimums)
- Get AI feedback comparing your actual usage against your goals
- Track productivity streaks to stay motivated

### 📊 **Smart Analytics**
- Visual pie chart showing time spent per website
- AI-powered daily summaries with personalized tips
- Export your data anytime (JSON format)

### 🔒 **Privacy-First**
- All data stays on your device (no cloud sync)
- No tracking of personal information
- Local storage only - you're in complete control

### ✍️ **Writing Assistant**
- Right-click any selected text → "Polish with ScreenSage"
- Uses Chrome's built-in AI to improve your writing
- Perfect for emails, documents, and more

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