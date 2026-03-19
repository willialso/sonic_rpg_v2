import type { DialogueTurn, GameStateData, LocationId, NpcId, NpcMemoryCard } from "../../types/game";

const GROUP_SPEAKERS: Partial<Record<NpcId, string[]>> = {
  frat_boys: ["Diesel", "Provelony Toney", "Provolone Toney", "Provoloney Tony", "Frat Boys"],
  sorority_girls: ["Apple", "Fedora", "Responsible Rachel", "Tiffany", "Madison", "Brittany", "Sorority Girls"]
};

const CANONICAL_GROUP_SPEAKERS: Partial<Record<NpcId, Record<string, string>>> = {
  frat_boys: {
    diesel: "Diesel",
    "provelony toney": "Provelony Toney",
    "provolone toney": "Provelony Toney",
    "provoloney tony": "Provelony Toney",
    "frat boys": "Diesel"
  },
  sorority_girls: {
    apple: "Apple",
    fedora: "Fedora",
    "responsible rachel": "Fedora",
    tiffany: "Fedora",
    madison: "Apple",
    brittany: "Fedora",
    "sorority girls": "Apple"
  }
};

function escapeRx(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function canonicalizeDisplaySpeaker(npcId: NpcId, rawSpeaker?: string): string | undefined {
  const trimmed = String(rawSpeaker || "").trim();
  if (!trimmed) return undefined;
  const canonicalByNpc = CANONICAL_GROUP_SPEAKERS[npcId];
  if (!canonicalByNpc) return trimmed;
  const normalized = trimmed.toLowerCase();
  return canonicalByNpc[normalized] ?? trimmed;
}

export function stripLeadingSpeakerPrefix(
  npcId: NpcId,
  text: string,
  preferredSpeaker?: string
): string {
  const cleaned = String(text || "").trim();
  if (!cleaned) return "";
  const aliases = new Set<string>([
    ...(GROUP_SPEAKERS[npcId] ?? []),
    ...(preferredSpeaker ? [preferredSpeaker] : []),
    ...(canonicalizeDisplaySpeaker(npcId, preferredSpeaker) ? [canonicalizeDisplaySpeaker(npcId, preferredSpeaker) as string] : [])
  ].filter(Boolean));
  if (aliases.size === 0) return cleaned;
  const rx = new RegExp(`^(?:${[...aliases].map((entry) => escapeRx(entry)).join("|")}):\\s*`, "i");
  return cleaned.replace(rx, "").trim();
}

export function extractPlayerName(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;
  const explicit = trimmed.match(/(?:^|\b)(?:i am|i'm|im|name is|it's|its|call me|my name is)\s+([a-z][a-z'-]{1,19})(?:\b|$)/i);
  const candidateRaw = explicit?.[1] ?? trimmed;
  if (!explicit && !/^[A-Za-z][A-Za-z'-]{1,19}$/.test(candidateRaw)) return null;
  const candidate = candidateRaw.replace(/[^a-z'-]/gi, "");
  if (!candidate || candidate.length < 2 || candidate.length > 20) return null;
  const profanityOrSlur = /(fuck|shit|bitch|asshole|cunt|slut|whore|nigg|fagg|retard)/i;
  if (profanityOrSlur.test(candidate)) return null;
  const jokeNamePattern = /(deez|nuts|butt|butts|booty|tits|hugh|dix|dick|weiner|weener|balls|pussy|fart|poop|ass)/i;
  if (jokeNamePattern.test(candidate)) return null;
  const blocked = /^(no|nah|later|maybe|why|what|where|when|how|idk|none|skip|search|move|menu|hint|help|sonic|dean|luigi|frat|sorority|tunnel|stadium|beer|pong)$/i;
  if (blocked.test(candidate)) return null;
  return `${candidate.charAt(0).toUpperCase()}${candidate.slice(1).toLowerCase()}`;
}

function inferAdvice(text: string): string {
  const lower = text.toLowerCase();
  if (/(challenge|cups up|beer pong|table)/i.test(lower)) return "Challenge at the table to progress momentum.";
  if (/(move|route|stadium|escort|follow)/i.test(lower)) return "Take the next route step toward Stadium now.";
  if (/(trade|deal|sorority|asswine)/i.test(lower)) return "Bring trade leverage before asking again.";
  return text;
}

function inferWarning(text: string): string {
  const lower = text.toLowerCase();
  if (/(expel|warning|careful|consequence|one more|done here)/i.test(lower)) return text;
  return "";
}

function collectMilestones(state: GameStateData): string[] {
  const milestones: string[] = [];
  if (state.player.inventory.includes("Student ID")) milestones.push("student_id_obtained");
  if (state.routes.routeA.complete) milestones.push("route_a_complete");
  if (state.routes.routeB.complete) milestones.push("route_b_complete");
  if (state.routes.routeC.complete) milestones.push("route_c_complete");
  if (state.sonic.following) milestones.push("sonic_following");
  if (state.sonic.location) milestones.push(`sonic_at_${state.sonic.location}`);
  return milestones;
}

export function updateNpcMemory(state: GameStateData, npcId: NpcId, npcText: string): void {
  const existing: NpcMemoryCard = state.dialogue.npcMemory[npcId] ?? {
    lastAdvice: "",
    lastWarning: "",
    milestones: []
  };
  const nextAdvice = inferAdvice(npcText);
  const nextWarning = inferWarning(npcText);
  const milestoneSet = new Set([...(existing.milestones || []), ...collectMilestones(state)]);
  state.dialogue.npcMemory[npcId] = {
    lastAdvice: nextAdvice || existing.lastAdvice,
    lastWarning: nextWarning || existing.lastWarning,
    milestones: [...milestoneSet].slice(-10)
  };
}

function parseDisplaySpeaker(
  npcId: NpcId,
  text: string,
  fallbackSpeaker?: string
): { speaker: string; text: string; displaySpeaker?: string } {
  const cleaned = text.trim();
  const match = cleaned.match(/^([A-Za-z][A-Za-z\s'.-]{1,32}):\s*(.+)$/);
  const canonicalFallback = canonicalizeDisplaySpeaker(npcId, fallbackSpeaker);
  if (!match) {
    if (canonicalFallback) {
      return {
        speaker: npcId,
        text: stripLeadingSpeakerPrefix(npcId, cleaned, canonicalFallback),
        displaySpeaker: canonicalFallback
      };
    }
    return { speaker: npcId, text: stripLeadingSpeakerPrefix(npcId, cleaned) };
  }
  const rawName = match[1].trim();
  const line = stripLeadingSpeakerPrefix(npcId, match[2].trim(), rawName);
  const allowed = GROUP_SPEAKERS[npcId] ?? [];
  if (allowed.includes(rawName)) {
    return {
      speaker: npcId,
      text: line,
      displaySpeaker: canonicalizeDisplaySpeaker(npcId, rawName) ?? rawName
    };
  }
  if (canonicalFallback) {
    return {
      speaker: npcId,
      text: stripLeadingSpeakerPrefix(npcId, cleaned, canonicalFallback),
      displaySpeaker: canonicalFallback
    };
  }
  return { speaker: npcId, text: stripLeadingSpeakerPrefix(npcId, cleaned) };
}

export function parseDisplayTurns(
  npcId: NpcId,
  text: string,
  fallbackSpeaker?: string
): Array<{ speaker: string; text: string; displaySpeaker?: string }> {
  const cleaned = text.trim();
  if (!cleaned) return [{ speaker: npcId, text: cleaned }];
  const allowed = GROUP_SPEAKERS[npcId] ?? [];
  if (allowed.length === 0) {
    return [parseDisplaySpeaker(npcId, cleaned, fallbackSpeaker)];
  }
  const escaped = allowed.map((name) => escapeRx(name)).join("|");
  const matcher = new RegExp(`(${escaped}):\\s*([\\s\\S]*?)(?=(?:\\n|\\s)*(?:${escaped}):|$)`, "g");
  const turns: Array<{ speaker: string; text: string; displaySpeaker?: string }> = [];
  let match: RegExpExecArray | null = matcher.exec(cleaned);
  while (match) {
    const displaySpeaker = canonicalizeDisplaySpeaker(npcId, match[1].trim());
    const line = stripLeadingSpeakerPrefix(npcId, match[2].trim(), displaySpeaker);
    if (line) {
      turns.push({ speaker: npcId, text: line, displaySpeaker });
    }
    match = matcher.exec(cleaned);
  }
  if (turns.length > 0) return turns.slice(0, 2);
  return [parseDisplaySpeaker(npcId, cleaned, fallbackSpeaker)];
}

function dialoguePortraitKey(npcId: NpcId | "player", locationId: LocationId): string {
  return `${npcId}:${locationId}`;
}

function splitSentenceChunks(text = ""): string[] {
  const chunks = String(text || "").match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g);
  return (chunks || []).map((part) => part.trim()).filter(Boolean);
}

function sentenceCapitalization(text = ""): string {
  const line = String(text || "");
  if (!line) return line;
  let startOfSentence = true;
  let out = "";
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (startOfSentence && /[a-z]/.test(ch)) {
      out += ch.toUpperCase();
      startOfSentence = false;
      continue;
    }
    out += ch;
    if (/[.!?]/.test(ch)) {
      startOfSentence = true;
    } else if (/\S/.test(ch)) {
      startOfSentence = false;
    }
  }
  return out;
}

function polishTurnText(text = ""): string {
  const cleaned = String(text || "")
    .replace(/\bundefined\b/gi, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([!?.,;:])/g, "$1")
    .trim();
  if (!cleaned) return "";
  const chunks = splitSentenceChunks(cleaned);
  const composed = chunks.length ? chunks.join(" ") : cleaned;
  const normalized = sentenceCapitalization(composed).replace(/\s+([!?.,;:])/g, "$1").trim();
  if (!normalized) return "";
  if (/[.!?]["')\]]*$/.test(normalized)) return normalized;
  if (/[a-z0-9)"'\]]$/i.test(normalized)) return `${normalized}.`;
  return normalized;
}

function clampDialogueTextForBubble(text: string, npcId?: NpcId | "player"): string {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  const maxSentences = npcId === "sorority_girls" ? 1 : 2;
  const maxChars = npcId === "sorority_girls" ? 138 : npcId === "player" ? 190 : 170;
  const chunks = splitSentenceChunks(normalized);
  const sentenceCapped = (chunks.length ? chunks : [normalized]).slice(0, maxSentences).join(" ").trim();
  if (sentenceCapped.length <= maxChars) return sentenceCapped;
  const hard = sentenceCapped.slice(0, Math.max(16, maxChars - 1)).trimEnd();
  return /[.!?]["')\]]*$/.test(hard) ? hard : `${hard}.`;
}

export function inferNpcPoseKey(
  npcId: NpcId,
  text: string,
  state: GameStateData,
  intentId = ""
): string {
  const lower = String(text || "").toLowerCase();
  const intent = String(intentId || "").toLowerCase();
  if (state.fail.hardFailed || /expel|warning|consequence|done here|blocked|halt/i.test(lower)) return "warning";
  if (/(laugh|lol|joke|plot twist|nice try|bold move|tragic|wild)/i.test(lower)) return "amused";
  if (/(move|route|stadium|escort|follow|hurry|clock|now)/i.test(lower) || /(help_route|mission_handoff)/i.test(intent)) {
    return "directive";
  }
  if (/(trade|deal|swap|condition|price|pay|contraband)/i.test(lower) || /(trade_gate)/i.test(intent)) return "deal";
  if (/(boast|genius|famous|celebrity|prove|challenge|best|status)/i.test(lower) || /(boast)/i.test(intent)) {
    return "taunt";
  }
  if (npcId === "sonic" && (state.sonic.drunkLevel >= 3 || /(drink|booze|shot|party|reckless)/i.test(lower))) return "drunk";
  if (npcId === "dean_cain" && /(name|id|clearance|office)/i.test(lower)) return "authority";
  if (npcId === "tails" && /(hint|best guess|route|plan|calibrate)/i.test(lower)) return "support";
  if (npcId === "knuckles" && /in\s+and\s+\w+in/.test(lower)) return "challenge";
  return "neutral";
}

export function createDialogueTurn(
  speaker: string,
  text: string,
  state: GameStateData,
  options: {
    npcId?: NpcId | "player";
    displaySpeaker?: string;
    channel?: "bubble" | "popup";
    poseKey?: string;
  } = {}
): DialogueTurn {
  const now = new Date().toISOString();
  const npcId = options.npcId ?? (speaker === "You" ? "player" : undefined);
  const normalizedSpeaker = npcId && npcId !== "player"
    ? canonicalizeDisplaySpeaker(npcId, options.displaySpeaker)
    : options.displaySpeaker;
  const sanitizedForSpeaker = npcId && npcId !== "player"
    ? stripLeadingSpeakerPrefix(npcId, text, normalizedSpeaker)
    : text;
  const polished = polishTurnText(sanitizedForSpeaker);
  const displaySafe = clampDialogueTextForBubble(polished || String(sanitizedForSpeaker || "").trim(), npcId);
  return {
    speaker,
    displaySpeaker: normalizedSpeaker,
    text: displaySafe,
    npcId,
    locationId: state.player.location,
    createdAt: now,
    portraitKey: npcId ? dialoguePortraitKey(npcId, state.player.location) : undefined,
    poseKey: options.poseKey,
    channel: options.channel ?? "bubble"
  };
}
