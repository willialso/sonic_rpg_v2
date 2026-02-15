import { fitBubbleLineWithLimit, hash, normalizeCharacterId, sanitizeNpcText } from "./shared.js";
import { config } from "./config.js";

function conciseLine(text = "", maxChars = 150) {
  const first = String(text || "").split(/(?<=[.!?])\s+/)[0]?.trim() || "";
  if (!first) return "";
  if (first.length <= maxChars) return first;
  return `${first.slice(0, maxChars - 1).trimEnd()}...`;
}

export class FallbackService {
  fallbackVoice(characterId, intent = "flavor", context = {}) {
    const id = normalizeCharacterId(characterId);
    const drunk = Number(context.sonic_drunk_level || 0);
    const bank = {
      sonic: drunk >= 3
        ? [
            "I am operating on bad tequila and worse ideas. If we do this, we do it loud and expensive.",
            "Buzz is perfect. Give me a reckless plan with plausible deniability and a soundtrack."
          ]
        : [
            "Pitch chaos with style or pitch silence. I do not fund boring nights.",
            "Bring a headline-level stunt and maybe I stop pretending you are background."
          ],
      luigi: ["I can hear you. Be respectful and I'll help.", "Say one nice thing and I give routes."],
      eggman: ["You again. Your route is inefficient.", "Quiz yourself: what's faster than wasting my genius?"],
      dean_cain: ["Clock is running. Deliver results.", "You enrolled to execute, not explain."],
      earthworm_jim: ["Short version: choose one move and finish.", "I will take credit later. Move now."],
      thunderhead: [
        "Bring me the filthy sorority relic and I uncork Asswine like a cursed sacrament.",
        "No proper contraband, no bottle. I run a degenerate temple with strict inventory control."
      ],
      tails: ["Move Sonic to Stadium now. Pick one route and finish.", "I can help with a best guess. Commit and keep pressure."],
      knuckles: ["Training and painin, now prove it.", "Pick a move and stand on it."]
    };
    const rows = bank[id] || ["Stay sharp."];
    const index = parseInt(hash(`${id}:${intent}:${drunk}`).slice(0, 2), 16) % rows.length;
    return rows[index];
  }

  retrievalFallback(characterId, playerInput = "", examples = [], context = {}) {
    if (!examples.length) return this.fallbackVoice(characterId, "flavor", context);
    const index = parseInt(hash(`${characterId}:${playerInput}`).slice(0, 4), 16) % examples.length;
    const picked = conciseLine(examples[index]?.line || "");
    if (!picked) return this.fallbackVoice(characterId, "flavor", context);
    return picked;
  }

  build(context, examples = [], reason = "fallback") {
    const base = context.fallbackText
      || this.retrievalFallback(context.characterId, context.playerInput, examples, context.gameContext);
    const text = fitBubbleLineWithLimit(sanitizeNpcText(base), {
      maxSentences: Number(context?.gameContext?.max_sentences_per_reply || config.maxSentencesPerReply || 2),
      maxChars: Number(context?.gameContext?.max_bubble_length_chars || config.maxBubbleLengthChars || 190)
    });
    return {
      npc_text: text,
      intent: context.intent,
      time_cost_seconds: 0,
      suggested_state_effects: reason ? { fallback_reason: reason } : {},
      source: reason === "cooldown" ? "cooldown" : "fallback"
    };
  }
}
