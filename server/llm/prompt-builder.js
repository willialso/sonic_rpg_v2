import { normalizeCharacterId } from "./shared.js";

export class PromptBuilder {
  build(context, examples = [], rewriteInstruction = "") {
    const characterId = normalizeCharacterId(context.characterId);
    const mustInclude = Array.isArray(context.intentContext?.must_include) ? context.intentContext.must_include : [];
    const avoid = Array.isArray(context.intentContext?.avoid) ? context.intentContext.avoid : [];
    const contract = context.contract || {};
    const currentContextRaw = context.gameContext || {};
    const currentContext = {
      location: currentContextRaw.location || "",
      time_remaining_sec: Number(currentContextRaw.time_remaining_sec || 0),
      sonic_drunk_level: Number(currentContextRaw.sonic_drunk_level || 0),
      sonic_following: Boolean(currentContextRaw.sonic_following),
      sonic_location: currentContextRaw.sonic_location || "",
      npc_encounter_count: Number(currentContextRaw.npc_encounter_count || 0),
      inventory: Array.isArray(currentContextRaw.inventory) ? currentContextRaw.inventory.slice(0, 8) : [],
      nearby_npcs: Array.isArray(currentContextRaw.nearby_npcs) ? currentContextRaw.nearby_npcs.slice(0, 5) : []
    };
    const missionProgressionRaw = context.missionProgression || context.gameContext?.mission_progression || null;
    const missionProgression = missionProgressionRaw
      ? {
          objective: missionProgressionRaw.objective || "",
          sub_objective: missionProgressionRaw.sub_objective || "",
          phase: missionProgressionRaw.phase || "",
          dean_stage: missionProgressionRaw.dean_stage || "",
          fail_warnings: missionProgressionRaw.fail_warnings || {},
          route_flags: missionProgressionRaw.route_flags || {}
        }
      : null;
    const missionAware = contract?.missionAwareness === "explicit" || Boolean(missionProgression);
    const avoidFlatYesNoPrompt = ["frat_boys", "sonic", "eggman", "knuckles"].includes(characterId)
      ? "Avoid flat yes/no party-check questions. Prefer taunts, observations, or specific reactions."
      : "";
    const memoryCardRaw = context.npcMemoryCard || {};
    const memoryCard = {
      lastAdvice: memoryCardRaw.lastAdvice || "",
      lastWarning: memoryCardRaw.lastWarning || "",
      milestones: Array.isArray(memoryCardRaw.milestones) ? memoryCardRaw.milestones.slice(-6) : []
    };
    const compactExamples = (examples || []).slice(0, 4).map((row) => ({
      line: row?.line || "",
      locationGroup: row?.locationGroup || "",
      tags: Array.isArray(row?.tags) ? row.tags.slice(0, 3) : []
    }));
    const knucklesCadenceRule = characterId === "knuckles"
      ? "For Knuckles: include exactly one short cadence pair in the form '<verb>in and <verb>in', then continue normally."
      : "";
    const sonicMissionSilenceRule = characterId === "sonic"
      ? "For Sonic: never bring up stadium/mission/escort unless player_input directly asks for mission progress."
      : "";
    const sonicChaosRule = characterId === "sonic"
      ? "For Sonic: voice must be casual, reckless, and conversational - an out-of-control superstar telling messy stories like a cool burnout."
      : "";
    const sonicNamedDetailRule = characterId === "sonic"
      ? "For Sonic: include at least one concrete celebrity full name in any brag anecdote. Generic unnamed celebrity references are invalid."
      : "";
    const thunderheadRule = characterId === "thunderhead"
      ? "For Thunderhead: use uncouth gutter cadence, sexually perverted confessions, filthy transactional demands, and optional pervy end-laughs like 'heh-heh' or 'khh'. Never sound polished."
      : "";
    const thunderheadSpecificityRule = characterId === "thunderhead"
      ? "For Thunderhead: include one specific grimy object or place detail (food, stain, deli, tunnel junk, payphone, etc), not generic sleaze filler."
      : "";
    const forbiddenClichesRule = characterId === "sonic"
      ? "Forbidden cliches for Sonic: avoid repeating stock beats like 'one drink, one rumor, one bad decision', 'bring chaos, gossip, or cash-burn energy', and opener clones of 'no freebies, bring chaos'."
      : characterId === "frat_boys"
        ? "Forbidden cliches for Frat Boys: avoid repeating 'bring a stunt, a rumor, or a challenge', 'earn your lane', or generic frat-vibe filler."
        : characterId === "thunderhead"
          ? "Forbidden cliches for Thunderhead: avoid generic lines like 'trade me the right contraband. no freebies.', 'no deal without the right move.', or sterile transaction-only phrasing."
        : "";

    const voiceOpenerVarietyRule = characterId === "sonic" || characterId === "thunderhead"
      ? "Vary openings naturally. Do not repeatedly start with one frame; rotate styles like 'This reminds me...', 'Last month...', 'You got...?', 'Not to brag, but...'."
      : "";
    const globalVarietyRule = "Global variety rule: do not repeat the same sentence skeleton from the most recent turn. Change structure, subject, and punchline rhythm.";
    const voiceSeparationRule = characterId === "sonic"
      ? "Voice separation: Sonic is casual and cocky, not gutter-trash. Avoid tunnel-filth slang."
      : characterId === "thunderhead"
        ? "Voice separation: Thunderhead is gutter-filthy and pervy, not smooth celebrity banter."
        : "";
    const responseLengthRule = characterId === "sonic" || characterId === "thunderhead"
      ? "Max 2 short sentences. Prefer one compact anecdote clause plus one punchline."
      : "Max 2 short sentences. Use a fresh angle each turn and avoid repeating recent opener phrasing.";

    return [
      `CHARACTER_ID: ${characterId}`,
      `INTENT: ${context.intent}`,
      `FUNCTION_ID: ${context.functionId || "GENERAL"}`,
      `INTENT_GOAL: ${context.intentContext?.goal || "Stay in character and respond naturally."}`,
      `MUST_INCLUDE: ${JSON.stringify(mustInclude)}`,
      `AVOID: ${JSON.stringify(avoid)}`,
      `CURRENT_CONTEXT: ${JSON.stringify(currentContext)}`,
      missionProgression ? `MISSION_PROGRESSION: ${JSON.stringify(missionProgression)}` : "",
      `NPC_MEMORY_CARD: ${JSON.stringify(memoryCard)}`,
      `RECENT_NPC_TURNS: ${JSON.stringify((context.recentNpcTurns || []).slice(-4))}`,
      `CHARACTER_CONTRACT: ${JSON.stringify(contract || {})}`,
      `RETRIEVED_EXAMPLES: ${JSON.stringify(compactExamples)}`,
      rewriteInstruction ? `REWRITE: ${rewriteInstruction}` : "",
      "Output must be strict JSON with keys: npc_text,intent,time_cost_seconds,suggested_state_effects.",
      missionAware
        ? "Keep response in-character, context anchored, and mission-progressive when relevant."
        : "Keep response in-character and context anchored to the NPC's own agenda.",
      "Acknowledge relevant current state naturally and react in character.",
      "When appropriate, include one actionable nudge without sounding like a system prompt.",
      "Never output technical phrasing such as 'state update', 'next step protocol', or template labels.",
      missionAware
        ? "For mission-critical turns, naturally anchor to movement/progression (route, move, challenge, escort, or stadium) without sounding forced."
        : "Do not force mission talk; only mention mission if the player directly asks.",
      "Treat MUST_INCLUDE as semantic goals, not literal phrases.",
      responseLengthRule,
      globalVarietyRule,
      knucklesCadenceRule,
      sonicMissionSilenceRule,
      sonicChaosRule,
      sonicNamedDetailRule,
      thunderheadRule,
      thunderheadSpecificityRule,
      voiceSeparationRule,
      voiceOpenerVarietyRule,
      forbiddenClichesRule,
      avoidFlatYesNoPrompt,
      "Do not use internal/meta labels in npc_text.",
      "Hard safety: no rape/non-consensual content, no minors/child harm."
    ].filter(Boolean).join("\n");
  }
}
