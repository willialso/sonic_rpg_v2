import type { DialogueSource, GameStateData, NpcId } from "../types/game";

export type InteractionClass = "CRITICAL_SCRIPTED" | "DYNAMIC_FLAVOR" | "HINT_PRIORITY" | "SYSTEM_SAFETY";
export type DialogueMode = "SCRIPTED_GATE" | "DYNAMIC_FOCUSED" | "HINT_PRIORITY" | "SYSTEM_SAFETY";
export type DialogueFunction =
  | "WELCOME_NAME_CHECK"
  | "MISSION_HANDOFF"
  | "DISMISSAL"
  | "THREAT_ESCALATION"
  | "DISTRACTION"
  | "SARCASTIC_DEFLECTION"
  | "QUIZ_IF_TRIGGERED"
  | "HELP_ROUTE"
  | "BOAST"
  | "DRINK_GATE"
  | "TRADE_GATE"
  | "GENERAL";

export interface TurnIntent {
  id: string;
  mode: DialogueMode;
  functionId: DialogueFunction;
  goal: string;
  mustInclude: string[];
  avoid: string[];
}

export interface DialogueRequest {
  npcId: NpcId;
  input: string;
  state: GameStateData;
}

export interface DialogueResponse {
  text: string;
  source: DialogueSource;
  safetyAbort: boolean;
  intent?: string;
  displaySpeaker?: string;
}

export interface RouteDecision {
  interactionClass: InteractionClass;
  reason: string;
  intent?: TurnIntent;
}
