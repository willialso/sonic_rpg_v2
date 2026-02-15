import type { GameStateData } from "../types/game";
import { IntentEngine } from "./IntentEngine";
import { NPCPresenceSystem } from "./NPCPresenceSystem";

export class CampusDirector {
  private readonly intents = new IntentEngine();
  private readonly presence = new NPCPresenceSystem();

  updateWorld(state: GameStateData): {
    intents: GameStateData["world"]["intents"];
    presentNpcs: GameStateData["world"]["presentNpcs"];
  } {
    return {
      intents: this.intents.compute(state),
      presentNpcs: this.presence.resolve(state)
    };
  }
}
