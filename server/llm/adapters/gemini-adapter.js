import { config } from "../config.js";

export class GeminiAdapter {
  constructor(timedFetch) {
    this.timedFetch = timedFetch;
    this.providerId = "gemini";
  }

  isConfigured() {
    return Boolean(config.geminiApiKey);
  }

  async complete(prompt) {
    if (!this.isConfigured()) {
      const err = new Error("GEMINI_KEY_MISSING");
      err.code = "GEMINI_KEY_MISSING";
      throw err;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
    const res = await this.timedFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.58, maxOutputTokens: 190 }
      })
    });
    if (!res.ok) {
      const err = new Error(`GEMINI_${res.status}`);
      err.status = res.status;
      err.details = await res.text().catch(() => "");
      throw err;
    }
    const data = await res.json();
    const text = (data?.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => part?.text || "")
      .join("\n")
      .trim();
    return { provider: "gemini", text };
  }
}
