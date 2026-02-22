export type LocationId =
  | "dean_office"
  | "quad"
  | "eggman_classroom"
  | "frat"
  | "sorority"
  | "tunnel"
  | "cafeteria"
  | "dorms"
  | "dorm_room"
  | "stadium";

export type NpcId =
  | "dean_cain"
  | "luigi"
  | "eggman"
  | "earthworm_jim"
  | "frat_boys"
  | "sorority_girls"
  | "thunderhead"
  | "sonic"
  | "tails"
  | "knuckles";

export type RouteId = "routeA" | "routeB" | "routeC";
export type GamePhase = "onboarding" | "hunt" | "escort" | "resolved";
export type SafetyStatus = "ok" | "abort";
export type DialogueSource = "scripted" | "llm" | "llm_regen" | "fallback" | "cache" | "cooldown";
export type DeanConversationStage = "intro_pending" | "name_pending" | "mission_given" | "dismiss_mode" | "expelled";

export interface LocationContent {
  id: LocationId;
  name: string;
  description: string;
  exits: LocationId[];
}

export interface NpcProfile {
  id: NpcId;
  displayName: string;
  voice: string;
  defaultGoal: string;
  allowedLocations: LocationId[];
}

export interface NpcIntentState {
  goal: string;
  mood: "calm" | "annoyed" | "urgent";
  patience: number;
  urgency: number;
}

export interface PlayerAction {
  type:
    | "MOVE"
    | "TALK"
    | "PLAY_BEER_PONG_FRAT"
    | "PLAY_BEER_PONG_SONIC"
    | "PLAY_SOGGY_BISCUIT"
    | "PLAY_BEER_PONG_SHOT"
    | "PLAY_BEER_PONG_SCORE"
    | "PLAY_LORE_RIDDLE"
    | "PLAY_STRIP_POKER_ROUND"
    | "START_STRIP_POKER_SESSION"
    | "END_STRIP_POKER_SESSION"
    | "ASK_EGGMAN_QUIZ"
    | "DECLINE_EGGMAN_QUIZ"
    | "PLAY_EGGMAN_LAB_ROUND"
    | "SEARCH_DEAN_DESK"
    | "SEARCH_QUAD"
    | "SEARCH_EGGMAN_CLASSROOM"
    | "SEARCH_FRAT_HOUSE"
    | "SEARCH_SORORITY_HOUSE"
    | "SEARCH_TUNNEL"
    | "SEARCH_CAFETERIA"
    | "SEARCH_DORMS"
    | "SEARCH_DORM_ROOM"
    | "SEARCH_STADIUM"
    | "USE_CAMPUS_MAP"
    | "USE_GATE_STAMP"
    | "USE_MYSTERY_MEAT"
    | "USE_SECURITY_SCHEDULE"
    | "USE_RA_WHISTLE"
    | "GET_MYSTERY_MEAT"
    | "GET_SUPER_DEAN_BEANS"
    | "TAKE_FOUND_ITEM"
    | "MIX_GLITTER_WARM_BEER"
    | "MIX_BEANS_WARM_BEER"
    | "USE_SUPER_DEAN_BEANS"
    | "USE_EXPIRED_ENERGY_SHOT"
    | "USE_WARM_BEER"
    | "USE_GLITTER_BOMB_BREW"
    | "USE_TURBO_SLUDGE"
    | "TRADE_THUNDERHEAD"
    | "ANSWER_THUNDERHEAD"
    | "GIVE_WHISKEY"
    | "GIVE_ASSWINE"
    | "USE_ITEM_ON_TARGET"
    | "USE_FURRY_HANDCUFFS"
    | "ESCORT_SONIC"
    | "STADIUM_ENTRY"
    | "GET_HINT";
  payload?: Record<string, string>;
}

export interface DialogueTurn {
  speaker: string;
  displaySpeaker?: string;
  text: string;
  npcId?: NpcId | "player";
  locationId?: LocationId;
  createdAt?: string;
  portraitKey?: string;
  poseKey?: string;
  channel?: "bubble" | "popup";
}

export interface NpcMemoryCard {
  lastAdvice: string;
  lastWarning: string;
  milestones: string[];
}

export interface GameStateData {
  meta: {
    version: string;
    seed: string;
    saveUpdatedAt: string;
  };
  timer: {
    remainingSec: number;
  };
  phase: GamePhase;
  player: {
    name: string;
    location: LocationId;
    inventory: string[];
  };
  mission: {
    objective: string;
    subObjective: string;
  };
  sonic: {
    drunkLevel: number;
    following: boolean;
    location: LocationId;
    patience: number;
    cooldownMoves: number;
  };
  routes: Record<RouteId, { complete: boolean; progress: number }>;
  fail: {
    warnings: Record<"dean" | "luigi" | "frat", number>;
    hardFailed: boolean;
    reason: string;
  };
  safety: {
    status: SafetyStatus;
  };
  world: {
    presentNpcs: Record<LocationId, NpcId[]>;
    visitCounts: Record<LocationId, number>;
    actionUnlocks: {
      beerPongFrat: boolean;
      beerPongSonic: boolean;
      searchDeanDesk: boolean;
      searchQuad: boolean;
      searchEggmanClassroom: boolean;
      searchFratHouse: boolean;
      searchSororityHouse: boolean;
      searchTunnel: boolean;
      searchCafeteria: boolean;
      searchDorms: boolean;
      tradeThunderhead: boolean;
      answerThunderhead: boolean;
      giveWhiskey: boolean;
      giveAsswine: boolean;
      escortSonic: boolean;
      stadiumEntry: boolean;
      searchStadium: boolean;
    };
    minigames: {
      globalRound: number;
      globalStreak: number;
      beerPongRound: number;
      beerPongStreak: number;
      loreRound: number;
      loreStreak: number;
      stripPokerLosses: number;
      stripPokerTableLocked: boolean;
    };
    restrictions: {
      sororityBanned: boolean;
      fratBanned: boolean;
      fratChallengeForced: boolean;
      fratLastSafeLocation: LocationId;
    };
    analytics: {
      soggyBiscuitTriggered: boolean;
    };
    searchCaches: Partial<Record<LocationId, string[]>>;
    intents: Partial<Record<NpcId, NpcIntentState>>;
    events: string[];
  };
  dialogue: {
    source: DialogueSource;
    turns: DialogueTurn[];
    deanStage: DeanConversationStage;
    greetedNpcIds: NpcId[];
    encounterCountByNpc: Partial<Record<NpcId, number>>;
    npcMemory: Partial<Record<NpcId, NpcMemoryCard>>;
  };
  quality: {
    sourceCounts: Record<string, number>;
  };
}

export interface ActionResult {
  ok: boolean;
  message: string;
  gameOver?: boolean;
  won?: boolean;
}
