import type { DialogueRequest, DialogueResponse, TurnIntent } from "./types";
import { FallbackDialogueBank } from "./FallbackDialogueBank";
import { CHARACTER_CONTRACTS } from "./CharacterContracts";

const FALLBACK_SOURCE: DialogueResponse["source"] = "fallback";
const seenValidationIssueHashes = new Set<string>();

interface DynamicDialogueOptions {
  maxSentencesPerReply?: number;
  maxBubbleLengthChars?: number;
}

function clampDialogueText(raw: string, maxSentences: number, maxChars: number): string {
  const normalized = String(raw || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const chunks = normalized.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) ?? [normalized];
  const sentenceCapped = chunks.slice(0, Math.max(1, maxSentences)).join(" ").trim();
  if (sentenceCapped.length <= maxChars) return sentenceCapped;
  const hard = sentenceCapped.slice(0, Math.max(16, maxChars - 1)).trimEnd();
  return /[.!?]$/.test(hard) ? hard : `${hard}.`;
}

export class DynamicDialogueService {
  private readonly fallback = new FallbackDialogueBank();
  private readonly options: DynamicDialogueOptions;
  private backendCooldownUntilMs = 0;
  private backendFailureNotified = false;

  constructor(options: DynamicDialogueOptions = {}) {
    this.options = options;
  }

