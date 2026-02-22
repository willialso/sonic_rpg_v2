import type { GameStateData, LocationId } from "../../types/game";
import { addInventory } from "./inventorySearchActions";

export function setPressure(state: GameStateData): void {
  // V2.5: pressure labels removed to reduce dialogue over-engineering.
  void state;
}

export function syncSonicLocation(state: GameStateData): void {
  const previous = state.sonic.location;
  const locations = Object.keys(state.world.presentNpcs) as LocationId[];
  const sonicAt = locations.find((location) => (state.world.presentNpcs[location] ?? []).includes("sonic"));
  if (sonicAt) {
    state.sonic.location = sonicAt;
    if (previous !== sonicAt) {
      const recentSonicTurn = [...state.dialogue.turns]
        .reverse()
        .find((turn) => turn.npcId === "sonic" || String(turn.speaker || "").toLowerCase() === "sonic");
      const playerLocationHasSonic = sonicAt === state.player.location;
      const recentTurnAtMs = recentSonicTurn?.createdAt ? Date.parse(recentSonicTurn.createdAt) : 0;
      const activeSonicExchange = Boolean(
        recentSonicTurn
        && recentSonicTurn.locationId === state.player.location
        && recentTurnAtMs > 0
        && Date.now() - recentTurnAtMs < 7000
      );
      if (playerLocationHasSonic && activeSonicExchange) {
        state.world.events.push("telemetry:rumor-suppressed");
        if (state.world.events.length > 40) state.world.events = state.world.events.slice(-40);
        return;
      }
      const rumor = `Rumor update: Sonic was spotted around ${sonicAt.replace(/_/g, " ")}.`;
      if ((state.world.events[state.world.events.length - 1] || "") !== rumor) {
        state.world.events.push(rumor);
        state.world.events.push("telemetry:rumor-emitted");
        if (state.world.events.length > 40) state.world.events = state.world.events.slice(-40);
      }
    }
  }
}

export function hasMissionAssigned(state: GameStateData): boolean {
  const objective = `${state.mission.objective} ${state.mission.subObjective}`.toLowerCase();
  return state.dialogue.deanStage === "mission_given"
    || (objective.includes("sonic") && objective.includes("stadium"));
}

export function ensureMissionIntakeConsistency(state: GameStateData): void {
  const hadStudentId = state.player.inventory.includes("Student ID");
  if (hasMissionAssigned(state) && !hadStudentId) {
    addInventory(state, "Student ID");
    state.world.events.push("Campus update: Dean clearance issued. Student ID now active.");
    const nearby = state.world.presentNpcs[state.player.location] ?? [];
    if (nearby.length > 0) {
      const names = nearby.join(", ");
      state.world.events.push(`Nearby stance shift: ${names} now treat you as cleared, not random.`);
    }
  }
  if (state.player.location === "dean_office" && state.dialogue.deanStage === "intro_pending") {
    state.dialogue.deanStage = "name_pending";
  }
  if (state.dialogue.deanStage === "mission_given") {
    state.mission.objective = "Get Sonic to Stadium.";
    state.mission.subObjective = "Build a route, intoxicate Sonic, escort him, and clear gate security.";
  }
  if (state.world.events.length > 40) state.world.events = state.world.events.slice(-40);
}
