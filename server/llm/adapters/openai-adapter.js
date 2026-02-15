import { config } from "../config.js";

export class OpenAIAdapter {
  constructor(timedFetch) {
    this.timedFetch = timedFetch;
    this.providerId = "openai";
  }

  isConfigured() {
    return Boolean(config.openaiApiKey);
  }

  async complete(prompt) {
    if (!this.isConfigured()) {
      const err = new Error("OPENAI_KEY_MISSING");
      err.code = "OPENAI_KEY_MISSING";
      throw err;
    }

    const res = await this.timedFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: config.openaiModel,
        temperature: 0.62,
        max_tokens: 190,
        messages: [
          { role: "system", content: "Return strict JSON only with keys: npc_text,intent,time_cost_seconds,suggested_state_effects." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!res.ok) {
      const err = new Error(`OPENAI_${res.status}`);
      err.status = res.status;
      err.details = await res.text().catch(() => "");
      throw err;
    }

    const data = await res.json();
    return {
      provider: "openai",
      text: data?.choices?.[0]?.message?.content || ""
    };
  }
}
