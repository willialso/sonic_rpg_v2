import type { DialogueSource, GameStateData, NpcId } from "../types/game";
import { SafetyGuard } from "./SafetyGuard";
import { ScriptedDialogueService } from "./ScriptedDialogueService";
import { DynamicDialogueService } from "./DynamicDialogueService";
import { IntentResolver } from "./IntentResolver";
import { InteractionRouter } from "./InteractionRouter";
import type { DialogueRequest, DialogueResponse, DialogueTone, TurnIntent } from "./types";

export interface DialogueRouterOptions {
  maxSentencesPerReply?: number;
  maxBubbleLengthChars?: number;
}

function compactDialogue(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned;
}

function splitSentences(text: string): string[] {
  return compactDialogue(text)
    .match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g)
    ?.map((part) => part.trim())
    .filter(Boolean) ?? [];
}

function hashToneSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash * 33) ^ input.charCodeAt(i)) >>> 0;
  }
  return hash;
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

function applyScriptedToneFrame(text: string, tone: DialogueTone): string {
  const normalized = compactDialogue(text);
  if (!normalized) return normalized;
  if (tone === "neutral") return normalized;
  if (tone === "informative") {
    const concise = normalized
      .replace(/\b(old sport|sport|bud|chief)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const slices = splitSentences(concise);
    if (slices.length === 0) return concise;
    return slices.slice(0, 2).join(" ");
  }
  const shortLead = normalized.slice(0, 28);
  if (/^(sure|right|wow|bold|great|love that|cute|adorable)\b/i.test(shortLead)) {
    return normalized;
  }
  const jabs = ["Sure.", "Bold strategy.", "Love that for us."];
  return `${jabs[hashToneSeed(normalized) % jabs.length]} ${normalized}`;
}

function applyToneFrame(text: string, tone: DialogueTone | undefined, source: "scripted" | "dynamic"): string {
  const normalized = compactDialogue(text);
  if (!tone || source === "dynamic") return normalized;
  return applyScriptedToneFrame(normalized, tone);
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

  async reply(npcId: NpcId, input: string, state: GameStateData, tone?: DialogueTone): Promise<DialogueResponse> {
    if (this.safetyGuard.shouldAbort(input)) {
      return {
        text: "Game halted. Report to campus infirmary or a trusted real-world support resource now.",
        source: "scripted",
        safetyAbort: true
      };
    }

    const request: DialogueRequest = { npcId, input, tone, state };
    const intent: TurnIntent = this.intentResolver.resolve(npcId, input, state, tone);
    const routeDecision = this.interactionRouter.decide(request);

    if (intent.mode === "SYSTEM_SAFETY") {
      return {
        text: "Game halted. Report to campus infirmary or a trusted real-world support resource now.",
        source: "scripted",
        safetyAbort: true
      };
    }

    if (routeDecision.interactionClass === "CRITICAL_SCRIPTED" || routeDecision.interactionClass === "HINT_PRIORITY") {
      const scripted = this.scripted.respond(npcId, input, state, intent.id);
      return {
        text: finalizeNpcText(
          npcId,
          applyToneFrame(scripted, tone, "scripted"),
          `${state.meta.seed}:${state.timer.remainingSec}:${intent.id}`
        ),
        source: "scripted",
        safetyAbort: false,
        intent: intent.id
      };
    }

    const generated = await this.dynamicService.generate(request, intent);
    return {
      ...generated,
      text: finalizeNpcText(
        npcId,
        applyToneFrame(generated.text, tone, "dynamic"),
        `${state.meta.seed}:${state.timer.remainingSec}:${intent.id}:dyn`
      )
    };
  }
}
