import type { GamePhase } from "../../types/game";

const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  onboarding: ["hunt", "resolved"],
  hunt: ["escort", "resolved"],
  escort: ["resolved"],
  resolved: []
};

export class StateMachine {
  private phase: GamePhase;

  constructor(initialPhase: GamePhase) {
    this.phase = initialPhase;
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  canTransition(next: GamePhase): boolean {
    return VALID_TRANSITIONS[this.phase].includes(next);
  }

  transition(next: GamePhase): boolean {
    if (!this.canTransition(next)) {
      return false;
    }
    this.phase = next;
    return true;
  }
}
