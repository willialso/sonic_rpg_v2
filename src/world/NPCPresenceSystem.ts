import type { GameStateData, LocationId, NpcId } from "../types/game";

type PresenceMap = Record<LocationId, NpcId[]>;

function emptyPresence(): PresenceMap {
  return {
    dean_office: [],
    quad: [],
    eggman_classroom: [],
    frat: [],
    sorority: [],
    tunnel: [],
    cafeteria: [],
    dorms: [],
    dorm_room: [],
    stadium: []
  };
}

export class NPCPresenceSystem {
  private hash(input: string): number {
    let value = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i += 1) {
      value ^= input.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  private pushWithCap(map: PresenceMap, location: LocationId, npc: NpcId, cap = 2): void {
    if (map[location].includes(npc)) return;
    if (map[location].length >= cap) return;
    map[location].push(npc);
  }

  private shouldSpawnLuigiEvent(state: GameStateData): boolean {
    const nearObjective = state.sonic.drunkLevel >= 2
      || state.player.inventory.includes("Dean Whiskey")
      || state.player.inventory.includes("Asswine")
      || state.routes.routeA.complete
      || state.routes.routeB.complete
      || state.routes.routeC.complete;
    if (!nearObjective) return false;
    const pulse = Math.abs((state.timer.remainingSec % 210) - 105);
    return pulse <= 8;
  }

  private placeRotatingRoster(state: GameStateData, p: PresenceMap): void {
    const socialLocations: LocationId[] = ["quad", "cafeteria", "dorms", "dorm_room"];
    const rotatingNpcs: NpcId[] = ["tails", "earthworm_jim", "knuckles"];
    const tick = Math.floor((900 - state.timer.remainingSec) / 45);
    const visitMix = (state.world.visitCounts.quad ?? 0)
      + (state.world.visitCounts.cafeteria ?? 0)
      + (state.world.visitCounts.dorms ?? 0)
      + (state.world.visitCounts.dorm_room ?? 0);
    const base = (this.hash(`${state.meta.seed}:${tick}:${visitMix}`) % socialLocations.length);

    rotatingNpcs.forEach((npc, idx) => {
      for (let attempt = 0; attempt < socialLocations.length; attempt += 1) {
        const candidate = socialLocations[(base + idx + attempt) % socialLocations.length];
        if (p[candidate].length < 2) {
          this.pushWithCap(p, candidate, npc, 2);
          break;
        }
      }
    });
  }

  private placeSonic(state: GameStateData, p: PresenceMap): void {
    if (state.sonic.cooldownMoves > 0) return;
    if (state.sonic.following) {
      this.pushWithCap(p, state.player.location, "sonic", 2);
      return;
    }

    const clueContacts = ["tails", "eggman", "frat_boys", "thunderhead"]
      .filter((npc) => state.dialogue.greetedNpcIds.includes(npc as NpcId)).length;
    const hasProgressSignal = clueContacts >= 2
      || state.routes.routeA.progress > 0
      || state.routes.routeB.progress > 0
      || state.routes.routeC.progress > 0
      || state.player.inventory.includes("Campus Map")
      || state.player.inventory.includes("Lost Lanyard");
    if (!hasProgressSignal) {
      return;
    }

    // Sonic is never at Frat until the player challenges him.
    if (state.world.actionUnlocks.beerPongSonic || state.sonic.location === "frat") {
      this.pushWithCap(p, "frat", "sonic", 2);
      return;
    }

    const sonicCircuit: LocationId[] = ["dorm_room", "dorms", "cafeteria", "quad"];
    const circuitTick = Math.floor((900 - state.timer.remainingSec) / 60);
    const offset = this.hash(`${state.meta.seed}:sonic:${circuitTick}`) % sonicCircuit.length;
    const location = sonicCircuit[offset];
    this.pushWithCap(p, location, "sonic", 2);
  }

  resolve(state: GameStateData): PresenceMap {
    const p = emptyPresence();

    // Fixed anchors.
    p.dean_office.push("dean_cain");
    p.frat.push("frat_boys");
    p.sorority.push("sorority_girls");
    p.tunnel.push("thunderhead");
    p.eggman_classroom.push("eggman");

    // Rotating campus cast with light occupancy caps.
    this.placeRotatingRoster(state, p);
    this.placeSonic(state, p);

    const luigiEvent = this.shouldSpawnLuigiEvent(state);
    if (luigiEvent) {
      const eventLocation: LocationId =
        state.player.location === "stadium" || state.player.location === "dorms" || state.player.location === "quad"
          ? state.player.location
          : "quad";
      p[eventLocation] = ["luigi"];
      return p;
    }

    return p;
  }
}
