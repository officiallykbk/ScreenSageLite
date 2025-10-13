import { getUsageData } from './storage.js';

async function generateAIAnalysis(summaryText) {
    if (!chrome.ai?.summarizer || !chrome.ai?.prompt) {
        throw new Error("AI APIs not available");
    }
    const goals = await new Promise((resolve) => {
        chrome.storage.local.get(['userGoals'], (result) => {
            resolve(result.userGoals || {});
        });
    });
    const goalsContext = goals.socialLimit || goals.workMinimum ?
        `\n\nUser Goals:\n${goals.socialLimit ? `- Social media limit: ${goals.socialLimit} minutes\n` : ''}${goals.workMinimum ? `- Work/research minimum: ${goals.workMinimum} minutes\n` : ''}` : '';
    const [summary, tip] = await Promise.all([
        chrome.ai.summarizer.summarize({
            input: `Here is my browsing activity for today:\n${summaryText}${goalsContext}\n
        Please provide a brief, insightful summary (2-3 sentences) of my browsing habits.
        Focus on patterns, productivity, and balance. Be constructive and non-judgmental.
        If goals are set, compare actual usage against those goals.`
        }),
        chrome.ai.prompt.generate({
            input: `Based on this browsing data:\n${summaryText}${goalsContext}\n
        Generate one short, practical tip (1 sentence) to improve digital wellbeing or productivity tomorrow.
        Make it supportive and actionable. If goals are set, reference them in your tip.`
        })
    ]);
    return formatAIResponse(summary.output, tip.output, goals);
}

function formatAIResponse(summary, tip, goals) {
    let response = `📊 Daily Browsing Summary:\n${summary}\n\n`;
    if (goals.socialLimit || goals.workMinimum) {
        response += `🎯 Goal Check:\n`;
        if (goals.socialLimit) {
            response += `• Social media limit: ${goals.socialLimit} min\n`;
        }
        if (goals.workMinimum) {
            response += `• Work/research minimum: ${goals.workMinimum} min\n`;
        }
        response += `\n`;
    }
    response += `💡 Tomorrow's Tip:\n${tip}`;
    return response;
}

export { generateAIAnalysis, formatAIResponse };