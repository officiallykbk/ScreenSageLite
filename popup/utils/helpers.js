export function truncateDomain(domain, maxLength = 20) {
  if (domain.length <= maxLength) return domain;
  return domain.substring(0, maxLength - 3) + '...';
}

export function buildCategoryTotals(usage) {
  const mapping = getCategoryMapping();
  const categoryTotals = { Work: 0, Social: 0, Video: 0, Shopping: 0, News: 0, Other: 0 };
  for (const [domain, ms] of Object.entries(usage)) {
    const cat = mapping(domain);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + ms;
  }
  return { categoryTotals };
}

function getCategoryMapping() {
  const social = ['twitter.com','x.com','facebook.com','instagram.com','tiktok.com','reddit.com','pinterest.com'];
  const video = ['youtube.com','vimeo.com','twitch.tv','netflix.com','hulu.com'];
  const work = ['github.com','gitlab.com','stackoverflow.com','notion.so','notion.site','docs.google.com','drive.google.com','figma.com','slack.com'];
  const shopping = ['amazon.com','ebay.com','etsy.com','aliexpress.com','bestbuy.com'];
  const news = ['nytimes.com','cnn.com','bbc.com','theverge.com','wsj.com','bloomberg.com'];
  return (domain) => {
    const d = domain.toLowerCase();
    if (social.some(s => d.endsWith(s))) return 'Social';
    if (video.some(s => d.endsWith(s))) return 'Video';
    if (work.some(s => d.endsWith(s))) return 'Work';
    if (shopping.some(s => d.endsWith(s))) return 'Shopping';
    if (news.some(s => d.endsWith(s))) return 'News';
    return 'Other';
  };
}

export function buildGentleNudges(categoryTotals) {
  const nudges = [];
  const toMin = (ms) => Math.round(ms / 60000);
  if (categoryTotals.Social > 60 * 60000) nudges.push(`High social time (${toMin(categoryTotals.Social)} min). Consider batching checks.`);
  if (categoryTotals.Video > 90 * 60000) nudges.push(`Lots of video (${toMin(categoryTotals.Video)} min). Try a timer for intentional breaks.`);
  if (categoryTotals.Work < 45 * 60000) nudges.push(`Low focus time (${toMin(categoryTotals.Work)} min). Block a 25-min deep work session.`);
  return nudges;
}

export function setLoadingState(isLoading) {
  const reflection = document.getElementById('reflectionContent');
  const goals = document.getElementById('goalsContent');
  if (!reflection || !goals) return;
  if (isLoading) {
    reflection.classList.add('skeleton');
    goals.classList.add('skeleton');
    reflection.textContent = '';
    goals.textContent = '';
  } else {
    reflection.classList.remove('skeleton');
    goals.classList.remove('skeleton');
  }
}

export function showErrorCard(message) {
  const card = document.getElementById('errorCard');
  if (!card) return;
  if (!message) { card.style.display = 'none'; card.textContent = ''; return; }
  card.style.display = 'block';
  card.textContent = message;
}

export function updateSection(id, content) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('skeleton');
  el.textContent = content;
}

export async function generateAIAnalysis(summaryText) {
  if (!chrome.ai?.summarizer || !chrome.ai?.prompt) throw new Error('AI APIs not available');
  const goals = await new Promise((resolve) => { chrome.storage.local.get(['userGoals'], (r)=> resolve(r.userGoals||{})); });
  const goalsContext = goals.socialLimit || goals.workMinimum ? `\n\nUser Goals:\n${goals.socialLimit?`- Social media limit: ${goals.socialLimit} minutes\n`:''}${goals.workMinimum?`- Work/research minimum: ${goals.workMinimum} minutes\n`:''}` : '';
  const [summary, tip] = await Promise.all([
    chrome.ai.summarizer.summarize({ input: `Here is my browsing activity for today:\n${summaryText}${goalsContext}\n\nPlease provide a brief, insightful summary (2-3 sentences) of my browsing habits. Focus on patterns, productivity, and balance. Be constructive and non-judgmental. If goals are set, compare actual usage against those goals.` }),
    chrome.ai.prompt.generate({ input: `Based on this browsing data:\n${summaryText}${goalsContext}\n\nGenerate one short, practical tip (1 sentence) to improve digital wellbeing or productivity tomorrow. Make it supportive and actionable. If goals are set, reference them in your tip.` })
  ]);
  return formatAIResponse(summary.output, tip.output, goals);
}

export function formatAIResponse(summary, tip, goals) {
  let response = `📊 Daily Browsing Summary:\n${summary}\n\n`;
  if (goals.socialLimit || goals.workMinimum) {
    response += `🎯 Goal Check:\n`;
    if (goals.socialLimit) response += `• Social media limit: ${goals.socialLimit} min\n`;
    if (goals.workMinimum) response += `• Work/research minimum: ${goals.workMinimum} min\n`;
    response += `\n`;
  }
  response += `💡 Tomorrow's Tip:\n${tip}`;
  return response;
}

export function generateManualAnalysis(domains, totalTime) {
  const topDomain = domains[0];
  const totalMinutes = (totalTime / 60000).toFixed(1);
  const topDomainMinutes = (topDomain[1] / 60000).toFixed(1);
  const topDomainPercentage = ((topDomain[1] / totalTime) * 100).toFixed(1);
  let insight = '';
  if (totalMinutes > 240) insight = "You've spent significant time online today. Consider taking regular screen breaks tomorrow.";
  else if (domains.length > 15) insight = 'You visited many different sites. Focusing on fewer tasks might boost productivity.';
  else if (parseFloat(topDomainPercentage) > 50) insight = `You focused heavily on ${topDomain[0]}. Great for deep work!`;
  else insight = 'Your browsing looks balanced today. Keep up the good habits!';
  return `📈 Manual Analysis:\nTotal: ${totalMinutes} min | Sites: ${domains.length}\nTop: ${topDomain[0]} (${topDomainMinutes} min)\n\n💡 Insight:\n${insight}`;
}
