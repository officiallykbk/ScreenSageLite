// popup/settings.js
document.addEventListener('DOMContentLoaded', () => {
    const goalsForm = document.getElementById('goals-form');
    const maxSocialMediaInput = document.getElementById('max-social-media');
    const minProductivityInput = document.getElementById('min-productivity');
    const saveButton = goalsForm.querySelector('.action-btn');

    // Load existing goals from storage
    chrome.storage.sync.get(['goals'], (result) => {
        if (result.goals) {
            maxSocialMediaInput.value = result.goals.maxSocialMediaTime || '';
            minProductivityInput.value = result.goals.minProductivityTime || '';
        }
    });

    // Handle form submission
    goalsForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const goals = {
            maxSocialMediaTime: parseInt(maxSocialMediaInput.value, 10) || 0,
            minProductivityTime: parseInt(minProductivityInput.value, 10) || 0,
        };

        chrome.storage.sync.set({ goals }, () => {
            // Provide feedback to the user
            saveButton.textContent = 'Saved!';
            setTimeout(() => {
                saveButton.textContent = 'Save Goals';
            }, 1500);
        });
    });
});
