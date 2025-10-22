// popup/settings.js
document.addEventListener('DOMContentLoaded', () => {
    const goalsForm = document.getElementById('goals-form');
    const socialLimitInput = document.getElementById('social-limit');
    const videoLimitInput = document.getElementById('video-limit');
    const workMinimumInput = document.getElementById('work-minimum');
    const saveButton = goalsForm.querySelector('.action-btn');

    // Load existing goals from chrome.storage.local
    chrome.storage.local.get(['userGoals'], (result) => {
        if (result.userGoals) {
            socialLimitInput.value = result.userGoals.socialLimit || '';
            videoLimitInput.value = result.userGoals.videoLimit || '';
            workMinimumInput.value = result.userGoals.workMinimum || '';
        }
    });

    // Handle form submission
    goalsForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const userGoals = {
            socialLimit: parseInt(socialLimitInput.value, 10) || null,
            videoLimit: parseInt(videoLimitInput.value, 10) || null,
            workMinimum: parseInt(workMinimumInput.value, 10) || null,
        };

        chrome.storage.local.set({ userGoals }, () => {
            // Provide feedback to the user
            saveButton.textContent = 'Saved!';
            setTimeout(() => {
                saveButton.textContent = 'Save Goals';
            }, 1500);
        });
    });
});
