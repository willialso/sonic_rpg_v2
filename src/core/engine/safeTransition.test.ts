import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/initialState";
import { StateMachine } from "./StateMachine";
import { safeTransition } from "./safeTransition";

describe("safeTransition", () => {
  it("applies valid transitions", () => {
    const state = createInitialState("test-seed");
    const machine = new StateMachine(state.phase);
    const ok = safeTransition(machine, state, "hunt", "unit-test-valid");
    expect(ok).toBe(true);
    expect(state.phase).toBe("hunt");
  });

  it("rejects invalid transitions and records event", () => {
    const state = createInitialState("test-seed");
    const machine = new StateMachine(state.phase);
    const ok = safeTransition(machine, state, "escort", "unit-test-invalid");
    expect(ok).toBe(false);
    expect(state.phase).toBe("onboarding");
    expect(state.world.events.at(-1)).toContain("Invalid phase transition onboarding -> escort");
  });
});
