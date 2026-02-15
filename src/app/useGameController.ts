import { useEffect, useMemo, useRef, useState } from "react";
import { loadContentBundle, type ContentBundle } from "../content/ContentLoader";
import { RouteManager } from "../gameplay/RouteManager";
import { HintManager } from "../gameplay/HintManager";
import { DialogueRouter } from "../dialogue/DialogueRouter";
import { createInitialState } from "../core/state/initialState";
import { SaveStateManager } from "../core/state/SaveStateManager";
import { GameState } from "../core/state/GameState";
import { CampusDirector } from "../world/CampusDirector";
import { StateMachine } from "../core/engine/StateMachine";
import { safeTransition } from "../core/engine/safeTransition";
import {
  addInventory as addInventoryAction,
  removeInventory as removeInventoryAction,
  revealSearchCache as revealSearchCacheAction,
  takeFromSearchCache as takeFromSearchCacheAction
} from "./actions/inventorySearchActions";
import {
  setPressure as setPressureAction,
  syncSonicLocation as syncSonicLocationAction,
  ensureMissionIntakeConsistency as ensureMissionIntakeConsistencyAction
} from "./actions/movementActions";
import { seededRoll as seededRollAction } from "./actions/minigameActions";
import {
  extractPlayerName as extractPlayerNameAction,
  updateNpcMemory,
  parseDisplayTurns,
  inferNpcPoseKey,
  createDialogueTurn
} from "./actions/dialogueActions";
import type { ActionResult, GameStateData, LocationId, NpcId } from "../types/game";

type MoveAction = { type: "MOVE"; target: LocationId };
type GameAction =
  | MoveAction
  | { type: "RESET_GAME" }
  | { type: "START_DIALOGUE"; npcId: NpcId; auto?: boolean }
  | { type: "PLAY_BEER_PONG_SCORE"; cupsHit: number; matchup: "frat" | "sonic" }
  | { type: "PLAY_BEER_PONG_SHOT"; shot: "safe" | "bank" | "hero" }
  | { type: "PLAY_LORE_RIDDLE"; answer: "315" | "quarter" | "midnight" }
  | { type: "PLAY_STRIP_POKER_ROUND" }
  | { type: "START_STRIP_POKER_SESSION" }
  | { type: "END_STRIP_POKER_SESSION" }
  | { type: "PLAY_BEER_PONG_FRAT" }
  | { type: "PLAY_BEER_PONG_SONIC" }
  | { type: "PLAY_SOGGY_BISCUIT" }
  | { type: "SEARCH_DEAN_DESK" }
  | { type: "SEARCH_QUAD" }
  | { type: "SEARCH_EGGMAN_CLASSROOM" }
  | { type: "SEARCH_FRAT_HOUSE" }
  | { type: "SEARCH_SORORITY_HOUSE" }
  | { type: "SEARCH_TUNNEL" }
  | { type: "SEARCH_CAFETERIA" }
  | { type: "SEARCH_DORMS" }
  | { type: "SEARCH_DORM_ROOM" }
  | { type: "SEARCH_STADIUM" }
  | { type: "GET_MYSTERY_MEAT" }
  | { type: "GET_SUPER_DEAN_BEANS" }
  | { type: "TAKE_FOUND_ITEM"; location: LocationId; item: string }
  | { type: "MIX_GLITTER_WARM_BEER" }
  | { type: "MIX_BEANS_WARM_BEER" }
  | { type: "USE_SUPER_DEAN_BEANS" }
  | { type: "USE_EXPIRED_ENERGY_SHOT" }
  | { type: "USE_WARM_BEER" }
  | { type: "USE_GLITTER_BOMB_BREW" }
  | { type: "USE_TURBO_SLUDGE" }
  | { type: "TRADE_THUNDERHEAD" }
  | { type: "ANSWER_THUNDERHEAD"; answer: string }
  | { type: "GIVE_WHISKEY" }
  | { type: "GIVE_ASSWINE" }
  | { type: "ESCORT_SONIC" }
  | { type: "STADIUM_ENTRY" }
  | { type: "GET_HINT" }
  | { type: "SUBMIT_DIALOGUE"; npcId: NpcId; input: string };

const STRIP_POKER_CLOTHING_STAKES = ["Shirt", "Pants", "Shoes", "Socks", "Underwear"] as const;
const LUIGI_CONTRABAND_ITEMS = ["Fake ID Wristband", "Exam Keycard", "Frat Bong"];
const DEAN_ZERO_TOLERANCE_ITEMS = ["Frat Bong"];
const THUNDERHEAD_ACCEPTED_ITEMS = ["Lace Undies", "Sorority Mascara", "Sorority Composite"];
const THUNDERHEAD_REJECTED_ITEMS = ["Hairbrush", "Fake ID Wristband", "Sorority House Key"];
const AUTOSAVE_DIRTY_FLUSH_MS = 12000;

function extractPlayerName(rawInput: string): string | null {
  return extractPlayerNameAction(rawInput);
}

function addInventory(state: GameStateData, item: string): void {
  addInventoryAction(state, item);
}

function removeInventory(state: GameStateData, item: string): void {
  removeInventoryAction(state, item);
}

function revealSearchCache(state: GameStateData, location: LocationId, items: string[]): string[] {
  return revealSearchCacheAction(state, location, items);
}

function takeFromSearchCache(state: GameStateData, location: LocationId, item: string): boolean {
  return takeFromSearchCacheAction(state, location, item);
}

function setPressure(state: GameStateData): void {
  setPressureAction(state);
}

function syncSonicLocation(state: GameStateData): void {
  syncSonicLocationAction(state);
}

function ensureMissionIntakeConsistency(state: GameStateData): void {
  ensureMissionIntakeConsistencyAction(state);
}

function seededRoll(seedInput: string): number {
  return seededRollAction(seedInput);
}

function pickDialogueVariant(lines: string[], seedInput: string): string {
  if (!lines.length) return "";
  let hash = 0;
  for (let i = 0; i < seedInput.length; i += 1) {
    hash = ((hash * 37) + seedInput.charCodeAt(i)) >>> 0;
  }
  return lines[hash % lines.length];
}

