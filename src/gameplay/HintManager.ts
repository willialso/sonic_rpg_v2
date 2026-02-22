import type { GameStateData, NpcId } from "../types/game";
import { ESCORT_READY_DRUNK_LEVEL, isEscortReady } from "./progressionRules";

export class HintManager {
  getHint(state: GameStateData): string {
    if (!state.player.inventory.includes("Student ID")) {
      return "Step one is intake: tell Dean your first name and get Student ID activated.";
    }
    const clueNpcs: NpcId[] = ["tails", "eggman", "frat_boys", "thunderhead"];
    const clueContacts = clueNpcs.filter((npc) => state.dialogue.greetedNpcIds.includes(npc)).length;
    if (clueContacts < 2) {
      return "Sonic stays slippery until you collect enough campus intel. Talk to at least two clue NPCs.";
    }
    if (!state.player.inventory.includes("Campus Map") && state.world.visitCounts.quad > 0) {
      return "Search Quad for Campus Map. Faster travel means more attempts before clock pressure spikes.";
    }
    if (state.world.restrictions.sororityBanned && !state.player.inventory.includes("Asswine")) {
      return "Sorority route is burned. Pivot to Dean Whiskey / frat pressure and finish without tunnel trade.";
    }
    if (state.timer.remainingSec < 180) {
      return "Low time: dose Sonic in Dorm Room and sprint to Stadium.";
    }
    if (state.player.inventory.includes("Furry Handcuffs") && state.player.location === "dorm_room" && isEscortReady(state.sonic.drunkLevel)) {
      return "Handcuffs path is live: use them now, then move straight to Stadium.";
    }
    if (!state.player.inventory.includes("Spare Socks") && state.world.visitCounts.dorms > 0) {
      return "Dorm hall stash can carry a strip-poker safety item if you need it.";
    }
    if (isEscortReady(state.sonic.drunkLevel) && !state.sonic.following) {
      return `Sonic is ready (drunk level ${ESCORT_READY_DRUNK_LEVEL}+). Escort him from Dorm Hall or current location.`;
    }
    if (state.sonic.drunkLevel < 2 && !state.routes.routeA.complete) {
      return "Frat route is fastest. Beat Sonic in beer pong twice.";
    }
    if (!state.player.inventory.includes("Dean Whiskey")) {
      return "Distract Dean with Eggman first, then search Dean desk.";
    }
    if (!state.player.inventory.includes("Asswine") && !state.routes.routeC.complete) {
      return "Steal Sorority contraband (Lace Undies, Mascara, or Composite), then trade in Tunnel.";
    }
    return "You have enough clues. Prioritize Sonic intoxication and escort.";
  }
}
