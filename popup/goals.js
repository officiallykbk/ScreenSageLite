import { getStoredData, getCategoryMapping } from './data.js';

export async function checkGoals() {
    const { userGoals, usage } = await getStoredData(['userGoals', 'usage']);
    if (!userGoals || !usage) {
        return null;
    }

    const categoryMapping = getCategoryMapping();
    const categoryTotals = {
        Social: 0,
        Video: 0,
        Work: 0,
    };

    // Calculate time spent in each goal-related category
    for (const [domain, ms] of Object.entries(usage)) {
        const category = categoryMapping(domain);
        if (categoryTotals.hasOwnProperty(category)) {
            categoryTotals[category] += ms;
        }
    }

    const results = [];
    const toMinutes = (ms) => Math.floor(ms / 60000);

    // Check against goals
    if (userGoals.socialLimit > 0) {
        const spent = toMinutes(categoryTotals.Social);
        results.push({
            name: 'Social Media',
            type: 'limit',
            spent,
            goal: userGoals.socialLimit,
            achieved: spent <= userGoals.socialLimit,
        });
    }

    if (userGoals.videoLimit > 0) {
        const spent = toMinutes(categoryTotals.Video);
        results.push({
            name: 'Video',
            type: 'limit',
            spent,
            goal: userGoals.videoLimit,
            achieved: spent <= userGoals.videoLimit,
        });
    }

    if (userGoals.workMinimum > 0) {
        const spent = toMinutes(categoryTotals.Work);
        results.push({
            name: 'Productivity',
            type: 'minimum',
            spent,
            goal: userGoals.workMinimum,
            achieved: spent >= userGoals.workMinimum,
        });
    }

    return results;
}