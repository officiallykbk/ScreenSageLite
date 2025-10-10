import { loadInitialData, setupEventListeners } from './ui.js';

/**
 * Initializes the popup application.
 */
function main() {
    // Make sure the DOM is fully loaded before interacting with it.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        loadInitialData();
        setupEventListeners();
    }
}

main();