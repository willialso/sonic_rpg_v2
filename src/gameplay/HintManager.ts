import type { GameStateData } from "../types/game";

export class HintManager {
  getHint(state: GameStateData): string {
    if (!state.player.inventory.includes("Student ID")) {
      return "Dean won't clear you without your name. Get your Student ID first.";
    }
    if (state.world.restrictions.sororityBanned && !state.player.inventory.includes("Asswine")) {
      return "Sorority route is burned. Pivot to Dean Whiskey / frat pressure and finish without tunnel trade.";
    }
    if (!state.player.inventory.includes("Campus Map") && state.world.visitCounts.quad > 0) {
      return "Quick optimization: search Quad for a Campus Map to cut travel time.";
    }
    if (!state.player.inventory.includes("Spare Socks") && state.world.visitCounts.dorms > 0) {
      return "Dorm hall stash can carry a strip-poker safety item if you need it.";
    }
    if (state.timer.remainingSec < 180) {
      return "Low time: dose Sonic in Dorms and sprint to Stadium.";
    }
    if (state.sonic.drunkLevel >= 3 && !state.sonic.following) {
      return "Sonic is ready. Escort him from Dorms or current location.";
    }
    if (state.sonic.drunkLevel < 2 && !state.routes.routeA.complete) {
      return "Frat route is fastest. Beat Sonic in beer pong twice.";
    }
    if (!state.player.inventory.includes("Dean Whiskey")) {
      return "Distract Dean with Eggman first, then search Dean desk.";
    }
    if (!state.player.inventory.includes("Asswine") && !state.routes.routeC.complete) {
      return "Get Mystery Meat from Cafeteria, then trade in Tunnel.";
    }
    return "You have enough clues. Prioritize Sonic intoxication and escort.";
  }
}
