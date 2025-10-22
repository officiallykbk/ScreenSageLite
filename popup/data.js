export function getCategoryMapping() {
    const social = ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com', 'pinterest.com'];
    const video = ['youtube.com', 'vimeo.com', 'twitch.tv', 'netflix.com', 'hulu.com'];
    const work = ['github.com', 'gitlab.com', 'stackoverflow.com', 'notion.so', 'notion.site', 'docs.google.com', 'drive.google.com', 'figma.com', 'slack.com'];
    const shopping = ['amazon.com', 'ebay.com', 'etsy.com', 'aliexpress.com', 'bestbuy.com'];
    const news = ['nytimes.com', 'cnn.com', 'bbc.com', 'theverge.com', 'wsj.com', 'bloomberg.com'];

    return (domain) => {
        const d = domain.toLowerCase();
        if (social.some(s => d.includes(s))) return 'Social';
        if (video.some(s => d.includes(s))) return 'Video';
        if (work.some(s => d.includes(s))) return 'Work';
        if (shopping.some(s => d.includes(s))) return 'Shopping';
        if (news.some(s => d.includes(s))) return 'News';
        return 'Other';
    };
}

export function buildCategoryTotals(usage) {
    const mapping = getCategoryMapping();
    const categoryTotals = { Work: 0, Social: 0, Video: 0, Shopping: 0, News: 0, Other: 0 };

    for (const [domain, ms] of Object.entries(usage)) {
        const cat = mapping(domain);
        categoryTotals[cat] = (categoryTotals[cat] || 0) + ms;
    }
    return categoryTotals;
}

export function buildGentleNudges(categoryTotals) {
    const nudges = [];
    const toMin = (ms) => Math.round(ms / 60000);

    if (categoryTotals.Social > 60 * 60000) {
        nudges.push(`High social media time (${toMin(categoryTotals.Social)} min). Consider setting limits.`);
    }
    if (categoryTotals.Video > 90 * 60000) {
        nudges.push(`Lots of video content (${toMin(categoryTotals.Video)} min). Remember to take breaks!`);
    }
    if (categoryTotals.Work < 30 * 60000 && new Date().getHours() < 17) {
        nudges.push(`Low focus time (${toMin(categoryTotals.Work)} min). Could a short work block help?`);
    }
    return nudges;
}

export async function getStoredData(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
            resolve(result);
        });
    });
}