import type { DialogueSource, GameStateData, NpcId, ReplyTone } from "../types/game";
import { SafetyGuard } from "./SafetyGuard";
import { ScriptedDialogueService } from "./ScriptedDialogueService";
import { DynamicDialogueService } from "./DynamicDialogueService";
import { IntentResolver } from "./IntentResolver";
import { InteractionRouter } from "./InteractionRouter";
import type { DialogueRequest, DialogueResponse, TurnIntent } from "./types";

export interface DialogueRouterOptions {
  maxSentencesPerReply?: number;
  maxBubbleLengthChars?: number;
}

function compactDialogue(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned;
}

function enforceKnucklesCadence(text: string, seed = ""): string {
  const cadenceRx = /\b[a-z]{3,}in['g]?\s+and\s+[a-z]{3,}in['g]?\b/gi;
  const matches = [...text.matchAll(cadenceRx)];
  const firstSentence = text.match(/[^.!?]+[.!?]?/)?.[0]?.trim() ?? text.trim();
  if (matches.length === 1) return firstSentence;
  if (matches.length > 1) {
    let kept = 0;
    return firstSentence.replace(cadenceRx, (m) => {
      kept += 1;
      return kept === 1 ? m : "";
    }).replace(/\s+/g, " ").trim();
  }
  const pairs = [
    "Trainin and gainin",
    "Movin and provin",
    "Swingin and bringin",
    "Stridin and glidin"
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash * 33) ^ seed.charCodeAt(i)) >>> 0;
  const opener = pairs[hash % pairs.length];
  return `${opener} - ${firstSentence}`.trim();
}
function finalizeNpcText(npcId: NpcId, text: string, seed = ""): string {
  const compacted = compactDialogue(text);
  if (npcId === "knuckles") return compactDialogue(enforceKnucklesCadence(compacted, seed));
  return compacted;
}

function ensureSentence(text = ""): string {
  const trimmed = compactDialogue(text);
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function deterministicPick(seed: string, rows: string[]): string {
  if (rows.length === 0) return "";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash * 31) ^ seed.charCodeAt(i)) >>> 0;
  return rows[hash % rows.length];
}

function inferNextMove(npcId: NpcId, state: GameStateData): string {
  if (!state.player.inventory.includes("Student ID")) return "Get Student ID from Dean first.";
  if (npcId === "sonic" && state.sonic.drunkLevel < 3) return "Raise Sonic's drunk level to 3+, then request Stadium escort.";
  if (npcId === "sonic" && !state.sonic.following) return "Prompt Sonic to follow, then move together toward Stadium.";
  if (npcId === "tails") return "Pick one route and execute immediately.";
  if (npcId === "frat_boys") return "Challenge at the table to unlock momentum.";
  if (npcId === "thunderhead") return "Trade approved contraband for Asswine, then return to Sonic.";
  return "Take the next mission-aligned move without detours.";
}

function applyToneVariant(
  npcId: NpcId,
  text: string,
  tonePreference: ReplyTone | null,
  state: GameStateData,
  seedKey: string
): string {
  if (!tonePreference) return text;
  const cleaned = compactDialogue(String(text || "").replace(/^[A-Za-z][A-Za-z\s'.-]{1,32}:\s*/i, ""));
  if (!cleaned) return text;
  const firstSentence = ensureSentence(cleaned.match(/[^.!?]+[.!?]?/)?.[0] ?? cleaned);
  const moveSentence = ensureSentence(inferNextMove(npcId, state));
  if (tonePreference === "informative") {
    return `${firstSentence} ${moveSentence}`;
  }
  if (tonePreference === "neutral") {
    return firstSentence;
  }
  const jab = deterministicPick(`${seedKey}:${npcId}:tone:sarcastic`, [
    "Bold question for someone speedrunning mistakes.",
    "Glad we're pretending this wasn't obvious.",
    "Sure, let's do this the hard way but faster."
  ]);
  return `${ensureSentence(jab)} ${firstSentence}`;
}

export class DialogueRouter {
  private readonly scripted = new ScriptedDialogueService();
  private readonly safetyGuard: SafetyGuard;
  private readonly intentResolver = new IntentResolver();
  private readonly interactionRouter = new InteractionRouter();
  private readonly dynamicService: DynamicDialogueService;

  constructor(blockedTerms: string[], options: DialogueRouterOptions = {}) {
    this.safetyGuard = new SafetyGuard(blockedTerms);
    this.dynamicService = new DynamicDialogueService({
      maxSentencesPerReply: options.maxSentencesPerReply,
      maxBubbleLengthChars: options.maxBubbleLengthChars
    });
  }

  greeting(npcId: NpcId, encounterCount = 0, seedKey = ""): { text: string; source: DialogueSource } {
    return {
      text: finalizeNpcText(npcId, this.scripted.getGreeting(npcId, encounterCount, seedKey), `${seedKey}:${encounterCount}`),
      source: "scripted"
    };
  }

  async reply(npcId: NpcId, input: string, state: GameStateData, tonePreference: ReplyTone | null = null): Promise<DialogueResponse> {
    if (this.safetyGuard.shouldAbort(input)) {
      return {
        text: "Game halted. Report to campus infirmary or a trusted real-world support resource now.",
        source: "scripted",
        safetyAbort: true
      };
    }

    const request: DialogueRequest = { npcId, input, state, tonePreference };
    const intent: TurnIntent = this.intentResolver.resolve(npcId, input, state);
    const routeDecision = this.interactionRouter.decide(request);

    if (intent.mode === "SYSTEM_SAFETY") {
      return {
        text: "Game halted. Report to campus infirmary or a trusted real-world support resource now.",
        source: "scripted",
        safetyAbort: true
      };
    }

    if (routeDecision.interactionClass === "CRITICAL_SCRIPTED" || routeDecision.interactionClass === "HINT_PRIORITY") {
      const scripted = this.scripted.respond(npcId, input, state, intent.id, tonePreference);
      const toned = applyToneVariant(npcId, scripted, tonePreference, state, `${state.meta.seed}:${state.timer.remainingSec}:${intent.id}:scripted`);
      return {
        text: finalizeNpcText(npcId, toned, `${state.meta.seed}:${state.timer.remainingSec}:${intent.id}`),
        source: "scripted",
        safetyAbort: false,
        intent: intent.id
      };
    }

    const generated = await this.dynamicService.generate(request, intent);
    const toned = applyToneVariant(
      npcId,
      generated.text,
      tonePreference,
      state,
      `${state.meta.seed}:${state.timer.remainingSec}:${generated.intent || intent.id}:dynamic`
    );
    return {
      ...generated,
      text: finalizeNpcText(npcId, toned, `${state.meta.seed}:${state.timer.remainingSec}:${intent.id}:dyn`)
    };
  }
}
