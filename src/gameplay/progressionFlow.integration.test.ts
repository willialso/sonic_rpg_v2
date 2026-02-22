import { describe, expect, it } from "vitest";
import { StateMachine } from "../core/engine/StateMachine";
import { safeTransition } from "../core/engine/safeTransition";
import { createInitialState } from "../core/state/initialState";
import { ScriptedDialogueService } from "../dialogue/ScriptedDialogueService";
import { RouteManager } from "./RouteManager";
import { ESCORT_READY_DRUNK_LEVEL } from "./progressionRules";

describe("progression flow integration checks", () => {
  it("supports the canonical phase path onboarding -> hunt -> escort -> resolved", () => {
    const state = createInitialState("phase-flow-seed");
    const machine = new StateMachine(state.phase);

    expect(safeTransition(machine, state, "hunt", "test move to hunt")).toBe(true);
    expect(safeTransition(machine, state, "escort", "test move to escort")).toBe(true);
    expect(safeTransition(machine, state, "resolved", "test mission end")).toBe(true);
    expect(state.phase).toBe("resolved");
  });

  it("rejects skipping directly from onboarding to escort", () => {
    const state = createInitialState("invalid-phase-seed");
    const machine = new StateMachine(state.phase);

    expect(safeTransition(machine, state, "escort", "test invalid skip")).toBe(false);
    expect(state.phase).toBe("onboarding");
  });

  it("requires escort-readiness and full mission gates to win", () => {
    const state = createInitialState("win-gate-seed");
    const routeManager = new RouteManager();

    state.player.location = "stadium";
    state.player.inventory.push("Student ID");
    state.sonic.following = true;
    state.sonic.drunkLevel = ESCORT_READY_DRUNK_LEVEL - 1;
    expect(routeManager.canWin(state)).toBe(false);

    state.sonic.drunkLevel = ESCORT_READY_DRUNK_LEVEL;
    expect(routeManager.canWin(state)).toBe(true);
  });

  it("keeps Sonic stadium dialogue consistent with escort-readiness threshold", () => {
    const state = createInitialState("dialogue-threshold-seed");
    const scripted = new ScriptedDialogueService();

    state.sonic.drunkLevel = ESCORT_READY_DRUNK_LEVEL - 1;
    const blocked = scripted.respond("sonic", "go to stadium", state);
    expect(blocked).toContain(`drunk level ${ESCORT_READY_DRUNK_LEVEL}+`);

    state.sonic.drunkLevel = ESCORT_READY_DRUNK_LEVEL;
    const allowed = scripted.respond("sonic", "go to stadium", state);
    expect(allowed).toContain("Fine, now we're talking");
  });
});
