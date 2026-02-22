import { describe, expect, it } from "vitest";
import { StateMachine } from "../core/engine/StateMachine";
import { safeTransition } from "../core/engine/safeTransition";
import { createInitialState } from "../core/state/initialState";
import {
  shouldDeanExpelForFakeId,
  shouldFratBeatdown,
  shouldLuigiExpelForContraband
} from "./progressionRules";

describe("progression fail-branch integration checks", () => {
  it("resolves run on Dean fake-ID threshold", () => {
    const state = createInitialState("dean-fake-id-seed");
    const machine = new StateMachine(state.phase);
    safeTransition(machine, state, "hunt", "setup-hunt");

    state.fail.warnings.dean = 1;
    state.fail.warnings.dean += 1;
    if (shouldDeanExpelForFakeId(state.fail.warnings.dean)) {
      state.fail.hardFailed = true;
      state.fail.reason = "Security reports your fake credentials to Dean. You are expelled.";
      safeTransition(machine, state, "resolved", "test dean fake id fail");
    }

    expect(state.fail.hardFailed).toBe(true);
    expect(state.phase).toBe("resolved");
  });

  it("resolves run on Luigi contraband repeat", () => {
    const state = createInitialState("luigi-contraband-seed");
    const machine = new StateMachine(state.phase);
    safeTransition(machine, state, "hunt", "setup-hunt");

    state.fail.warnings.luigi = 1;
    if (shouldLuigiExpelForContraband(state.fail.warnings.luigi + 1)) {
      state.fail.hardFailed = true;
      state.fail.reason = "Luigi catches repeat contraband and shuts your run down.";
      safeTransition(machine, state, "resolved", "test luigi contraband repeat fail");
    }

    expect(state.fail.hardFailed).toBe(true);
    expect(state.phase).toBe("resolved");
  });

  it("resolves run on Frat repeat-loss threshold", () => {
    const state = createInitialState("frat-loss-seed");
    const machine = new StateMachine(state.phase);
    safeTransition(machine, state, "hunt", "setup-hunt");

    state.fail.warnings.frat = 1;
    state.fail.warnings.frat += 1;
    if (shouldFratBeatdown(state.fail.warnings.frat)) {
      state.fail.hardFailed = true;
      state.fail.reason = "Frat beatdown after repeated losses.";
      safeTransition(machine, state, "resolved", "test frat beatdown fail");
    }

    expect(state.fail.hardFailed).toBe(true);
    expect(state.phase).toBe("resolved");
  });
});
