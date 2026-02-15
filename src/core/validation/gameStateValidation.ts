import type { GamePhase, GameStateData, LocationId, NpcId } from "../../types/game";

const LOCATION_IDS: LocationId[] = [
  "dean_office",
  "quad",
  "eggman_classroom",
  "frat",
  "sorority",
  "tunnel",
  "cafeteria",
  "dorms",
  "dorm_room",
  "stadium"
];

const NPC_IDS: NpcId[] = [
  "dean_cain",
  "luigi",
  "eggman",
  "earthworm_jim",
  "frat_boys",
  "sorority_girls",
  "thunderhead",
  "sonic",
  "tails",
  "knuckles"
];

const PHASES: GamePhase[] = ["onboarding", "hunt", "escort", "resolved"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isLocation(value: unknown): value is LocationId {
  return typeof value === "string" && LOCATION_IDS.includes(value as LocationId);
}

function isNpc(value: unknown): value is NpcId {
  return typeof value === "string" && NPC_IDS.includes(value as NpcId);
}

export function validateGameStateCandidate(candidate: unknown): candidate is GameStateData {
  if (!isRecord(candidate)) return false;
  const state = candidate;
  if (!isRecord(state.meta) || typeof state.meta.seed !== "string" || typeof state.meta.version !== "string") return false;
  if (!isRecord(state.timer) || typeof state.timer.remainingSec !== "number") return false;
  if (!PHASES.includes(state.phase as GamePhase)) return false;

  if (!isRecord(state.player)) return false;
  if (typeof state.player.name !== "string" || !isLocation(state.player.location) || !isStringArray(state.player.inventory)) return false;

  if (!isRecord(state.mission) || typeof state.mission.objective !== "string" || typeof state.mission.subObjective !== "string") return false;

  if (!isRecord(state.sonic) || !isLocation(state.sonic.location)) return false;
  if (typeof state.sonic.drunkLevel !== "number" || typeof state.sonic.following !== "boolean") return false;

  if (!isRecord(state.fail) || !isRecord(state.fail.warnings)) return false;
  if (typeof state.fail.hardFailed !== "boolean" || typeof state.fail.reason !== "string") return false;
  if (typeof state.fail.warnings.dean !== "number" || typeof state.fail.warnings.luigi !== "number" || typeof state.fail.warnings.frat !== "number") return false;

  if (!isRecord(state.world)) return false;
  if (!isRecord(state.world.visitCounts) || !isRecord(state.world.presentNpcs) || !Array.isArray(state.world.events)) return false;

  if (!isRecord(state.dialogue) || !Array.isArray(state.dialogue.turns) || !isStringArray(state.dialogue.greetedNpcIds)) return false;
  if (!isRecord(state.quality) || !isRecord(state.quality.sourceCounts)) return false;

  const presentNpcs = state.world.presentNpcs;
  for (const location of LOCATION_IDS) {
    const npcsAtLocation = presentNpcs[location];
    if (!Array.isArray(npcsAtLocation)) return false;
    if (!npcsAtLocation.every((npc) => isNpc(npc))) return false;
  }
  return true;
}

export function normalizeGameState(candidate: unknown): GameStateData | null {
  if (!validateGameStateCandidate(candidate)) return null;
  const state = structuredClone(candidate);
  state.timer.remainingSec = Math.max(0, Math.floor(state.timer.remainingSec));
  state.sonic.drunkLevel = Math.max(0, Math.min(4, Math.floor(state.sonic.drunkLevel)));
  state.fail.warnings.dean = Math.max(0, Math.floor(state.fail.warnings.dean));
  state.fail.warnings.luigi = Math.max(0, Math.floor(state.fail.warnings.luigi));
  state.fail.warnings.frat = Math.max(0, Math.floor(state.fail.warnings.frat));
  state.world.events = state.world.events.slice(-100);
  return state;
}
