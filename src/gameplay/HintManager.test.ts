import { describe, expect, it } from "vitest";
import { createInitialState } from "../core/state/initialState";
import { HintManager } from "./HintManager";

function buildHintReadyState() {
  const state = createInitialState("hint-test-seed");
  state.player.inventory.push("Student ID", "Campus Map", "Dean Whiskey");
  state.dialogue.greetedNpcIds = ["tails", "eggman"];
  state.timer.remainingSec = 600;
  state.sonic.drunkLevel = 2;
  state.player.location = "dorm_room";
  return state;
}

describe("HintManager regression checks", () => {
  it("suggests valid Thunderhead trade contraband, not Mystery Meat", () => {
    const hintManager = new HintManager();
    const state = buildHintReadyState();

    const hint = hintManager.getHint(state);

    expect(hint).toContain("Sorority contraband");
    expect(hint).toContain("trade in Tunnel");
    expect(hint).not.toContain("Mystery Meat");
  });

  it("only marks handcuffs path live at drunkLevel >= 3", () => {
    const hintManager = new HintManager();
    const state = buildHintReadyState();
    state.player.inventory.push("Furry Handcuffs");

    const hintAtTwo = hintManager.getHint(state);
    expect(hintAtTwo).not.toContain("Handcuffs path is live");

    state.sonic.drunkLevel = 3;
    const hintAtThree = hintManager.getHint(state);
    expect(hintAtThree).toBe("Handcuffs path is live: use them now, then move straight to Stadium.");
  });
});