export function useGameController(): {
  state: GameStateData | null;
  content: ContentBundle | null;
  ready: boolean;
  performAction: (action: GameAction) => Promise<ActionResult>;
  getNpcsAtCurrentLocation: () => NpcId[];
  getCurrentLocationName: () => string;
} {
  const [ready, setReady] = useState(false);
  const [content, setContent] = useState<ContentBundle | null>(null);
  const [renderState, setRenderState] = useState<GameStateData | null>(null);

  const saveManager = useMemo(() => new SaveStateManager(), []);
  const routeManager = useMemo(() => new RouteManager(), []);
  const hintManager = useMemo(() => new HintManager(), []);
  const director = useMemo(() => new CampusDirector(), []);

  const stateRef = useRef<GameState | null>(null);
  const machineRef = useRef<StateMachine | null>(null);
  const dialogueRef = useRef<DialogueRouter | null>(null);
  const autosaveDirtyRef = useRef(false);
  const lastAutosaveAtRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const loadedContent = await loadContentBundle();
      if (!mounted) return;
      setContent(loadedContent);

      const shouldHardReset = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("reset");
      if (shouldHardReset) {
        saveManager.clear();
        const params = new URLSearchParams(window.location.search);
        params.delete("reset");
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", next);
      }

      const restored = saveManager.load();
      const initial = restored ?? createInitialState();
      if (!initial.dialogue.deanStage) {
        initial.dialogue.deanStage = "intro_pending";
      }
      if (!Array.isArray(initial.dialogue.greetedNpcIds)) {
        initial.dialogue.greetedNpcIds = [];
      }
      if (!initial.dialogue.encounterCountByNpc) {
        initial.dialogue.encounterCountByNpc = {};
      }
      if (!initial.dialogue.npcMemory || typeof initial.dialogue.npcMemory !== "object") {
        initial.dialogue.npcMemory = {};
      }
      if (!initial.world.visitCounts) {
        initial.world.visitCounts = {
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
        };
      } else if (typeof initial.world.visitCounts.dorm_room !== "number") {
        initial.world.visitCounts.dorm_room = 0;
      }
      const existingUnlocks = initial.world.actionUnlocks ?? {};
      initial.world.actionUnlocks = {
        beerPongFrat: Boolean(existingUnlocks.beerPongFrat),
        beerPongSonic: Boolean(existingUnlocks.beerPongSonic),
        searchDeanDesk: Boolean(existingUnlocks.searchDeanDesk),
        searchQuad: Boolean(existingUnlocks.searchQuad),
        searchEggmanClassroom: Boolean(existingUnlocks.searchEggmanClassroom),
        searchFratHouse: Boolean(existingUnlocks.searchFratHouse),
        searchSororityHouse: Boolean(existingUnlocks.searchSororityHouse),
        searchTunnel: Boolean(existingUnlocks.searchTunnel),
        searchCafeteria: Boolean(existingUnlocks.searchCafeteria),
        searchDorms: Boolean(existingUnlocks.searchDorms),
        tradeThunderhead: Boolean(existingUnlocks.tradeThunderhead),
        answerThunderhead: Boolean(existingUnlocks.answerThunderhead),
        giveWhiskey: Boolean(existingUnlocks.giveWhiskey),
        giveAsswine: Boolean(existingUnlocks.giveAsswine),
        escortSonic: Boolean(existingUnlocks.escortSonic),
        stadiumEntry: Boolean(existingUnlocks.stadiumEntry),
        searchStadium: Boolean(existingUnlocks.searchStadium)
      };
      const existingMinigames = initial.world.minigames ?? {};
      initial.world.minigames = {
        globalRound: Number(existingMinigames.globalRound || 0),
        globalStreak: Number(existingMinigames.globalStreak || 0),
        beerPongRound: Number(existingMinigames.beerPongRound || 0),
        beerPongStreak: Number(existingMinigames.beerPongStreak || 0),
        loreRound: Number(existingMinigames.loreRound || 0),
        loreStreak: Number(existingMinigames.loreStreak || 0),
        stripPokerLosses: Number(existingMinigames.stripPokerLosses || 0),
        stripPokerTableLocked: Boolean(existingMinigames.stripPokerTableLocked)
      };
      const existingRestrictions = (initial.world as GameStateData["world"] & { restrictions?: { sororityBanned?: boolean } }).restrictions ?? {};
      initial.world.restrictions = {
        sororityBanned: Boolean(existingRestrictions.sororityBanned)
      };
      const existingAnalytics = (initial.world as GameStateData["world"] & {
        analytics?: { soggyBiscuitTriggered?: boolean };
      }).analytics ?? {};
      initial.world.analytics = {
        soggyBiscuitTriggered: Boolean(existingAnalytics.soggyBiscuitTriggered)
      };
      if (!initial.world.searchCaches || typeof initial.world.searchCaches !== "object") {
        initial.world.searchCaches = {};
      }
      const store = new GameState(initial);
      const machine = new StateMachine(initial.phase);
      const dialogue = new DialogueRouter(loadedContent.dialogueRules.safetyAbortKeywords, {
        maxSentencesPerReply: loadedContent.dialogueRules.maxSentencesPerReply,
        maxBubbleLengthChars: loadedContent.dialogueRules.maxBubbleLengthChars
      });
      if (initial.player.location === "dean_office" && initial.dialogue.turns.length === 0) {
        const encounterCount = initial.dialogue.encounterCountByNpc.dean_cain ?? 0;
        const greet = dialogue.greeting("dean_cain", encounterCount, `${initial.meta.seed}:dean-intro`);
        initial.dialogue.turns.push(createDialogueTurn("dean_cain", greet.text, initial, {
          npcId: "dean_cain",
          displaySpeaker: "Dean Cain",
          poseKey: inferNpcPoseKey("dean_cain", greet.text, initial, "WELCOME_NAME_CHECK")
        }));
        updateNpcMemory(initial, "dean_cain", greet.text);
        initial.dialogue.source = "scripted";
        initial.quality.sourceCounts.scripted = (initial.quality.sourceCounts.scripted ?? 0) + 1;
        initial.dialogue.encounterCountByNpc.dean_cain = encounterCount + 1;
        initial.dialogue.deanStage = "name_pending";
      }
      ensureMissionIntakeConsistency(initial);
      const bootWorld = director.updateWorld(initial);
      initial.world.intents = bootWorld.intents;
      initial.world.presentNpcs = bootWorld.presentNpcs;
      syncSonicLocation(initial);

      stateRef.current = store;
      machineRef.current = machine;
      dialogueRef.current = dialogue;
      autosaveDirtyRef.current = false;
      lastAutosaveAtRef.current = Date.now();

      store.subscribe((state) => {
        setRenderState(state);
      });
      setRenderState(initial);
      setReady(true);
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [saveManager]);

  useEffect(() => {
    if (!ready || !stateRef.current) return;
    const interval = window.setInterval(() => {
      const store = stateRef.current;
      if (!store) return;
      let dirty = false;
      store.patch((state) => {
        if (state.phase === "resolved" || state.fail.hardFailed) return;
        dirty = true;
        state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 1);
        setPressure(state);
        ensureMissionIntakeConsistency(state);
        const world = director.updateWorld(state);
        state.world.intents = world.intents;
        state.world.presentNpcs = world.presentNpcs;
        syncSonicLocation(state);
        ensureMissionIntakeConsistency(state);
        if (state.timer.remainingSec === 0) {
          state.fail.hardFailed = true;
          state.fail.reason = "Time expired before Stadium success.";
          state.phase = "resolved";
        }
      });
      if (dirty) autosaveDirtyRef.current = true;
      if (autosaveDirtyRef.current && Date.now() - lastAutosaveAtRef.current >= AUTOSAVE_DIRTY_FLUSH_MS) {
        const latest = store.get();
        saveManager.save(latest);
        autosaveDirtyRef.current = false;
        lastAutosaveAtRef.current = Date.now();
      }
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [director, ready, saveManager]);

  const performAction = async (action: GameAction): Promise<ActionResult> => {
    const store = stateRef.current;
    const machine = machineRef.current;
    const dialogue = dialogueRef.current;
    if (!store || !machine || !dialogue) {
      return { ok: false, message: "Game not ready." };
    }
    if (action.type === "RESET_GAME") {
      const fresh = createInitialState(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      if (fresh.player.location === "dean_office" && fresh.dialogue.turns.length === 0) {
        const greet = dialogue.greeting("dean_cain", 0, `${fresh.meta.seed}:dean-reset`);
        fresh.dialogue.turns.push(createDialogueTurn("dean_cain", greet.text, fresh, {
          npcId: "dean_cain",
          displaySpeaker: "Dean Cain",
          poseKey: inferNpcPoseKey("dean_cain", greet.text, fresh, "WELCOME_NAME_CHECK")
        }));
        updateNpcMemory(fresh, "dean_cain", greet.text);
        fresh.dialogue.encounterCountByNpc.dean_cain = 1;
        fresh.dialogue.deanStage = "name_pending";
      }
      ensureMissionIntakeConsistency(fresh);
      const world = director.updateWorld(fresh);
      fresh.world.intents = world.intents;
      fresh.world.presentNpcs = world.presentNpcs;
      syncSonicLocation(fresh);
      machineRef.current = new StateMachine(fresh.phase);
      store.set(fresh);
      saveManager.clear();
      saveManager.save(fresh);
      autosaveDirtyRef.current = false;
      lastAutosaveAtRef.current = Date.now();
      return { ok: true, message: "New run started." };
    }
    let result: ActionResult = { ok: true, message: "Action applied." };
    let handledScriptedReply = false;
    const pendingSystemReactions: Array<{ npcId: NpcId; input: string; resetTurns?: boolean }> = [];
    const dialogueAction = action.type === "SUBMIT_DIALOGUE" ? action : null;
    const isSystemDialogue = Boolean(
      dialogueAction && dialogueAction.input.startsWith("__SYSTEM__:")
    );

    store.patch((state) => {
      if (state.fail.hardFailed || state.phase === "resolved") {
        result = { ok: false, message: "Game is already resolved.", gameOver: true };
        return;
      }
      ensureMissionIntakeConsistency(state);
      const world = director.updateWorld(state);
      state.world.intents = world.intents;
      state.world.presentNpcs = world.presentNpcs;
      syncSonicLocation(state);

      switch (action.type) {
        case "MOVE": {
          state.world.minigames.stripPokerTableLocked = false;
          const origin = state.player.location;
          const current = content?.locations.find((loc) => loc.id === state.player.location);
          if (!current || !current.exits.includes(action.target)) {
            result = { ok: false, message: "Route is blocked from this location." };
            return;
          }
          const leftDeanWithoutName = origin === "dean_office" && state.dialogue.deanStage === "name_pending";
          state.player.location = action.target;
          if (state.world.minigames.stripPokerLosses >= STRIP_POKER_CLOTHING_STAKES.length && action.target !== "sorority") {
            state.fail.hardFailed = true;
            state.fail.reason = "Campus police stop you for indecent exposure the moment you leave Sorority.";
            safeTransition(machine, state, "resolved", "MOVE: indecent exposure fail");
            result = { ok: false, message: state.fail.reason, gameOver: true };
            return;
          }
          state.world.visitCounts[action.target] = (state.world.visitCounts[action.target] ?? 0) + 1;
          state.dialogue.turns = [];
          const travelCost = state.player.inventory.includes("Campus Map") ? 10 : 15;
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - travelCost);
          setPressure(state);
          state.world.events.push(`Moved to ${action.target}`);
          if (state.phase === "onboarding" && action.target === "quad") {
            safeTransition(machine, state, "hunt", "MOVE: onboarding complete");
          }
          const postMoveWorld = director.updateWorld(state);
          state.world.intents = postMoveWorld.intents;
          state.world.presentNpcs = postMoveWorld.presentNpcs;
          syncSonicLocation(state);
          const autoNpc = postMoveWorld.presentNpcs[state.player.location]?.[0];
          if (autoNpc) {
                    if (autoNpc === "frat_boys") state.world.actionUnlocks.beerPongFrat = true;
                    if (autoNpc === "sorority_girls") state.world.actionUnlocks.searchSororityHouse = true;
                    if (autoNpc === "thunderhead") {
                      state.world.actionUnlocks.tradeThunderhead = true;
                    }
                    if (autoNpc === "eggman") state.world.actionUnlocks.searchEggmanClassroom = true;
                    if (autoNpc === "luigi") state.world.actionUnlocks.searchQuad = true;
          }
          if (action.target === "quad") state.world.actionUnlocks.searchQuad = true;
          if (action.target === "frat") state.world.actionUnlocks.searchFratHouse = true;
          if (action.target === "tunnel" && state.world.actionUnlocks.tradeThunderhead) state.world.actionUnlocks.searchTunnel = true;
          if (action.target === "cafeteria") state.world.actionUnlocks.searchCafeteria = true;
          if (action.target === "dorms") state.world.actionUnlocks.searchDorms = true;
          if (action.target === "stadium" && state.player.inventory.includes("Student ID")) state.world.actionUnlocks.searchStadium = true;
          if (action.target === "dean_office" && !state.world.presentNpcs.dean_office.includes("dean_cain")) {
            state.world.actionUnlocks.searchDeanDesk = true;
          }

          if (action.target === "dean_office" && state.world.presentNpcs.dean_office.includes("dean_cain")) {
            const deanBust = DEAN_ZERO_TOLERANCE_ITEMS.find((item) => state.player.inventory.includes(item));
            if (deanBust) {
              state.fail.hardFailed = true;
              state.fail.reason = `Dean catches you carrying ${deanBust} and expels you on the spot.`;
              safeTransition(machine, state, "resolved", "MOVE: dean zero tolerance item");
              result = { ok: false, message: state.fail.reason, gameOver: true };
              return;
            }
            if (state.player.inventory.includes("Exam Keycard")) {
              removeInventory(state, "Exam Keycard");
              state.fail.warnings.dean += 1;
              if (state.fail.warnings.dean >= 3) {
                state.fail.hardFailed = true;
                state.fail.reason = "Dean catches you repeatedly carrying restricted office materials and expels you.";
                safeTransition(machine, state, "resolved", "MOVE: dean warning threshold");
                result = { ok: false, message: state.fail.reason, gameOver: true };
                return;
              }
              pendingSystemReactions.push({
                npcId: "dean_cain",
                input: "__SYSTEM__:You arrived carrying Exam Keycard. Dean confiscated it and issues a sharp warning."
              });
            }
          }
          if (state.world.presentNpcs[state.player.location].includes("luigi")) {
            const heldContraband = LUIGI_CONTRABAND_ITEMS.filter((item) => state.player.inventory.includes(item));
            if (heldContraband.length > 0) {
              const flaggedItem = heldContraband[0];
              if (state.fail.warnings.luigi <= 0) {
                state.fail.warnings.luigi = 1;
                removeInventory(state, flaggedItem);
                pendingSystemReactions.push({
                  npcId: "luigi",
                  input: `__SYSTEM__:Luigi caught player carrying ${flaggedItem}, confiscated it, and gives one final warning.`
                });
              } else {
                state.fail.hardFailed = true;
                state.fail.reason = `Luigi catches you with ${flaggedItem} after a warning and shuts your run down.`;
                safeTransition(machine, state, "resolved", "MOVE: luigi contraband repeat");
                result = { ok: false, message: state.fail.reason, gameOver: true };
                return;
              }
            }
          }
          result = leftDeanWithoutName
            ? {
                ok: true,
                message: "You leave before giving your name. Dean calls after you: no name means no ID and no clearance."
              }
            : { ok: true, message: `Travelled to ${action.target}.` };
          return;
        }
        case "START_STRIP_POKER_SESSION": {
          if (state.player.location !== "sorority") {
            result = { ok: false, message: "Poker session starts only in Sorority." };
            return;
          }
          if (state.world.restrictions.sororityBanned) {
            result = { ok: false, message: "Table closed to you. Sorority remembers the theft and your invite is permanently dead." };
            return;
          }
          state.world.minigames.stripPokerTableLocked = true;
          result = { ok: true, message: "Poker table session locked in." };
          return;
        }
        case "END_STRIP_POKER_SESSION": {
          state.world.minigames.stripPokerTableLocked = false;
          result = { ok: true, message: "Poker table session ended." };
          return;
        }
        case "PLAY_BEER_PONG_FRAT": {
          if (state.player.location !== "frat") {
            result = { ok: false, message: "Beer pong is only at Frat." };
            return;
          }
          state.world.minigames.globalRound += 1;
          const roll = seededRoll(`${state.meta.seed}:${state.timer.remainingSec}:frat`);
          if (roll > 0.32) {
            routeManager.progressRouteA(state);
            state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + 1);
            state.world.minigames.globalStreak += 1;
            result = { ok: true, message: "Frat match won. Sonic got more drunk." };
          } else {
            state.fail.warnings.frat += 1;
            state.world.minigames.globalStreak = 0;
            result = { ok: true, message: "Frat loss. One more bad run risks beatdown." };
            if (state.fail.warnings.frat >= 2) {
              state.fail.hardFailed = true;
              state.fail.reason = "Frat beatdown after repeated losses.";
              safeTransition(machine, state, "resolved", "PLAY_BEER_PONG_FRAT fail");
              result = { ok: false, message: state.fail.reason, gameOver: true };
            }
          }
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 50);
          setPressure(state);
          return;
        }
        case "PLAY_BEER_PONG_SHOT": {
          if (state.player.location !== "frat") {
            result = { ok: false, message: "Beer pong mini-game is only at Frat." };
            return;
          }
          state.world.minigames.globalRound += 1;
          state.world.minigames.beerPongRound += 1;
          const odds = action.shot === "safe" ? 0.72 : action.shot === "bank" ? 0.58 : 0.42;
          const roll = seededRoll(`${state.meta.seed}:${state.timer.remainingSec}:beerpong:${action.shot}`);
          if (roll <= odds) {
            routeManager.progressRouteA(state);
            state.world.minigames.beerPongStreak += 1;
            state.world.minigames.globalStreak += 1;
            const gain = action.shot === "safe" ? 1 : 2;
            const streakBonus = state.world.minigames.beerPongStreak >= 2 ? 1 : 0;
            state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + gain + streakBonus);
            result = {
              ok: true,
              message: streakBonus > 0
                ? "Shot lands with a streak bonus. Sonic pounds an extra cup."
                : action.shot === "hero"
                  ? "Hero shot landed. Crowd erupts."
                  : "Shot landed. Sonic drinks."
            };
          } else {
            state.world.minigames.beerPongStreak = 0;
            state.world.minigames.globalStreak = 0;
            if (state.routes.routeA.progress < 1) {
              routeManager.progressRouteA(state);
              result = { ok: true, message: "You miss, but chatter momentum still advances the frat lane." };
            } else {
              state.fail.warnings.frat += 1;
              result = { ok: true, message: "You brick the shot. Frat vibe turns hostile." };
            }
            if (state.fail.warnings.frat >= 2) {
              state.fail.hardFailed = true;
              state.fail.reason = "Frat beatdown after repeated losses.";
              safeTransition(machine, state, "resolved", "PLAY_BEER_PONG_SHOT fail");
              result = { ok: false, message: state.fail.reason, gameOver: true };
            }
          }
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - (action.shot === "safe" ? 30 : action.shot === "bank" ? 40 : 55));
          setPressure(state);
          return;
        }
        case "PLAY_BEER_PONG_SCORE": {
          if (state.player.location !== "frat") {
            result = { ok: false, message: "Beer pong scoring only applies at Frat." };
            return;
          }
          const cups = Math.max(0, Math.min(6, Math.floor(action.cupsHit)));
          state.world.minigames.globalRound += 1;
          state.world.minigames.beerPongRound += 1;
          if (cups >= 6) {
            routeManager.progressRouteA(state);
            routeManager.progressRouteA(state);
            state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + 3);
            state.world.minigames.beerPongStreak += 2;
            state.world.minigames.globalStreak += 2;
            result = { ok: true, message: "Perfect sweep. Frat lane instantly spikes." };
          } else if (cups >= 4) {
            routeManager.progressRouteA(state);
            state.world.minigames.beerPongStreak += 1;
            state.world.minigames.globalStreak += 1;
            state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + 2);
            result = { ok: true, message: "Strong round. Big drunk gain and route progress." };
          } else if (cups >= 2) {
            routeManager.progressRouteA(state);
            state.world.minigames.beerPongStreak = 0;
            state.world.minigames.globalStreak = 0;
            state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + 1);
            result = { ok: true, message: "Solid round. You keep momentum." };
          } else {
            state.world.minigames.beerPongStreak = 0;
            state.world.minigames.globalStreak = 0;
            state.fail.warnings.frat += 1;
            result = { ok: true, message: "Cold round. Frat patience drops." };
          }
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 45);
          setPressure(state);
          if (state.fail.warnings.frat >= 2) {
            state.fail.hardFailed = true;
            state.fail.reason = "Frat beatdown after repeated losses.";
            safeTransition(machine, state, "resolved", "PLAY_BEER_PONG_SCORE fail");
            result = { ok: false, message: state.fail.reason, gameOver: true };
          }
          const matchup = action.matchup;
          if (matchup === "sonic") {
            pendingSystemReactions.push({
              npcId: "sonic",
              input: `__SYSTEM__:Beer pong round ended versus Sonic with cupsHit=${cups}. Give one short in-character reaction tied to performance.`
            });
          } else {
            pendingSystemReactions.push({
              npcId: "frat_boys",
              input: `__SYSTEM__:Beer pong round ended versus Frat Boys with cupsHit=${cups}. Give one short taunting/reactive in-character line.`
            });
          }
          return;
        }
        case "PLAY_BEER_PONG_SONIC": {
          const sonicPresentHere = state.world.presentNpcs[state.player.location]?.includes("sonic");
          if (!sonicPresentHere && state.player.location !== "frat") {
            result = { ok: false, message: "Find Sonic first, then challenge him." };
            return;
          }
          state.world.actionUnlocks.beerPongSonic = true;
          state.world.actionUnlocks.beerPongFrat = true;
          state.sonic.location = "frat";
          if (state.player.location !== "frat") {
            state.player.location = "frat";
            state.world.visitCounts.frat = (state.world.visitCounts.frat ?? 0) + 1;
            state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 15);
          }
          state.dialogue.turns = [];
          const refreshed = director.updateWorld(state);
          state.world.intents = refreshed.intents;
          state.world.presentNpcs = refreshed.presentNpcs;
          syncSonicLocation(state);
          result = { ok: true, message: "Sonic grins and drags you to Frat. Table is live." };
          return;
        }
        case "PLAY_SOGGY_BISCUIT": {
          if (state.player.location !== "frat") {
            result = { ok: false, message: "That stunt only triggers at Frat." };
            return;
          }
          state.world.analytics.soggyBiscuitTriggered = true;
          state.fail.hardFailed = true;
          state.fail.reason = "You drop out from embarassment.";
          safeTransition(machine, state, "resolved", "PLAY_SOGGY_BISCUIT easter-egg fail");
          result = { ok: false, message: state.fail.reason, gameOver: true };
          return;
        }
        case "SEARCH_DEAN_DESK": {
          if (state.player.location !== "dean_office") {
            result = { ok: false, message: "Dean desk can only be searched in his office." };
            return;
          }
          if (state.world.presentNpcs.dean_office.includes("dean_cain")) {
            result = { ok: false, message: "Dean is in office. You can't search his desk right now." };
            return;
          }
          const found = revealSearchCache(state, "dean_office", ["Dean Whiskey", "Exam Keycard"]);
          result = { ok: true, message: `Desk stash spotted: ${found.join(", ")}. Choose what to take.` };
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 35);
          setPressure(state);
          return;
        }
        case "SEARCH_QUAD": {
          if (state.player.location !== "quad") {
            result = { ok: false, message: "You can only search while at Quad." };
            return;
          }
          const found = revealSearchCache(state, "quad", ["Campus Map", "Lost Lanyard"]);
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 10);
          setPressure(state);
          result = { ok: true, message: `You scan the benches and spot: ${found.join(", ")}.` };
          return;
        }
        case "SEARCH_EGGMAN_CLASSROOM": {
          if (state.player.location !== "eggman_classroom") {
            result = { ok: false, message: "Classroom stash is only in Eggman Classroom." };
            return;
          }
          const found = revealSearchCache(state, "eggman_classroom", ["Lecture Notes", "Remote Battery"]);
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 12);
          setPressure(state);
          result = { ok: true, message: `You check the lab desks and find: ${found.join(", ")}.` };
          return;
        }
        case "SEARCH_FRAT_HOUSE": {
          if (state.player.location !== "frat") {
            result = { ok: false, message: "Frat stash is only at Frat." };
            return;
          }
          if (!state.world.actionUnlocks.beerPongFrat) {
            result = { ok: false, message: "You need to break the ice with the frat crowd first." };
            return;
          }
          if (state.world.presentNpcs.frat.includes("frat_boys")) {
            state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 12);
            setPressure(state);
            result = { ok: true, message: "Diesel catches you snooping and laughs you out of the room. Come back when the house isn't watching." };
            return;
          }
          const found = revealSearchCache(state, "frat", ["Frat Bong", "Ping Pong Paddle", "Party Wristband"]);
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 16);
          setPressure(state);
          result = { ok: true, message: `You poke around the house and notice: ${found.join(", ")}.` };
          return;
        }
        case "SEARCH_SORORITY_HOUSE": {
          if (state.player.location !== "sorority") {
            result = { ok: false, message: "Search works only inside Sorority." };
            return;
          }
          if (state.world.restrictions.sororityBanned) {
            result = { ok: false, message: "Sorority house is locked to you. Apple posted your name and nobody forgot." };
            return;
          }
          const girlsPresent = state.world.presentNpcs.sorority.includes("sorority_girls");
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 18);
          setPressure(state);
          if (girlsPresent) {
            pendingSystemReactions.push({
              npcId: "sorority_girls",
              input: "__SYSTEM__:You tried to search while Sorority Girls were present. React annoyed and territorial."
            });
            result = { ok: true, message: "Apple spots you snooping, Fedora starts clapping sarcastically, and the room turns hostile. You get warned off." };
            return;
          }
          const found = revealSearchCache(state, "sorority", [
            "Lace Undies",
            "Hairbrush",
            "Glitter Flask",
            "Fake ID Wristband",
            "Sorority Mascara",
            "Sorority Composite",
            "Sorority House Key"
          ]);
          result = { ok: true, message: `You sweep the house and spot: ${found.join(", ")}. Decide what to take.` };
          return;
        }
        case "SEARCH_TUNNEL": {
          if (state.player.location !== "tunnel") {
            result = { ok: false, message: "Tunnel cache is only in Tunnel." };
            return;
          }
          const found = revealSearchCache(state, "tunnel", ["Pocket Flashlight", "Rusty Token"]);
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 12);
          setPressure(state);
          result = { ok: true, message: `You search the damp walls and find: ${found.join(", ")}.` };
          return;
        }
        case "SEARCH_CAFETERIA": {
          if (state.player.location !== "cafeteria") {
            result = { ok: false, message: "Search works only in Cafeteria." };
            return;
          }
          state.world.actionUnlocks.searchCafeteria = true;
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 12);
          setPressure(state);
          const found = revealSearchCache(state, "cafeteria", ["Mystery Meat", "Super Dean Beans", "Expired Energy Shot"]);
          result = { ok: true, message: `You search the line and spot: ${found.join(", ")}. Take only what helps.` };
          return;
        }
        case "SEARCH_DORMS": {
          if (state.player.location !== "dorms") {
            result = { ok: false, message: "Search works only in Dorm Hall." };
            return;
          }
          const found = revealSearchCache(state, "dorms", ["Spare Socks", "RA Whistle"]);
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 10);
          setPressure(state);
          result = { ok: true, message: `Dorm hallway loot spotted: ${found.join(", ")}.` };
          return;
        }
        case "SEARCH_DORM_ROOM": {
          if (state.player.location !== "dorm_room") {
            result = { ok: false, message: "Search works only in Dorm Room." };
            return;
          }
          state.world.actionUnlocks.giveWhiskey = true;
          state.world.actionUnlocks.giveAsswine = true;
          state.world.actionUnlocks.escortSonic = true;
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 12);
          setPressure(state);
          const found = revealSearchCache(state, "dorm_room", ["Warm Beer", "Laundry Detergent", "Extra Sock"]);
          result = { ok: true, message: `You scan the room and spot: ${found.join(", ")}.` };
          return;
        }
        case "SEARCH_STADIUM": {
          if (state.player.location !== "stadium") {
            result = { ok: false, message: "Search works only at Stadium gate." };
            return;
          }
          const found = revealSearchCache(state, "stadium", ["Gate Stamp", "Security Schedule"]);
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 8);
          setPressure(state);
          result = { ok: true, message: `Near the gate, you spot: ${found.join(", ")}.` };
          return;
        }
        case "TAKE_FOUND_ITEM": {
          if (state.player.location !== action.location) {
            result = { ok: false, message: "You must be at that location to take this item." };
            return;
          }
          if (action.location === "sorority" && state.world.restrictions.sororityBanned) {
            result = { ok: false, message: "You are blacklisted at Sorority. Touch nothing and leave." };
            return;
          }
          if (action.location === "sorority" && state.world.presentNpcs.sorority.includes("sorority_girls")) {
            state.world.restrictions.sororityBanned = true;
            state.world.searchCaches.sorority = [];
            state.player.location = "quad";
            state.world.visitCounts.quad = (state.world.visitCounts.quad ?? 0) + 1;
            pendingSystemReactions.push({
              npcId: "sorority_girls",
              input: "__SYSTEM__:You attempted to steal in front of Sorority Girls. They eject you to Quad and permanently ban you from Sorority house.",
              resetTurns: true
            });
            result = { ok: false, message: "Caught stealing in front of Sorority Girls. They throw you out to Quad and ban you from the house." };
            return;
          }
          const took = takeFromSearchCache(state, action.location, action.item);
          if (!took) {
            result = { ok: false, message: `${action.item} is no longer available here.` };
            return;
          }
          if (action.location === "frat" && action.item === "Frat Bong" && state.world.presentNpcs.frat.includes("frat_boys")) {
            state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 18);
            setPressure(state);
            pendingSystemReactions.push({
              npcId: "frat_boys",
              input: "__SYSTEM__:You grabbed Frat Bong in front of Frat Boys. Give a short taunting warning."
            });
          }
          if (action.item === "Dean Whiskey") routeManager.completeRouteB(state);
          result = { ok: true, message: `Taken: ${action.item}.` };
          return;
        }
        case "GET_MYSTERY_MEAT": {
          if (state.player.location !== "cafeteria") {
            result = { ok: false, message: "Mystery Meat is in Cafeteria." };
            return;
          }
          addInventory(state, "Mystery Meat");
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 20);
          result = { ok: true, message: "You grabbed Mystery Meat." };
          return;
        }
        case "GET_SUPER_DEAN_BEANS": {
          if (state.player.location !== "cafeteria") {
            result = { ok: false, message: "Beans are in Cafeteria." };
            return;
          }
          addInventory(state, "Super Dean Beans");
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 20);
          result = { ok: true, message: "You grabbed Super Dean Beans." };
          return;
        }
        case "MIX_GLITTER_WARM_BEER": {
          if (state.player.location !== "dorm_room") {
            result = { ok: false, message: "Mix items in Dorm Room." };
            return;
          }
          if (!state.player.inventory.includes("Glitter Flask") || !state.player.inventory.includes("Warm Beer")) {
            result = { ok: false, message: "Need Glitter Flask and Warm Beer." };
            return;
          }
          removeInventory(state, "Glitter Flask");
          removeInventory(state, "Warm Beer");
          addInventory(state, "Glitter Bomb Brew");
          result = { ok: true, message: "You mix a Glitter Bomb Brew. High chaos potential." };
          return;
        }
        case "MIX_BEANS_WARM_BEER": {
          if (state.player.location !== "dorm_room") {
            result = { ok: false, message: "Mix items in Dorm Room." };
            return;
          }
          if (!state.player.inventory.includes("Super Dean Beans") || !state.player.inventory.includes("Warm Beer")) {
            result = { ok: false, message: "Need Super Dean Beans and Warm Beer." };
            return;
          }
          removeInventory(state, "Super Dean Beans");
          removeInventory(state, "Warm Beer");
          addInventory(state, "Turbo Sludge");
          result = { ok: true, message: "You mix Turbo Sludge. Strong effect, risky aftermath." };
          return;
        }
        case "TRADE_THUNDERHEAD": {
          if (state.player.location !== "tunnel") {
            result = { ok: false, message: "Thunderhead trade is only in Tunnel." };
            return;
          }
          const acceptedItem = THUNDERHEAD_ACCEPTED_ITEMS.find((item) => state.player.inventory.includes(item));
          const rejectedItem = THUNDERHEAD_REJECTED_ITEMS.find((item) => state.player.inventory.includes(item));
          if (!acceptedItem && !rejectedItem) {
            result = { ok: false, message: "Thunderhead only wants Sorority contraband. Bring something from Sorority." };
            return;
          }
          if (!acceptedItem && rejectedItem) {
            result = { ok: true, message: `Thunderhead inspects ${rejectedItem} and says no deal. He wants spicier Sorority contraband.` };
            return;
          }
          if (!acceptedItem) {
            result = { ok: false, message: "No accepted trade item available." };
            return;
          }
          removeInventory(state, acceptedItem);
          addInventory(state, "Asswine");
          routeManager.completeRouteC(state);
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 25);
          result = { ok: true, message: `Thunderhead accepts ${acceptedItem} and hands over Asswine.` };
          return;
        }
        case "ANSWER_THUNDERHEAD": {
          if (state.player.location !== "tunnel") {
            result = { ok: false, message: "Lore answer can only be used in Tunnel." };
            return;
          }
          if (action.answer.replace(":", "") === "315") {
            addInventory(state, "Asswine");
            routeManager.completeRouteC(state);
            result = { ok: true, message: "Correct lore answer. Asswine unlocked." };
          } else {
            result = { ok: true, message: "Wrong answer. Route confidence dropped." };
          }
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 20);
          return;
        }
        case "PLAY_LORE_RIDDLE": {
          result = { ok: false, message: "Thunderhead scrapped the lore game. He only responds to weird trades now." };
          return;
        }
        case "PLAY_STRIP_POKER_ROUND": {
          if (state.player.location !== "sorority") {
            result = { ok: false, message: "Strip poker is only available in Sorority." };
            return;
          }
          if (state.world.restrictions.sororityBanned) {
            result = { ok: false, message: "Sorority table ban is active. No games for you after that theft stunt." };
            return;
          }
          if (!state.world.minigames.stripPokerTableLocked) {
            const occupants = state.world.presentNpcs.sorority;
            const girlsPresent = occupants.includes("sorority_girls");
            if (!girlsPresent) {
              result = { ok: false, message: "No game right now. Sorority Girls are not at the table." };
              return;
            }
            state.world.minigames.stripPokerTableLocked = true;
          }
          state.world.minigames.globalRound += 1;
          state.world.minigames.globalStreak = 0;
          if (state.player.inventory.includes("Spare Socks")) {
            removeInventory(state, "Spare Socks");
            state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 20);
            setPressure(state);
            result = { ok: true, message: "You toss Spare Socks into the side pot to dodge a clothing forfeit this hand." };
            return;
          }
          state.world.minigames.stripPokerLosses += 1;
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 55);
          setPressure(state);
          const losses = state.world.minigames.stripPokerLosses;
          const forfeited = STRIP_POKER_CLOTHING_STAKES[Math.min(losses - 1, STRIP_POKER_CLOTHING_STAKES.length - 1)];
          if (losses >= STRIP_POKER_CLOTHING_STAKES.length) {
            state.world.minigames.stripPokerTableLocked = false;
            state.player.location = "quad";
            state.fail.hardFailed = true;
            state.fail.reason = "You lose every clothing stake. Sorority kicks you out, and campus expels you for indecent exposure.";
            safeTransition(machine, state, "resolved", "PLAY_STRIP_POKER_ROUND fail");
            result = { ok: false, message: state.fail.reason, gameOver: true };
            return;
          }
          result = { ok: true, message: `You lose the hand and forfeit ${forfeited}. They keep you at the table for another hand.` };
          return;
        }
        case "GIVE_WHISKEY": {
          if (state.player.location !== "dorm_room") {
            result = { ok: false, message: "Give drinks in Dorm Room." };
            return;
          }
          if (!state.player.inventory.includes("Dean Whiskey")) {
            result = { ok: false, message: "No Dean Whiskey in inventory." };
            return;
          }
          removeInventory(state, "Dean Whiskey");
          state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + 2);
          result = { ok: true, message: "Sonic drank Dean Whiskey." };
          return;
        }
        case "GIVE_ASSWINE": {
          if (state.player.location !== "dorm_room") {
            result = { ok: false, message: "Give drinks in Dorm Room." };
            return;
          }
          if (!state.player.inventory.includes("Asswine")) {
            result = { ok: false, message: "No Asswine in inventory." };
            return;
          }
          removeInventory(state, "Asswine");
          state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + 3);
          result = { ok: true, message: "Sonic took Asswine and got heavily drunk." };
          return;
        }
        case "USE_SUPER_DEAN_BEANS": {
          if (state.player.location !== "dorm_room") {
            result = { ok: false, message: "Use this in Dorm Room." };
            return;
          }
          if (!state.player.inventory.includes("Super Dean Beans")) {
            result = { ok: false, message: "No Super Dean Beans in inventory." };
            return;
          }
          removeInventory(state, "Super Dean Beans");
          const roll = seededRoll(`${state.meta.seed}:${state.timer.remainingSec}:beans`);
          if (roll > 0.45) {
            state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + 2);
            result = { ok: true, message: "Beans hit hard. Sonic gets looser fast." };
          } else {
            state.sonic.drunkLevel = Math.max(0, state.sonic.drunkLevel - 1);
            state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 35);
            result = { ok: true, message: "Beans backfire. Sonic gets weirdly alert." };
          }
          return;
        }
        case "USE_EXPIRED_ENERGY_SHOT": {
          if (state.player.location !== "dorm_room") {
            result = { ok: false, message: "Use this in Dorm Room." };
            return;
          }
          if (!state.player.inventory.includes("Expired Energy Shot")) {
            result = { ok: false, message: "No Expired Energy Shot in inventory." };
            return;
          }
          removeInventory(state, "Expired Energy Shot");
          state.sonic.drunkLevel = Math.max(0, state.sonic.drunkLevel - 1);
          state.fail.warnings.luigi += 1;
          result = { ok: true, message: "Bad call. Sonic crashes and trust drops." };
          return;
        }
        case "USE_WARM_BEER": {
          if (state.player.location !== "dorm_room") {
            result = { ok: false, message: "Use this in Dorm Room." };
            return;
          }
          if (!state.player.inventory.includes("Warm Beer")) {
            result = { ok: false, message: "No Warm Beer in inventory." };
            return;
          }
          removeInventory(state, "Warm Beer");
          state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + 1);
          result = { ok: true, message: "Warm beer works. Not elegant, but effective." };
          return;
        }
        case "USE_GLITTER_BOMB_BREW": {
          if (state.player.location !== "dorm_room") {
            result = { ok: false, message: "Use this in Dorm Room." };
            return;
          }
          if (!state.player.inventory.includes("Glitter Bomb Brew")) {
            result = { ok: false, message: "No Glitter Bomb Brew in inventory." };
            return;
          }
          removeInventory(state, "Glitter Bomb Brew");
          const roll = seededRoll(`${state.meta.seed}:${state.timer.remainingSec}:glitter-bomb`);
          if (roll > 0.35) {
            state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + 2);
            state.world.actionUnlocks.escortSonic = true;
            result = { ok: true, message: "Chaos drink lands. Sonic is tipsy and follows the vibe." };
          } else {
            state.fail.warnings.dean += 1;
            result = { ok: true, message: "Drink explodes socially. You draw heat from campus staff." };
          }
          return;
        }
        case "USE_TURBO_SLUDGE": {
          if (state.player.location !== "dorm_room") {
            result = { ok: false, message: "Use this in Dorm Room." };
            return;
          }
          if (!state.player.inventory.includes("Turbo Sludge")) {
            result = { ok: false, message: "No Turbo Sludge in inventory." };
            return;
          }
          removeInventory(state, "Turbo Sludge");
          const roll = seededRoll(`${state.meta.seed}:${state.timer.remainingSec}:turbo-sludge`);
          if (roll > 0.5) {
            state.sonic.drunkLevel = Math.min(4, state.sonic.drunkLevel + 3);
            result = { ok: true, message: "Turbo Sludge hits. Sonic is fully loaded." };
          } else {
            state.sonic.drunkLevel = Math.max(0, state.sonic.drunkLevel - 2);
            state.fail.warnings.luigi += 1;
            result = { ok: true, message: "Turbo Sludge backfires hard. Sonic sobers and chaos rises." };
          }
          return;
        }
        case "ESCORT_SONIC": {
          if (state.sonic.drunkLevel < 3) {
            result = { ok: false, message: "Sonic is not in the right state to follow yet." };
            return;
          }
          state.sonic.following = true;
          state.sonic.location = state.player.location;
          state.world.actionUnlocks.stadiumEntry = true;
          safeTransition(machine, state, "escort", "ESCORT_SONIC success");
          result = { ok: true, message: "Sonic is following you." };
          return;
        }
        case "STADIUM_ENTRY": {
          if (state.player.location !== "stadium") {
            result = { ok: false, message: "Stadium entry can only happen at Stadium." };
            return;
          }
          if (!state.player.inventory.includes("Student ID")) {
            if (state.player.inventory.includes("Fake ID Wristband")) {
              removeInventory(state, "Fake ID Wristband");
              state.fail.warnings.dean += 1;
              if (state.fail.warnings.dean >= 2) {
                state.fail.hardFailed = true;
                state.fail.reason = "Security reports your fake credentials to Dean. You are expelled.";
                safeTransition(machine, state, "resolved", "STADIUM_ENTRY fake credentials fail");
                result = { ok: false, message: state.fail.reason, gameOver: true };
                return;
              }
              result = {
                ok: false,
                message: "Security burns your fake wristband and records your name. Bring a real Student ID next time."
              };
              return;
            }
            result = { ok: false, message: "You need your Student ID before security will allow entry." };
            return;
          }
          if (routeManager.canWin(state)) {
            safeTransition(machine, state, "resolved", "STADIUM_ENTRY success");
            result = { ok: true, message: "Mission complete. Sonic reached Stadium.", won: true, gameOver: true };
          } else {
            result = { ok: false, message: "Win conditions not met. You are missing a key setup." };
          }
          return;
        }
        case "GET_HINT": {
          result = { ok: true, message: hintManager.getHint(state) };
          state.timer.remainingSec = Math.max(0, state.timer.remainingSec - 8);
          setPressure(state);
          return;
        }
        case "START_DIALOGUE": {
          if (action.npcId === "frat_boys") state.world.actionUnlocks.beerPongFrat = true;
          if (action.npcId === "sorority_girls") state.world.actionUnlocks.searchSororityHouse = true;
          if (action.npcId === "thunderhead") {
            state.world.actionUnlocks.tradeThunderhead = true;
            state.world.actionUnlocks.searchTunnel = true;
          }
          if (action.npcId === "tails" || action.npcId === "eggman") {
            state.world.actionUnlocks.searchCafeteria = true;
          }
          if (action.npcId === "eggman" && state.player.location === "eggman_classroom") {
            state.world.actionUnlocks.searchEggmanClassroom = true;
          }
          if (action.npcId === "knuckles" && state.player.location === "dorms") {
            state.world.actionUnlocks.searchDorms = true;
          }
          result = {
            ok: true,
            message: action.auto ? `${action.npcId} engaged.` : `Focused on ${action.npcId}.`
          };
          return;
        }
        case "SUBMIT_DIALOGUE": {
          const dialogueInput = isSystemDialogue ? action.input.replace(/^__SYSTEM__:\s*/i, "").trim() : action.input;
          if (!state.dialogue.greetedNpcIds.includes(action.npcId)) {
            state.dialogue.greetedNpcIds.push(action.npcId);
            state.dialogue.encounterCountByNpc[action.npcId] = (state.dialogue.encounterCountByNpc[action.npcId] ?? 0) + 1;
          }
          if (!isSystemDialogue) {
            state.dialogue.turns.push(createDialogueTurn("You", dialogueInput, state, { npcId: "player" }));
          }
          const input = dialogueInput.toLowerCase();
          if (action.npcId === "dean_cain" && /(idiot|stupid|trash|screw you|bite me|hate|fuck you)/i.test(input)) {
            state.fail.hardFailed = true;
            state.fail.reason = "Dean expels you immediately for direct disrespect.";
            safeTransition(machine, state, "resolved", "SUBMIT_DIALOGUE dean disrespect fail");
            result = { ok: false, message: state.fail.reason, gameOver: true };
            return;
          }
          if (action.npcId === "dean_cain" && state.dialogue.deanStage === "name_pending") {
            const parsedName = extractPlayerName(dialogueInput);
            if (parsedName) {
              state.player.name = parsedName;
              addInventory(state, "Student ID");
              state.dialogue.deanStage = "mission_given";
              state.mission.objective = "Get Sonic to Stadium.";
              state.mission.subObjective = "Build a route, intoxicate Sonic, escort him, and clear gate security.";
              const handoffLine = pickDialogueVariant([
                `${parsedName}, right. Student ID issued. Mission starts now: get Sonic to Stadium and do not embarrass this office.`,
                `${parsedName}, got it. You're cleared. Get Sonic to Stadium before this turns into my paperwork nightmare.`,
                `${parsedName}, logged. ID is active. Assignment is Sonic to Stadium, fast and clean.`,
                `${parsedName}, confirmed. Mission: move Sonic to Stadium and keep this campus out of scandal.`,
                `${parsedName}, you're on record. Student ID is live. Deliver Sonic to Stadium and keep it professional enough to deny later.`
              ], `${state.meta.seed}:${parsedName}:${state.timer.remainingSec}:dean-handoff`);
              state.dialogue.turns.push(createDialogueTurn(
                "dean_cain",
                handoffLine,
                state,
                {
                  npcId: "dean_cain",
                  displaySpeaker: "Dean Cain",
                  poseKey: inferNpcPoseKey("dean_cain", handoffLine, state, "MISSION_HANDOFF")
                }
              ));
              updateNpcMemory(state, "dean_cain", handoffLine);
              state.dialogue.source = "scripted";
              state.quality.sourceCounts.scripted = (state.quality.sourceCounts.scripted ?? 0) + 1;
              result = { ok: true, message: "Dean logs your name, issues your ID, and assigns the mission." };
              handledScriptedReply = true;
              return;
            }
            if (/(later|bye|leave|not telling|none of your business|no chance)/i.test(input)) {
              state.dialogue.turns.push(createDialogueTurn(
                "dean_cain",
                "No name, no ID, no campus clearance. Come back when you can answer one basic question.",
                state,
                {
                  npcId: "dean_cain",
                  displaySpeaker: "Dean Cain",
                  poseKey: inferNpcPoseKey("dean_cain", "No name, no ID, no campus clearance. Come back when you can answer one basic question.", state, "DISMISSAL")
                }
              ));
            updateNpcMemory(state, "dean_cain", "No name, no ID, no campus clearance. Come back when you can answer one basic question.");
              state.dialogue.source = "scripted";
              state.quality.sourceCounts.scripted = (state.quality.sourceCounts.scripted ?? 0) + 1;
              result = { ok: true, message: "Dean refuses to proceed without your name." };
              handledScriptedReply = true;
              return;
            }
            const deanRetryPool = [
              "Quick reset: I just need your first name before I issue Student ID.",
              "Still waiting on your name, old sport. Name first, then mission.",
              "Save the chatter for later. Give me your first name and we are good.",
              "You're one answer away from clearance. First name, then we move.",
              "I can not issue mission access without your name. Keep it simple."
            ];
            const pick = Math.abs((state.timer.remainingSec + input.length) % deanRetryPool.length);
            state.dialogue.turns.push(createDialogueTurn("dean_cain", deanRetryPool[pick], state, {
              npcId: "dean_cain",
              displaySpeaker: "Dean Cain",
              poseKey: inferNpcPoseKey("dean_cain", deanRetryPool[pick], state, "WELCOME_NAME_CHECK")
            }));
            updateNpcMemory(state, "dean_cain", deanRetryPool[pick]);
            result = { ok: true, message: "Dean asks for your name before issuing Student ID." };
            state.dialogue.source = "scripted";
            state.quality.sourceCounts.scripted = (state.quality.sourceCounts.scripted ?? 0) + 1;
            handledScriptedReply = true;
            return;
          }
          if (/(beer pong|pong|frat game|challenge)/i.test(input)) state.world.actionUnlocks.beerPongFrat = true;
          if (/(desk|office|drawer|whiskey)/i.test(input)) state.world.actionUnlocks.searchDeanDesk = true;
          if (/(quad|bench|lost|lanyard|map)/i.test(input)) state.world.actionUnlocks.searchQuad = true;
          if (/(classroom|lab|eggman room|lecture)/i.test(input)) state.world.actionUnlocks.searchEggmanClassroom = true;
          if (/(frat stash|basement|bong|party gear)/i.test(input)) state.world.actionUnlocks.searchFratHouse = true;
          if (/(search|sorority|house|snoop)/i.test(input)) state.world.actionUnlocks.searchSororityHouse = true;
          if (/(tunnel|cache|flashlight|token)/i.test(input)) state.world.actionUnlocks.searchTunnel = true;
          if (/(cafeteria|food|meat|beans|search)/i.test(input)) state.world.actionUnlocks.searchCafeteria = true;
          if (/(dorm hall|dorms|sock|ra whistle)/i.test(input)) state.world.actionUnlocks.searchDorms = true;
          if (/(stadium gate|gate|security schedule|stamp)/i.test(input)) state.world.actionUnlocks.searchStadium = true;
          if (/(trade|tunnel|asswine|sorority|undies|brush)/i.test(input)) {
            state.world.actionUnlocks.tradeThunderhead = true;
          }
          if (/(drink|give|booze|escort|stadium)/i.test(input)) {
            state.world.actionUnlocks.giveWhiskey = true;
            state.world.actionUnlocks.giveAsswine = true;
            state.world.actionUnlocks.escortSonic = true;
          }
          if (action.npcId === "luigi" && /(idiot|stupid|useless|hate)/i.test(action.input)) {
            state.fail.warnings.luigi += 1;
            if (state.fail.warnings.luigi >= 3) {
              state.fail.hardFailed = true;
              state.fail.reason = "Luigi escalated after repeated disrespect.";
              safeTransition(machine, state, "resolved", "SUBMIT_DIALOGUE luigi disrespect fail");
              result = { ok: false, message: state.fail.reason, gameOver: true };
              return;
            }
          }
          result = { ok: true, message: "..." };
        }
      }
    });
    store.patch((state) => {
      ensureMissionIntakeConsistency(state);
      const world = director.updateWorld(state);
      state.world.intents = world.intents;
      state.world.presentNpcs = world.presentNpcs;
      syncSonicLocation(state);
    });

    if (pendingSystemReactions.length > 0) {
      for (const reaction of pendingSystemReactions) {
        const latest = store.get();
        if (latest.phase === "resolved" || latest.fail.hardFailed) break;
        const reply = await dialogue.reply(reaction.npcId, reaction.input, latest);
        store.patch((state) => {
          if (reaction.resetTurns) state.dialogue.turns = [];
          const parsedTurns = parseDisplayTurns(reaction.npcId, reply.text, reply.displaySpeaker);
          parsedTurns.forEach((turn) => state.dialogue.turns.push(createDialogueTurn(turn.speaker, turn.text, state, {
            npcId: reaction.npcId,
            displaySpeaker: turn.displaySpeaker,
            poseKey: inferNpcPoseKey(reaction.npcId, turn.text, state, reply.intent)
          })));
          state.dialogue.source = reply.source;
          state.quality.sourceCounts[reply.source] = (state.quality.sourceCounts[reply.source] ?? 0) + 1;
          updateNpcMemory(state, reaction.npcId, reply.text);
          ensureMissionIntakeConsistency(state);
          const world = director.updateWorld(state);
          state.world.intents = world.intents;
          state.world.presentNpcs = world.presentNpcs;
          syncSonicLocation(state);
        });
      }
    }

    if (dialogueAction && !handledScriptedReply) {
      const snapshot = store.get();
      const dialogueInput = isSystemDialogue
        ? dialogueAction.input.replace(/^__SYSTEM__:\s*/i, "").trim()
        : dialogueAction.input;
      let provisionalCreatedAt: string | undefined;
      if (!isSystemDialogue) {
        store.patch((state) => {
          const provisional = createDialogueTurn(dialogueAction.npcId, "...", state, {
            npcId: dialogueAction.npcId,
            displaySpeaker: dialogueAction.npcId.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
            poseKey: "neutral"
          });
          provisionalCreatedAt = provisional.createdAt;
          state.dialogue.turns.push(provisional);
        });
      }
      const reply = await dialogue.reply(dialogueAction.npcId, dialogueInput, snapshot);
      store.patch((state) => {
        if (provisionalCreatedAt) {
          state.dialogue.turns = state.dialogue.turns.filter((turn) => !(turn.createdAt === provisionalCreatedAt && turn.text === "..."));
        }
        state.dialogue.source = reply.source;
        const parsedTurns = parseDisplayTurns(dialogueAction.npcId, reply.text, reply.displaySpeaker);
        parsedTurns.forEach((turn) => state.dialogue.turns.push(createDialogueTurn(turn.speaker, turn.text, state, {
          npcId: dialogueAction.npcId,
          displaySpeaker: turn.displaySpeaker,
          poseKey: inferNpcPoseKey(dialogueAction.npcId, turn.text, state, reply.intent)
        })));
        state.quality.sourceCounts[reply.source] = (state.quality.sourceCounts[reply.source] ?? 0) + 1;
        updateNpcMemory(state, dialogueAction.npcId, reply.text);
        ensureMissionIntakeConsistency(state);
        const world = director.updateWorld(state);
        state.world.intents = world.intents;
        state.world.presentNpcs = world.presentNpcs;
        syncSonicLocation(state);
        if (reply.safetyAbort) {
          state.safety.status = "abort";
          state.fail.hardFailed = true;
          state.fail.reason = "Safety policy triggered.";
          safeTransition(machine, state, "resolved", "SUBMIT_DIALOGUE safety abort");
          result = { ok: false, message: reply.text, gameOver: true };
          return;
        }
        result = { ok: true, message: reply.text };
      });
    }

    saveManager.save(store.get());
    autosaveDirtyRef.current = false;
    lastAutosaveAtRef.current = Date.now();
    return result;
  };

  const getNpcsAtCurrentLocation = (): NpcId[] => {
    const state = stateRef.current?.get();
    if (!state) return [];
    return state.world.presentNpcs[state.player.location] ?? [];
  };

  const getCurrentLocationName = (): string => {
    const state = stateRef.current?.get();
    if (!state || !content) return "";
    return content.locations.find((l) => l.id === state.player.location)?.name ?? state.player.location;
  };

  return {
    state: renderState,
    content,
    ready,
    performAction,
    getNpcsAtCurrentLocation,
    getCurrentLocationName
  };
}
