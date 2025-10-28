import { GEMINI_API_KEY } from "./config.js";

// --- Check if built-in Chrome AI is available ---
async function hasBuiltInAI() {
  if (!window.ai) {
    return false;
  }
  try {
    const available = await window.ai.summarizer.availability();
    return available === "readily";
  } catch {
    return false;
  }
}

// --- Built-in AI Path (Gemini Nano) ---
async function useBuiltInAI(domains) {
  const summarizer = await window.ai.summarizer.create();
  const summary = await summarizer.summarize({text: domains});

  const model = await window.ai.languageModel.create();
  const tip = await model.prompt(
    `Based on this browsing summary: ${domains}.
     Give a friendly productivity tip in one line.`
  );

  return {
    summary: summary.summary,
    tip: tip
  };
}

// --- Gemini Flash 2.5 Fallback Path ---
async function useGeminiFallback(domains) {
  const prompt = `
  Here's a summary of my browsing activity today:
  ${domains}
  Summarize my digital habits in 2–3 sentences and then suggest one short productivity tip.
  `;

  const model = 'gemini-1.5-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
  const parts = text.split("\n").filter(part => part.trim() !== "");
  return { summary: parts[0] || "Could not generate a summary.", tip: parts[1] || "" };
}

// --- Smart Dispatcher ---
export async function generateReflection(domains) {
  if (await hasBuiltInAI()) {
    console.log("🧠 Using Gemini Nano (local)");
    return await useBuiltInAI(domains);
  } else {
    console.log("☁️ Using Gemini Flash 2.5 (fallback)");
    return await useGeminiFallback(domains);
  }
}
