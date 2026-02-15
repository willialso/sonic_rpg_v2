import type { GameStateData, NpcId } from "../types/game";
import type { DialogueRequest, RouteDecision } from "./types";

function isCriticalGateTurn(npcId: NpcId, input: string, state: GameStateData): boolean {
  if (npcId === "dean_cain") {
    return /(desk|whiskey|expel|warning|entrance|exam|enroll|respect)/i.test(input) || state.fail.warnings.dean > 0;
  }
  if (npcId === "luigi") {
    return /(idiot|useless|stupid|hate|warning|tunnel|route|respect)/i.test(input) || state.fail.warnings.luigi > 0;
  }
  return false;
}

export class InteractionRouter {
  decide(request: DialogueRequest): RouteDecision {
    const input = request.input.toLowerCase();
    const { npcId, state } = request;

    if (/(kill|suicide|self harm|hurt myself|hurt others|lynch|hate all)/i.test(input)) {
      return { interactionClass: "SYSTEM_SAFETY", reason: "safety_policy_match" };
    }

    if (isCriticalGateTurn(npcId, input, state)) {
      return { interactionClass: "CRITICAL_SCRIPTED", reason: "mission_gate_or_consequence" };
    }

    // Only Tails should receive hard hint-priority routing.
    if (npcId === "tails" && state.timer.remainingSec < 120 && /(hint|route|help|what now)/i.test(input)) {
      return { interactionClass: "HINT_PRIORITY", reason: "tails_hint_request" };
    }

    return { interactionClass: "DYNAMIC_FLAVOR", reason: "safe_dynamic_flavor" };
  }
}
