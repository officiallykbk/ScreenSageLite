import { loadRecentData, setupEventListeners } from './ui.js';
import { updateStreakDisplay } from './streak.js';

document.addEventListener('DOMContentLoaded', () => {
  try {
    // Attach listeners first so buttons always work
    setupEventListeners();
  } catch (e) {
    console.error('Failed to setup event listeners:', e);
  }
  
  // Then do the rest, but don’t let failures break the UI
  try {
    loadRecentData();
  } catch (e) {
    console.error('Failed to load recent data:', e);
  }
  
  try {
    updateStreakDisplay();
  } catch (e) {
    console.error('Failed to update streak:', e);
  }
});