  async generate(request: DialogueRequest, intent: TurnIntent): Promise<DialogueResponse> {
    const contract = CHARACTER_CONTRACTS[request.npcId];
    const fallbackText = this.fallback.pick(request.npcId, request.state, intent.id);
    const recentTurns = request.state.dialogue.turns.slice(-8);
    const recentEvents = request.state.world.events.slice(-10);
    const inventory = request.state.player.inventory;
    const playerAskedMission = /mission|stadium|route|escort|follow|objective|what now|go to stadium|head to stadium|take.*stadium/i.test(request.input || "");
    const playerAskedSonicLocation = /where.*sonic|sonic.*where|seen sonic|find sonic|locate sonic|track sonic/i.test(request.input || "");
    const playerRecentlyMentioned = (needle: RegExp): boolean =>
      recentTurns.some((turn) => String(turn.speaker || "").toLowerCase() === "you" && needle.test(turn.text || ""));
    const currentContext = {
      player_name: request.state.player.name,
      location: request.state.player.location,
      time_remaining_sec: request.state.timer.remainingSec,
      sonic_drunk_level: request.state.sonic.drunkLevel,
      sonic_following: request.state.sonic.following,
      sonic_location: request.state.sonic.location,
      npc_encounter_count: request.state.dialogue.encounterCountByNpc[request.npcId] ?? 0,
      npc_intent_state: request.state.world.intents[request.npcId] ?? null,
      inventory,
      has_student_id: inventory.includes("Student ID"),
      has_whiskey: inventory.includes("Dean Whiskey"),
      has_asswine: inventory.includes("Asswine"),
      sonic_present_here: (request.state.world.presentNpcs[request.state.player.location] ?? []).includes("sonic"),
      nearby_npcs: request.state.world.presentNpcs[request.state.player.location] ?? [],
      player_asked_sonic_location: playerAskedSonicLocation,
      max_bubble_length_chars: this.options.maxBubbleLengthChars ?? 170,
      max_sentences_per_reply: this.options.maxSentencesPerReply ?? 2,
      recent_events: recentEvents,
      already_answered: {
        mission_topic: playerRecentlyMentioned(/stadium|route|mission|escort|follow/i),
        sonic_social_topic: playerRecentlyMentioned(/sonic|party|drink|pong|booze/i),
        route_question: playerRecentlyMentioned(/which route|what route|route\?/i),
        drink_question: playerRecentlyMentioned(/beer|drink|pong|shot/i)
      }
    };
    const includeMissionContext = contract.missionAwareness === "explicit"
      || (contract.missionAwareness === "conditional"
        && (request.npcId === "sonic"
          ? (playerAskedMission || playerAskedSonicLocation)
          : (request.state.sonic.following || playerAskedMission || playerAskedSonicLocation)));
    const missionProgression = includeMissionContext
      ? {
          objective: request.state.mission.objective,
          sub_objective: request.state.mission.subObjective,
          phase: request.state.phase,
          dean_stage: request.state.dialogue.deanStage,
          route_flags: request.state.routes,
          fail_warnings: request.state.fail.warnings,
          action_affordances: request.state.world.actionUnlocks
        }
      : null;
    const rawMemoryCard = request.state.dialogue.npcMemory[request.npcId] ?? null;
    const npcMemoryCard = request.npcId === "sonic" && !playerAskedMission && !playerAskedSonicLocation && rawMemoryCard
      ? {
          ...rawMemoryCard,
          lastAdvice: /(mission|stadium|route|escort|follow)/i.test(rawMemoryCard.lastAdvice || "")
            ? ""
            : rawMemoryCard.lastAdvice
        }
      : rawMemoryCard;
    const now = Date.now();
    if (this.backendCooldownUntilMs > now) {
      return { text: fallbackText, source: FALLBACK_SOURCE, safetyAbort: false };
    }
    try {
      const response = await fetch("/api/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: request.npcId,
          player_input: request.input,
          fallback_text: fallbackText,
          intent: intent.id,
          function_id: intent.functionId,
          intent_context: {
            goal: intent.goal,
            must_include: intent.mustInclude,
            avoid: intent.avoid,
            character_contract: contract
          },
          current_context: currentContext,
          mission_progression: missionProgression,
          npc_memory_card: npcMemoryCard,
          recent_turns: request.state.dialogue.turns.slice(-6)
        })
      });
      if (!response.ok) {
        if (response.status >= 500) {
          this.backendCooldownUntilMs = Date.now() + 30000;
          if (!this.backendFailureNotified && typeof window !== "undefined") {
            this.backendFailureNotified = true;
            window.dispatchEvent(new CustomEvent("dialogue-validation-issue", {
              detail: { message: "Dialogue service is temporarily unavailable (API error). In local dev, ensure the API server is running on :8787. Falling back to in-game lines." }
            }));
          }
        }
        if (response.status === 400) {
          try {
            const payload = (await response.json()) as { issues?: string[]; error?: string };
            const issues = Array.isArray(payload.issues) ? payload.issues : [];
            const hash = `${payload.error || "invalid_request"}:${issues.join("|")}`;
            if (!seenValidationIssueHashes.has(hash)) {
              seenValidationIssueHashes.add(hash);
              const message = issues.length > 0
                ? `Dialogue API rejected request: ${issues.join("; ")}`
                : "Dialogue API rejected request with 400.";
              console.warn(message);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("dialogue-validation-issue", {
                  detail: { message }
                }));
              }
            }
          } catch {
            // Keep fallback response on parse failure.
          }
        }
        return { text: fallbackText, source: FALLBACK_SOURCE, safetyAbort: false };
      }
      this.backendCooldownUntilMs = 0;
      this.backendFailureNotified = false;
      const payload = (await response.json()) as {
        npc_text?: string;
        source?: DialogueResponse["source"];
        intent?: string;
        display_speaker?: string;
      };
      const rawText = typeof payload.npc_text === "string" && payload.npc_text.trim().length > 0
        ? payload.npc_text.trim()
        : fallbackText;
      const maxChars = request.npcId === "sorority_girls"
        ? Math.min(138, currentContext.max_bubble_length_chars)
        : currentContext.max_bubble_length_chars;
      const maxSentences = request.npcId === "sorority_girls" ? 1 : currentContext.max_sentences_per_reply;
      const text = clampDialogueText(rawText, maxSentences, maxChars);
      if (request.npcId === "sorority_girls" && rawText.length > text.length && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dialogue-telemetry", { detail: { type: "sorority-trimmed" } }));
      }
      const source = payload.source ?? FALLBACK_SOURCE;
      return {
        text,
        source,
        safetyAbort: payload.intent === "SAFETY_ABORT",
        intent: payload.intent,
        displaySpeaker: typeof payload.display_speaker === "string" ? payload.display_speaker : undefined
      };
    } catch {
      this.backendCooldownUntilMs = Date.now() + 30000;
      if (!this.backendFailureNotified && typeof window !== "undefined") {
        this.backendFailureNotified = true;
        window.dispatchEvent(new CustomEvent("dialogue-validation-issue", {
          detail: { message: "Dialogue network call failed (API likely unreachable). In local dev, start web+API together via `npm run dev`. Using fallback dialogue for now." }
        }));
      }
      return { text: fallbackText, source: FALLBACK_SOURCE, safetyAbort: false };
    }
  }
}
