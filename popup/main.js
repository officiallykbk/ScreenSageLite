alert("loading main.js");
import { loadRecentData, setupEventListeners } from './ui.js';
import { updateStreakDisplay } from './streak.js';

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadRecentData();
  updateStreakDisplay();
});
