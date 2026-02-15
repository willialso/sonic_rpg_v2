import { describe, expect, it } from "vitest";
import { validateDialogueRequest } from "./validators.js";

describe("validateDialogueRequest", () => {
  it("rejects malformed payloads", () => {
    const invalid = validateDialogueRequest({
      character_id: 42,
      recent_turns: "wrong"
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.issues.length).toBeGreaterThan(0);
  });

  it("accepts valid payload shape", () => {
    const valid = validateDialogueRequest({
      character_id: "sonic",
      player_input: "Where is the party?",
      intent_context: { mode: "flavor" },
      current_context: { location: "frat" },
      mission_progression: null,
      npc_memory_card: null,
      recent_turns: [{ speaker: "sonic", text: "yo" }]
    });
    expect(valid.ok).toBe(true);
  });
});
