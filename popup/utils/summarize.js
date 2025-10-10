export async function summarizeCurrentPage() {
  const btn = document.getElementById('summarizeBtn');
  const original = btn.textContent;
  try {
    btn.textContent = '⏳ Summarizing...';
    btn.disabled = true;
    const out = document.getElementById('output');
    out.style.display = 'block';
    out.innerText = '🔄 Summarizing current page...';
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const node = document.querySelector('article') || document.querySelector('main') || document.body;
        return { text: node?.innerText?.trim()?.replace(/\s+/g, ' ').slice(0, 20000) || '', title: document.title };
      }
    });
    if (!result?.text) { out.innerText = 'No readable content found on this page.'; return; }
    if (!chrome.ai?.summarizer) {
      const sentences = result.text.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
      out.innerText = `📰 ${result.title}\n\n${sentences}`;
      return;
    }
    const summary = await chrome.ai.summarizer.summarize({ input: `Title: ${result.title}\n\nContent:\n${result.text}\n\nSummarize in 3 concise bullet points.` });
    out.innerText = `📰 ${result.title}\n\n${summary.output}`;
  } catch (e) {
    document.getElementById('output').innerText = `❌ Summarization failed: ${e.message}`;
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}


