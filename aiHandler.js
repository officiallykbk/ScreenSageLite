import { CONFIG, safeAI, getApiKey } from "./config.js";

// Standardized response format
const DEFAULT_RESPONSE = {
  content: "No summary available.",
  tip: "Stay consistent — small progress adds up!"
};

/* ------------------------------
 🧠 1. Check if built-in Chrome AI (Gemini Nano) is available
------------------------------ */
// NOTE: Built-in `window.ai` is only present in page contexts (tabs).
// We'll attempt to run the summarizer in the active tab via chrome.scripting.executeScript
// instead of checking window.ai from the extension/popup context where it will be undefined.

/* ------------------------------
 ⚙️ 2. Built-in AI Path (Gemini Nano)
------------------------------ */
async function useBuiltInAI(domains) {
  // Query the active tab and execute a script there to access window.ai
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found to run built-in AI');

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (text) => {
      // This function runs inside the page (tab) where window.ai may exist
      if (typeof window.ai === 'undefined') return { error: 'unavailable' };

      try {
        // Prefer summarizer if available
        const summAvail = typeof window.ai.summarizer?.availability === 'function'
          ? await window.ai.summarizer.availability()
          : 'unavailable';

        if (summAvail === 'after-download') {
          return { status: 'after-download' };
        }

        if (summAvail !== 'readily') {
          return { error: `summarizer:${summAvail}` };
        }

        const summarizer = await window.ai.summarizer.create();
        const sumRes = await summarizer.summarize({ text });

        // Try to get a short tip via languageModel if available
        let tip = null;
        try {
          const lmAvail = typeof window.ai.languageModel?.availability === 'function'
            ? await window.ai.languageModel.availability()
            : 'unavailable';
          if (lmAvail === 'readily') {
            const model = await window.ai.languageModel.create();
            tip = await model.prompt(`Based on this browsing summary: ${text} Give a friendly productivity tip in one short sentence.`);
          }
        } catch (e) {
          // ignore; tip is optional
        }

        return { summary: sumRes?.summary || null, tip };
      } catch (err) {
        return { error: err?.message || String(err) };
      }
    },
    args: [domains]
  });

  if (!result) throw new Error('No result from page context while attempting built-in AI');
  if (result.status === 'after-download') {
    return { content: "⌛ Gemini Nano is downloading. This may take a moment. Please try again shortly!", tip: DEFAULT_RESPONSE.tip };
  }
  if (result.error) {
    throw new Error(result.error);
  }

  return {
    content: result.summary || DEFAULT_RESPONSE.content,
    tip: result.tip || DEFAULT_RESPONSE.tip
  };
}

/* ------------------------------
 ☁️ 3. Gemini Flash 2.5 Fallback (Cloud)
------------------------------ */
async function useGeminiFallback(domains) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("No Gemini API key found. Please set your API key in the extension options.");
  }

  const prompt = `
Here's a summary of my browsing activity today:
${domains}

Summarize my digital habits in 2–3 sentences and then suggest one short productivity tip.
Format the response as:
Summary: ...
Tip: ...
`;

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    "No response received.";

  // Smart split between summary and tip
  const summaryMatch = text.match(/Summary:\s*([\s\S]*?)(?=Tip:|$)/i);
  const tipMatch = text.match(/Tip:\s*(.*)/i);

  const summary = summaryMatch ? summaryMatch[1].trim() : text;
  const tip = tipMatch ? tipMatch[1].trim() : "";

  return {
    content: summary || "Could not generate a summary.",
    tip: tip || "Take regular breaks to stay productive!",
  };
}

/* ------------------------------
 🚀 4. Smart Dispatcher
------------------------------ */
export async function generateReflection(domains) {
  // Try built-in AI (executed inside the active tab) first
  try {
    const built = await useBuiltInAI(domains);
    // If built-in returns a message about downloading, it already returns a content string
    if (built && built.content) {
      console.log("🧠 Using built-in Gemini Nano (local)");
      return built;
    }
  } catch (err) {
    console.warn('Built-in AI attempt failed, falling back to cloud:', err.message || err);
    // Continue to cloud fallback
  }

  console.log("☁️ Using Gemini Flash 2.5 (cloud fallback)");
  try {
    return await useGeminiFallback(domains);
  } catch (error) {
    if (error.message.includes("No Gemini API key")) {
      return {
        content: "The built-in AI is not available, and no cloud API key has been set.",
        tip: "Please add your Gemini API key in the settings to enable cloud-based summaries."
      };
    }
    throw error;
  }
}

/* ------------------------------
 🔑 5. API Key Verification (v1 Stable)
------------------------------ */
export async function verifyApiKey(apiKey) {
  if (!apiKey) {
    console.error("❌ No API key provided");
    return false;
  }

  // Use the stable v1 endpoint instead of v1beta
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
  console.log("Verifying API key via:", url.replace(apiKey, "API_KEY_REDACTED"));

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    // Handle network / auth errors
    if (!response.ok) {
      const errorMessage =
        data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      console.error("❌ API key verification failed:", errorMessage);
      return false;
    }

    // Check that we actually got model data back
    if (!data.models || !Array.isArray(data.models)) {
      console.warn("⚠️ Unexpected API response:", data);
      return false;
    }

    console.log("✅ API key verified successfully — Gemini models available!");
    return true;
  } catch (error) {
    console.error("💥 API key verification error:", error.message);
    return false;
  }
}
