import type { GameStateData, LocationId } from "../../types/game";

export function createInitialState(seed = "sonic-rpg-v2-seed"): GameStateData {
  const now = new Date().toISOString();
  const initialLocation: LocationId = "dean_office";
  return {
    meta: {
      version: "2.0.0",
      seed,
      saveUpdatedAt: now
    },
    timer: {
      remainingSec: 900
    },
    phase: "onboarding",
    player: {
      name: "Rookie",
      location: initialLocation,
      inventory: []
    },
    mission: {
      objective: "Get cleared by Dean Cain.",
      subObjective: "Tell Dean your name to receive your Student ID and mission."
    },
    sonic: {
      drunkLevel: 0,
      following: false,
      location: "dorm_room",
      patience: 2,
      cooldownMoves: 0
    },
    routes: {
      routeA: { complete: false, progress: 0 },
      routeB: { complete: false, progress: 0 },
      routeC: { complete: false, progress: 0 }
    },
    fail: {
      warnings: { dean: 0, luigi: 0, frat: 0 },
      hardFailed: false,
      reason: ""
    },
    safety: {
      status: "ok"
    },
    world: {
      presentNpcs: {
        dean_office: ["dean_cain"],
        quad: ["eggman"],
        eggman_classroom: ["eggman"],
        frat: ["frat_boys"],
        sorority: ["sorority_girls"],
        tunnel: ["thunderhead"],
        cafeteria: ["tails"],
        dorms: ["knuckles"],
        dorm_room: ["sonic"],
        stadium: []
      },
      visitCounts: {
        dean_office: 1,
        quad: 0,
        eggman_classroom: 0,
        frat: 0,
        sorority: 0,
        tunnel: 0,
        cafeteria: 0,
        dorms: 0,
        dorm_room: 0,
        stadium: 0
      },
      actionUnlocks: {
        beerPongFrat: false,
        beerPongSonic: false,
        searchDeanDesk: false,
        searchQuad: false,
        searchEggmanClassroom: false,
        searchFratHouse: false,
        searchSororityHouse: false,
        searchTunnel: false,
        searchCafeteria: false,
        searchDorms: false,
        tradeThunderhead: false,
        answerThunderhead: false,
        giveWhiskey: false,
        giveAsswine: false,
        escortSonic: false,
        stadiumEntry: false,
        searchStadium: false
      },
      minigames: {
        globalRound: 0,
        globalStreak: 0,
        beerPongRound: 0,
        beerPongStreak: 0,
        loreRound: 0,
        loreStreak: 0,
        stripPokerLosses: 0,
        stripPokerTableLocked: false
      },
      restrictions: {
        sororityBanned: false,
        fratBanned: false,
        fratChallengeForced: false,
        fratLastSafeLocation: "quad"
      },
      analytics: {
        soggyBiscuitTriggered: false
      },
      searchCaches: {},
      intents: {},
      events: []
    },
    dialogue: {
      source: "scripted",
      turns: [],
      deanStage: "intro_pending",
      greetedNpcIds: [],
      encounterCountByNpc: {},
      npcMemory: {}
    },
    quality: {
      sourceCounts: {
        scripted: 0,
        llm: 0,
        fallback: 0,
        cache: 0,
        cooldown: 0
      }
    }
  };
}
