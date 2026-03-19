import type { GameStateData } from "../../types/game";
import { normalizeGameState } from "../validation/gameStateValidation";

const SAVE_KEY = "sonic_rpg_v2_autosave";

export class SaveStateManager {
  private deferredTimerId: number | null = null;
  private deferredState: GameStateData | null = null;

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

  saveDeferred(state: GameStateData, delayMs = 120): void {
    this.deferredState = state;
    if (this.deferredTimerId !== null) return;
    this.deferredTimerId = window.setTimeout(() => {
      this.deferredTimerId = null;
      const latest = this.deferredState;
      this.deferredState = null;
      if (latest) {
        this.save(latest);
      }
    }, Math.max(0, delayMs));
  }

  flushDeferred(): void {
    if (this.deferredTimerId !== null) {
      window.clearTimeout(this.deferredTimerId);
      this.deferredTimerId = null;
    }
    const latest = this.deferredState;
    this.deferredState = null;
    if (latest) {
      this.save(latest);
    }
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
    if (this.deferredTimerId !== null) {
      window.clearTimeout(this.deferredTimerId);
      this.deferredTimerId = null;
    }
    this.deferredState = null;
    localStorage.removeItem(SAVE_KEY);
  }
}
