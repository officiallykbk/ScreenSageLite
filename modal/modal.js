document.addEventListener('DOMContentLoaded', () => {
    const titleEl = document.getElementById('modal-title');
    const contentEl = document.getElementById('modal-content');
    const copyBtn = document.getElementById('copy-btn');

    // Get the AI-generated text and title from the URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const title = urlParams.get('title');
    const content = urlParams.get('content');

    if (title) {
        titleEl.textContent = title;
    }
    if (content) {
        contentEl.textContent = content;
    }

    // Handle the "Copy to Clipboard" button click
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy to Clipboard';
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            copyBtn.textContent = 'Failed to Copy';
        });
    });
});
