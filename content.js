/**
 * @file content.js
 * @description This script is injected into active tabs to handle context menu AI actions.
 * It runs in the foreground, allowing it to access window.ai APIs, and creates a modal
 * to display the results of proofreading or rewriting text.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CONTEXT_MENU_COMMAND') {
        handleContextMenuAction(request.menuItemId, request.selectionText);
    }
});

async function handleContextMenuAction(menuItemId, selectionText) {
    let title = '';

    if (menuItemId === "proofreadText") {
        title = '✅ Proofread Text';
    } else if (menuItemId === "rewriteText") {
        title = '✍️ Rewritten Text';
    } else {
        return; // Unknown command
    }

    showModal(title, '🧠 Thinking...'); // Show loading state

    try {
        // Send request to background script
        const response = await chrome.runtime.sendMessage({
            type: 'PROCESS_TEXT',
            menuItemId,
            selectionText
        });

        if (response.error) {
            throw new Error(response.error);
        }

        // If it's a cloud response, add indicator
        const finalTitle = response.isCloud ? title + ' (Cloud)' : title;
        updateModalContent(finalTitle, response.text);

    } catch (err) {
        console.warn("Text processing failed:", err);
        updateModalContent(
            'Note 💭',
            `AI assistance is currently unavailable.\n\n${err.message}`
        );
    }
}

function showModal(title, content) {
    // Remove existing modal first
    const existingModal = document.getElementById('screensage-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'screensage-modal';
    modal.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 350px;
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        z-index: 99999;
        font-family: 'Inter', sans-serif;
        color: #333;
        transition: transform 0.3s ease-out, opacity 0.3s ease-out;
        transform: translateY(-20px);
        opacity: 0;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #f0f0f0;
        font-weight: 600;
        font-size: 16px;
    `;
    header.id = 'screensage-modal-header'; // --- NEW --- Add ID for direct targeting.
    header.textContent = title;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #888;
        padding: 0;
        line-height: 1;
    `;
    closeButton.onclick = () => {
        modal.style.transform = 'translateY(-20px)';
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    };

    header.appendChild(closeButton);

    const contentArea = document.createElement('div');
    contentArea.id = 'screensage-modal-content';
    contentArea.style.cssText = `
        padding: 16px;
        font-size: 14px;
        line-height: 1.6;
        max-height: 200px;
        overflow-y: auto;
        white-space: pre-wrap; /* Respect newlines */
    `;
    contentArea.textContent = content;

    modal.appendChild(header);
    modal.appendChild(contentArea);
    document.body.appendChild(modal);

    // Animate in
    setTimeout(() => {
        modal.style.transform = 'translateY(0)';
        modal.style.opacity = '1';
    }, 10);
}

function updateModalContent(title, content) {
    const modal = document.getElementById('screensage-modal');
    if (!modal) return;
    // --- MODIFIED --- Target the header and content areas by their specific IDs.
    const header = document.getElementById('screensage-modal-header');
    const contentArea = document.getElementById('screensage-modal-content');

    if (header) header.textContent = title;
    if (contentArea) contentArea.textContent = content;
}
