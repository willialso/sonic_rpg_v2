import { describe, expect, it } from "vitest";
import { createInitialState } from "../core/state/initialState";
import { NPCPresenceSystem } from "./NPCPresenceSystem";

describe("NPC presence pacing", () => {
  it("keeps Dean anchored during onboarding intake", () => {
    const state = createInitialState("presence-onboarding-seed");
    const system = new NPCPresenceSystem();
    for (let remainingSec = 900; remainingSec >= 300; remainingSec -= 30) {
      state.timer.remainingSec = remainingSec;
      const presence = system.resolve(state);
      expect(presence.dean_office.includes("dean_cain")).toBe(true);
    }
  });

  it("opens search windows after mission starts", () => {
    const state = createInitialState("presence-hunt-seed");
    const system = new NPCPresenceSystem();
    state.dialogue.deanStage = "mission_given";
    state.phase = "hunt";
    state.player.inventory.push("Student ID");

    let deanOfficeClearCount = 0;
    let sororityClearCount = 0;
    let fratClearCount = 0;
    for (let remainingSec = 900; remainingSec >= 240; remainingSec -= 20) {
      state.timer.remainingSec = remainingSec;
      const presence = system.resolve(state);
      if (!presence.dean_office.includes("dean_cain")) deanOfficeClearCount += 1;
      if (!presence.sorority.includes("sorority_girls")) sororityClearCount += 1;
      if (!presence.frat.includes("frat_boys")) fratClearCount += 1;
    }

    expect(deanOfficeClearCount).toBeGreaterThan(0);
    expect(sororityClearCount).toBeGreaterThan(0);
    expect(fratClearCount).toBeGreaterThan(0);
  });
});
