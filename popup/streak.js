export function updateStreakDisplay() {
  chrome.storage.local.get(['streakData'], (result) => {
    const streakData = result.streakData || { current: 0, lastActive: null };
    const today = new Date().toDateString();
    let currentStreak = 0;
    if (streakData.lastActive === today) {
      currentStreak = streakData.current;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      if (streakData.lastActive === yesterdayStr) currentStreak = (streakData.current || 0) + 1;
      else currentStreak = 1;
      chrome.storage.local.set({ streakData: { current: currentStreak, lastActive: today } });
    }
    if (currentStreak > 0) addStreakIndicator(currentStreak);
  });
}

function addStreakIndicator(currentStreak) {
  const container = document.querySelector('.container');
  const existing = document.getElementById('streakIndicator');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'streakIndicator';
  el.style.cssText = 'background:linear-gradient(45deg,#ff6b6b,#ffa500);color:#fff;padding:8px 12px;border-radius:20px;font-size:12px;font-weight:bold;text-align:center;margin-bottom:10px;box-shadow:0 2px 4px rgba(0,0,0,0.2)';
  el.textContent = `🔥 ${currentStreak}-day productivity streak!`;
  const h1 = container.querySelector('h1');
  h1.insertAdjacentElement('afterend', el);
}
