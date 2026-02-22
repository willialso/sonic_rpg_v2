import type { GameStateData } from "../types/game";
import { isEscortReady } from "./progressionRules";

export class RouteManager {
  progressRouteA(state: GameStateData): void {
    state.routes.routeA.progress += 1;
    if (state.routes.routeA.progress >= 2) {
      state.routes.routeA.complete = true;
    }
  }

  completeRouteB(state: GameStateData): void {
    state.routes.routeB.progress = 1;
    state.routes.routeB.complete = true;
  }

  completeRouteC(state: GameStateData): void {
    state.routes.routeC.progress = 1;
    state.routes.routeC.complete = true;
  }

  hasAnyCompletedRoute(state: GameStateData): boolean {
    return state.routes.routeA.complete || state.routes.routeB.complete || state.routes.routeC.complete;
  }

  canWin(state: GameStateData): boolean {
    return isEscortReady(state.sonic.drunkLevel)
      && state.sonic.following
      && state.player.location === "stadium"
      && state.player.inventory.includes("Student ID");
  }
}
