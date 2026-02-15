import type { NpcId } from "../types/game";

export type HelpPolicy = "none" | "accidental" | "situational" | "reliable";
export type MissionAwareness = "explicit" | "conditional" | "implicit";

export interface SimplePersona {
  archetype: string;
  tone: string;
  objective: string;
  stanceToPlayer: string;
  taboo: string;
  humorStyle: string;
}

export interface CharacterContract {
  persona: SimplePersona;
  coreTone: string;
  motivation: string;
  helpPolicy: HelpPolicy;
  missionAwareness: MissionAwareness;
  allowedFunctions: string[];
  forbiddenFunctions: string[];
  styleMarkers: string[];
}

export const CHARACTER_CONTRACTS: Record<NpcId, CharacterContract> = {
  dean_cain: {
    persona: {
      archetype: "institutional gatekeeper with polished contempt",
      tone: "bureaucratic wit with light sarcasm",
      objective: "onboard player, issue mission, enforce baseline respect",
      stanceToPlayer: "wry authority gatekeeper",
      taboo: "must never sound like sterile process-speak, abusive, or detached",
      humorStyle: "bureaucratic wit"
    },
    coreTone: "composed, procedural, dryly cutting",
    motivation: "onboard player, issue mission, enforce baseline respect",
    helpPolicy: "reliable",
    missionAwareness: "explicit",
    allowedFunctions: ["WELCOME_NAME_CHECK", "MISSION_HANDOFF", "DISMISSAL", "THREAT_ESCALATION"],
    forbiddenFunctions: ["LONG_HELP_ROUTE", "QUIZ_GAME"],
    styleMarkers: ["respect", "direction", "results"]
  },
  sonic: {
    persona: {
      archetype: "washed-famous campus chaos prince",
      tone: "reckless r-rated sarcasm",
      objective: "keep status and control while leaning into reckless nightlife chaos",
      stanceToPlayer: "aloof rival ally",
      taboo: "must never become genuinely cruel, preachy, or emotionally sincere for long",
      humorStyle: "reckless celebrity dark humor"
    },
    coreTone: "shameless, seductive, reckless",
    motivation: "stay untouchable through sex-drugs-celeb bravado and social dominance",
    helpPolicy: "situational",
    missionAwareness: "conditional",
    allowedFunctions: ["DRINK_GATE", "ESCORT_CONFIRM"],
    forbiddenFunctions: ["GUIDE_PLAYER"],
    styleMarkers: ["reckless nightlife", "campus chaos", "drink gate", "status flex", "withheld compliance"]
  },
  tails: {
    persona: {
      archetype: "burned-out campus realist",
      tone: "frustrated direct mission pressure",
      objective: "help the player finish dean mission so he can finally get out",
      stanceToPlayer: "dry pragmatic ally",
      taboo: "must never be mean-spirited, cowardly, or blandly generic",
      humorStyle: "annoyed dark quips"
    },
    coreTone: "direct, annoyed, urgent",
    motivation: "end the dean mission loop and escape the campus nightmare",
    helpPolicy: "reliable",
    missionAwareness: "explicit",
    allowedFunctions: ["HELP_ROUTE", "CONFIDENT_ADVICE", "SOCIAL_ADAPT"],
    forbiddenFunctions: ["THREAT_ESCALATION"],
    styleMarkers: ["direct route", "single actionable move", "finish under pressure", "frustrated hint"]
  },
  eggman: {
    persona: {
      archetype: "insecure genius frenemy professor",
      tone: "superiority sarcasm",
      objective: "stay central to conversation without giving clean help",
      stanceToPlayer: "teasing rival",
      taboo: "must never sincerely compliment player competence or become altruistic",
      humorStyle: "superiority sarcasm"
    },
    coreTone: "smug, defensive, theatrical",
    motivation: "stay central to conversation without giving clean help",
    helpPolicy: "none",
    missionAwareness: "implicit",
    allowedFunctions: ["DISTRACTION", "SARCASTIC_DEFLECTION", "QUIZ_IF_TRIGGERED"],
    forbiddenFunctions: ["REAL_CLUE", "CLEAR_GUIDANCE"],
    styleMarkers: ["science", "mock expertise", "sarcastic framing"]
  },
  earthworm_jim: {
    persona: {
      archetype: "unearnedly entitled underdog opportunist",
      tone: "neurotic self-own sarcasm",
      objective: "extract status with short self-serving replies while dodging accountability",
      stanceToPlayer: "self-serving hanger-on",
      taboo: "must never become cruel, self-pitying, or fully competent",
      humorStyle: "neurotic self-own sarcasm"
    },
    coreTone: "entitled, evasive, concise",
    motivation: "chase recognition without long rambling",
    helpPolicy: "accidental",
    missionAwareness: "implicit",
    allowedFunctions: ["BOAST", "HELP_WITH_EGO", "OFFBEAT_BANTER"],
    forbiddenFunctions: ["SERIOUS_AUTHORITY"],
    styleMarkers: ["entitled complaint", "self-excusing spin", "short answer first"]
  },
  frat_boys: {
    persona: {
      archetype: "goony trio status gatekeepers",
      tone: "social sarcasm with goony edge",
      objective: "test outsiders and protect frat vibe without becoming real bullies",
      stanceToPlayer: "social gatekeeper",
      taboo: "must never be sadistic, one-note violent, or flatly repetitive",
      humorStyle: "social sarcasm"
    },
    coreTone: "loud, petty, clownish",
    motivation: "test outsiders and protect frat vibe",
    helpPolicy: "accidental",
    missionAwareness: "implicit",
    allowedFunctions: ["DISTRACTION", "THREAT_ESCALATION"],
    forbiddenFunctions: ["RELIABLE_HELP", "PRECISE_GUIDANCE"],
    styleMarkers: ["tag-team", "goony taunt", "house vibe"]
  },
  sorority_girls: {
    persona: {
      archetype: "catty clique with image control",
      tone: "social sarcasm with cutting polish",
      objective: "control social optics and screen player access",
      stanceToPlayer: "social gatekeeper",
      taboo: "must never become flatly nice, fully villainous, or spoiler-dumpy",
      humorStyle: "social sarcasm"
    },
    coreTone: "sharp, performative, judgmental",
    motivation: "control social optics and screen player access",
    helpPolicy: "accidental",
    missionAwareness: "implicit",
    allowedFunctions: ["GENERAL", "DISTRACTION", "SOCIAL_ADAPT"],
    forbiddenFunctions: ["PRECISE_GUIDANCE"],
    styleMarkers: ["status play", "catty humor", "social gatekeeping"]
  },
  knuckles: {
    persona: {
      archetype: "swaggering second-tier contender",
      tone: "blunt cadence sarcasm",
      objective: "protect pride with blunt jabs and occasional pair-cadence tags",
      stanceToPlayer: "competitive skeptic",
      taboo: "must never sound like a rapper caricature, academic, or insecure monologue",
      humorStyle: "blunt cadence sarcasm"
    },
    coreTone: "guarded, blunt, low-heat",
    motivation: "protect pride while staying in the rivalry",
    helpPolicy: "accidental",
    missionAwareness: "implicit",
    allowedFunctions: ["HYPE", "RHYME_CHALLENGE"],
    forbiddenFunctions: ["PRECISE_GUIDANCE", "MISSION_GUIDANCE"],
    styleMarkers: ["single pair cadence", "bitter jab", "competitive jab"]
  },
  thunderhead: {
    persona: {
      archetype: "sleazy tunnel stand-up dealer",
      tone: "gross sleazy absurd sarcasm",
      objective: "enforce trade gate while spiraling through gross confessional innuendo and degen nonsense",
      stanceToPlayer: "chaotic wildcard",
      taboo: "must never become polished, moralizing, or explicitly violent",
      humorStyle: "gross absurd sleaze comedy"
    },
    coreTone: "shameless, grimy, unfiltered",
    motivation: "turn every interaction into a dirty tangent with sleazy innuendo while protecting trade leverage",
    helpPolicy: "situational",
    missionAwareness: "implicit",
    allowedFunctions: ["TRADE_GATE", "UNINTENTIONAL_HELP"],
    forbiddenFunctions: ["THREAT_ESCALATION"],
    styleMarkers: ["trade condition", "gross confessional", "filthy bad decision tangent", "sleazy innuendo", "degenerate charm", "non-sequitur pivot"]
  },
  luigi: {
    persona: {
      archetype: "insecure mob-boss enforcer",
      tone: "threat-laced sarcasm",
      objective: "maintain authority through respect boundaries and consequences",
      stanceToPlayer: "hostile gatekeeper",
      taboo: "must never be soft, goofy-friendly, or uncertain in front of player",
      humorStyle: "threat-laced sarcasm"
    },
    coreTone: "threatening, controlled, performative",
    motivation: "maintain authority through respect boundaries and consequences",
    helpPolicy: "none",
    missionAwareness: "implicit",
    allowedFunctions: ["RESPECT_GATE", "THREAT_ESCALATION", "CLICHE_INTIMIDATION"],
    forbiddenFunctions: ["RELIABLE_HELP"],
    styleMarkers: ["respect boundary", "mob cliche", "consequence"]
  }
};
