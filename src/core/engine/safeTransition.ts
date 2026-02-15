import type { GamePhase, GameStateData } from "../../types/game";
import type { StateMachine } from "./StateMachine";

export function safeTransition(machine: StateMachine, state: GameStateData, next: GamePhase, context: string): boolean {
  const ok = machine.transition(next);
  if (!ok) {
    const message = `Invalid phase transition ${state.phase} -> ${next} (${context})`;
    state.world.events.push(message);
    state.world.events = state.world.events.slice(-40);
    console.warn(message);
    return false;
  }
  state.phase = machine.getPhase();
  return true;
}
