import { CONFIG, safeAI, getApiKey } from "./config.js";

// Standardized response format
const DEFAULT_RESPONSE = {
  content: "No summary available.",
  tip: "Stay consistent — small progress adds up!"
};

/* ------------------------------
 🧠 1. Check if built-in Chrome AI (Gemini Nano) is available
------------------------------ */
async function hasBuiltInAI() {
  if (!window.ai?.summarizer) return false;
  
  try {
    const available = await safeAI(() => window.ai.summarizer.availability());
    return available === "readily";
  } catch (error) {
    console.warn("Built-in AI check failed:", error.message);
    return false;
  }
}

/* ------------------------------
 ⚙️ 2. Built-in AI Path (Gemini Nano)
------------------------------ */
async function useBuiltInAI(domains) {
  try {
    const summarizer = await safeAI(() => window.ai.summarizer.create());
    const summary = await safeAI(() => summarizer.summarize({ text: domains }));

    let tip = DEFAULT_RESPONSE.tip;
    try {
      const model = await safeAI(() => window.ai.languageModel.create());
      tip = await safeAI(() => 
        model.prompt(
          `Based on this browsing summary: ${domains}.
          Give a friendly productivity tip in one short, casual sentence.`
        )
      ) || tip;
    } catch (error) {
      console.warn("Failed to get AI tip, using default:", error);
    }

    return {
      content: summary?.summary || DEFAULT_RESPONSE.content,
      tip: tip
    };
  } catch (error) {
    console.error("Built-in AI failed, falling back to Gemini:", error);
    throw error; // Will be caught by generateReflection
  }
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

  const url = `${CONFIG.API.BASE_URL}${CONFIG.API.MODEL}:generateContent?key=${apiKey}`;

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
    summary: summary || "Could not generate a summary.",
    tip: tip || "Take regular breaks to stay productive!",
  };
}

/* ------------------------------
 🚀 4. Smart Dispatcher
------------------------------ */
export async function generateReflection(domains) {
  if (await hasBuiltInAI()) {
    console.log("🧠 Using Gemini Nano (local)");
    return await useBuiltInAI(domains);
  } else {
    console.log("☁️ Using Gemini Flash 2.5 (cloud fallback)");
    return await useGeminiFallback(domains);
  }
}
