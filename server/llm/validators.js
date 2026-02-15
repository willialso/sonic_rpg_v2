function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function optionalString(value, field, issues, maxLen = 4000) {
  if (value === undefined) return;
  if (typeof value !== "string") {
    issues.push(`${field} must be a string`);
    return;
  }
  if (value.length > maxLen) issues.push(`${field} exceeds ${maxLen} characters`);
}

export function validateDialogueRequest(body) {
  const issues = [];
  if (!isRecord(body)) return { ok: false, issues: ["Request body must be a JSON object"], value: {} };

  optionalString(body.character_id, "character_id", issues, 80);
  optionalString(body.intent, "intent", issues, 80);
  optionalString(body.function_id, "function_id", issues, 120);
  optionalString(body.player_input, "player_input", issues, 1200);
  optionalString(body.fallback_text, "fallback_text", issues, 1200);

  if (body.intent_context !== undefined && !isRecord(body.intent_context)) {
    issues.push("intent_context must be an object");
  }
  if (body.current_context !== undefined && !isRecord(body.current_context)) {
    issues.push("current_context must be an object");
  }
  if (body.game_context !== undefined && !isRecord(body.game_context)) {
    issues.push("game_context must be an object");
  }
  if (body.mission_progression !== undefined && body.mission_progression !== null && !isRecord(body.mission_progression)) {
    issues.push("mission_progression must be an object");
  }
  if (body.npc_memory_card !== undefined && body.npc_memory_card !== null && !isRecord(body.npc_memory_card)) {
    issues.push("npc_memory_card must be an object");
  }
  if (body.recent_turns !== undefined && !Array.isArray(body.recent_turns)) {
    issues.push("recent_turns must be an array");
  }
  if (body.blocked_terms !== undefined && !isStringArray(body.blocked_terms)) {
    issues.push("blocked_terms must be a string array");
  }

  if (issues.length > 0) return { ok: false, issues, value: body };
  return { ok: true, issues: [], value: body };
}
