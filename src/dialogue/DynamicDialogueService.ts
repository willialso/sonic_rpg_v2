import type { DialogueRequest, DialogueResponse, TurnIntent } from "./types";
import { FallbackDialogueBank } from "./FallbackDialogueBank";
import { CHARACTER_CONTRACTS } from "./CharacterContracts";

const FALLBACK_SOURCE: DialogueResponse["source"] = "fallback";
const seenValidationIssueHashes = new Set<string>();

interface DynamicDialogueOptions {
  maxSentencesPerReply?: number;
  maxBubbleLengthChars?: number;
}

export class DynamicDialogueService {
  private readonly fallback = new FallbackDialogueBank();
  private readonly options: DynamicDialogueOptions;

  constructor(options: DynamicDialogueOptions = {}) {
    this.options = options;
  }

  async generate(request: DialogueRequest, intent: TurnIntent): Promise<DialogueResponse> {
    const contract = CHARACTER_CONTRACTS[request.npcId];
    const fallbackText = this.fallback.pick(request.npcId, request.state, intent.id);
    const recentTurns = request.state.dialogue.turns.slice(-8);
    const recentEvents = request.state.world.events.slice(-10);
    const inventory = request.state.player.inventory;
    const playerAskedMission = /mission|stadium|route|escort|follow|objective|what now/i.test(request.input || "");
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
      max_bubble_length_chars: this.options.maxBubbleLengthChars ?? 190,
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
        && (request.npcId === "sonic" ? playerAskedMission : (request.state.sonic.following || playerAskedMission)));
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
    const npcMemoryCard = request.npcId === "sonic" && !playerAskedMission && rawMemoryCard
      ? {
          ...rawMemoryCard,
          lastAdvice: /(mission|stadium|route|escort|follow)/i.test(rawMemoryCard.lastAdvice || "")
            ? ""
            : rawMemoryCard.lastAdvice
        }
      : rawMemoryCard;
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
      const payload = (await response.json()) as {
        npc_text?: string;
        source?: DialogueResponse["source"];
        intent?: string;
        display_speaker?: string;
      };
      const text = typeof payload.npc_text === "string" && payload.npc_text.trim().length > 0
        ? payload.npc_text.trim()
        : fallbackText;
      const source = payload.source ?? FALLBACK_SOURCE;
      return {
        text,
        source,
        safetyAbort: payload.intent === "SAFETY_ABORT",
        intent: payload.intent,
        displaySpeaker: typeof payload.display_speaker === "string" ? payload.display_speaker : undefined
      };
    } catch {
      return { text: fallbackText, source: FALLBACK_SOURCE, safetyAbort: false };
    }
  }
}
