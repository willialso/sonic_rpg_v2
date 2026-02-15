import { normalizeCharacterId } from "./shared.js";

function sameNpcRecentTurns(turns = [], characterId = "") {
  return (turns || [])
    .filter((turn) => normalizeCharacterId(turn?.speaker || "") === normalizeCharacterId(characterId))
    .map((turn) => String(turn?.text || "").trim())
    .filter(Boolean)
    .slice(-8);
}

export class ContextBuilder {
  build(body = {}) {
    const characterId = normalizeCharacterId(body.character_id || "unknown");
    const intentContext = body.intent_context || {};
    const contract = intentContext.character_contract || null;
    const currentContext = body.current_context || body.game_context || {};
    const missionProgression = body.mission_progression || currentContext.progressive_context || {};
    const recentTurnsRaw = body.recent_turns || currentContext.recent_turns || [];
    const recentTurns = sameNpcRecentTurns(recentTurnsRaw, characterId);
    const npcMemoryCard = body.npc_memory_card || currentContext?.npc_memory_card || missionProgression?.npcMemoryCard || null;
    const normalizedGameContext = {
      ...currentContext,
      location: currentContext.location || currentContext.player_location || "",
      time_remaining_sec: Number(currentContext.time_remaining_sec || 0),
      sonic_drunk_level: Number(currentContext.sonic_drunk_level || 0),
      sonic_following: Boolean(currentContext.sonic_following),
      npc_encounter_count: Number(currentContext.npc_encounter_count || 0),
      max_bubble_length_chars: Number(currentContext.max_bubble_length_chars || 0),
      max_sentences_per_reply: Number(currentContext.max_sentences_per_reply || 0),
      recent_turns: recentTurnsRaw,
      mission_progression: missionProgression
    };

    return {
      requestIdSeed: `${characterId}:${body.intent || "flavor"}:${body.player_input || ""}`,
      characterId,
      intent: body.intent || "flavor",
      functionId: body.function_id || "",
      playerInput: body.player_input || "",
      fallbackText: body.fallback_text || "",
      intentContext,
      contract,
      gameContext: normalizedGameContext,
      missionProgression,
      recentNpcTurns: recentTurns,
      npcMemoryCard
    };
  }
}
