document.addEventListener('DOMContentLoaded', () => {
    const socialLimitInput = document.getElementById('socialLimit');
    const videoLimitInput = document.getElementById('videoLimit');
    const workMinimumInput = document.getElementById('workMinimum');
    const saveButton = document.getElementById('saveGoals');
    const statusMessage = document.getElementById('statusMessage');

    // Load existing goals from storage
    const loadGoals = () => {
        chrome.storage.local.get(['userGoals'], (result) => {
            if (result.userGoals) {
                socialLimitInput.value = result.userGoals.socialLimit || '';
                videoLimitInput.value = result.userGoals.videoLimit || '';
                workMinimumInput.value = result.userGoals.workMinimum || '';
            }
        });
    };

    // Save goals to storage
    const saveGoals = () => {
        const goals = {
            socialLimit: parseInt(socialLimitInput.value, 10) || 0,
            videoLimit: parseInt(videoLimitInput.value, 10) || 0,
            workMinimum: parseInt(workMinimumInput.value, 10) || 0,
        };

        chrome.storage.local.set({ userGoals: goals }, () => {
            showStatus('Goals saved successfully!', 'success');
        });
    };

    // Show a status message
    const showStatus = (message, type) => {
        statusMessage.textContent = message;
        statusMessage.style.backgroundColor = type === 'success' ? '#d1fae5' : '#fee2e2';
        statusMessage.style.color = type === 'success' ? '#065f46' : '#991b1b';
        statusMessage.style.opacity = 1;

        setTimeout(() => {
            statusMessage.style.opacity = 0;
        }, 3000);
    };

    saveButton.addEventListener('click', saveGoals);
    loadGoals();
});