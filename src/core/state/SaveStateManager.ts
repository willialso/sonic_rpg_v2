import type { GameStateData } from "../../types/game";
import { normalizeGameState } from "../validation/gameStateValidation";

const SAVE_KEY = "sonic_rpg_v2_autosave";

export class SaveStateManager {
  save(state: GameStateData): void {
    const payload = {
      ...state,
      meta: {
        ...state.meta,
        saveUpdatedAt: new Date().toISOString()
      }
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  }

  load(): GameStateData | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      return normalizeGameState(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
