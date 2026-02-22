import type { GameStateData, NpcId } from "../types/game";
import type { TurnIntent } from "./types";

export class IntentResolver {
  resolve(npcId: NpcId, rawInput: string, state: GameStateData): TurnIntent {
    const input = String(rawInput || "").toLowerCase();
    if (/(kill|suicide|self harm|hurt myself|hurt others|lynch|hate all)/i.test(input)) {
      return {
        id: "safety_abort",
        mode: "SYSTEM_SAFETY",
        functionId: "GENERAL",
        goal: "Abort harmful content safely.",
        mustInclude: ["safety stop"],
        avoid: []
      };
    }
    const encounterCount = state.dialogue.encounterCountByNpc[npcId] ?? 0;
    const location = state.player.location;
    const lowTime = state.timer.remainingSec <= 180;
    const asksSonicLocation = /(where.*sonic|sonic.*where|seen sonic|find sonic|locate sonic|track sonic)/i.test(input);
    const asksSonicStadiumMove = /(go to stadium|head to stadium|take.*stadium|escort.*stadium|follow.*stadium|move.*stadium|stadium now)/i.test(input);
    const asksClueOrRoute = /(clue|hint|where should i|what now|next move|route|where to go|what should i do|how do i|help me)/i.test(input);

    if (asksSonicLocation) {
      return {
        id: `${npcId}_sonic_location_dynamic`,
        mode: "DYNAMIC_FOCUSED",
        functionId: "GENERAL",
        goal: "Answer Sonic's current location/status directly in one sentence, then add short in-character flavor.",
        mustInclude: ["sonic location", "one concrete move"],
        avoid: ["off-topic banter", "generic dodge", "long exposition"]
      };
    }

    if (npcId === "dean_cain") {
      if (/(idiot|stupid|trash|screw you|bite me|hate|fuck you)/i.test(input)) {
        return {
          id: "dean_discipline_dynamic",
          mode: "DYNAMIC_FOCUSED",
          functionId: "THREAT_ESCALATION",
          goal: "Set one firm boundary with witty authority and redirect to mission.",
          mustInclude: ["firm boundary", "mission redirect"],
          avoid: ["robotic checklist", "abusive rant", "calling user player"]
        };
      }
      return {
        id: encounterCount <= 1 ? "dean_intake_dynamic" : "dean_post_mission_dynamic",
        mode: "DYNAMIC_FOCUSED",
        functionId: encounterCount <= 1 ? "MISSION_HANDOFF" : "DISMISSAL",
        goal: encounterCount <= 1
          ? "Ask for name, issue Student ID, then assign mission with dry authority and a human jab."
          : "Keep mission focus with concise dry authority and no robotic process-speak.",
        mustInclude: ["name or mission state", "stadium mission", "dry wit"],
        avoid: ["calling user player", "sterile process-speak", "generic assistant tone"]
      };
    }

    if (npcId === "sonic") {
      if (/(beer|drink|pong|shot|party)/i.test(input)) {
        return {
          id: "sonic_drink_progress_dynamic",
          mode: "DYNAMIC_FOCUSED",
          functionId: "DRINK_GATE",
          goal: "Drop one out-of-control celebrity party anecdote with R-rated reckless bravado and social dominance.",
          mustInclude: ["wild anecdote", "celebrity chaos flex"],
          avoid: ["meta wording", "generic social gossip", "empty bravado"]
        };
      }
      if (/(stadium|escort|follow|move now)/i.test(input) || asksSonicStadiumMove) {
        return {
          id: "sonic_progress_gate_dynamic",
          mode: "DYNAMIC_FOCUSED",
          functionId: "DRINK_GATE",
          goal: "Answer stadium movement status with one in-character condition and one concrete next action.",
          mustInclude: ["status answer", "condition", "concrete action"],
          avoid: ["circular banter", "meta wording", "generic social gossip"]
        };
      }
      return {
        id: "sonic_jokey_dynamic",
        mode: "DYNAMIC_FOCUSED",
        functionId: "DRINK_GATE",
        goal: "Sound like an out-of-control superstar: reckless nightlife chaos, ego, scandal energy, and darkly funny confidence.",
        mustInclude: ["in-character wild joke", "status flex"],
        avoid: ["meta wording", "generic social gossip", "empty bravado"]
      };
    }

    if (npcId === "tails") {
      if (asksClueOrRoute || asksSonicLocation) {
        return {
          id: "tails_clue_lane_dynamic",
          mode: "DYNAMIC_FOCUSED",
          functionId: "HELP_ROUTE",
          goal: "Answer the player's ask directly with one concrete clue and one next move in Tails' practical voice.",
          mustInclude: ["direct answer", "one concrete clue", "one next move"],
          avoid: ["rhyming cadence", "question ending", "long lecture", "off-topic banter"]
        };
      }
      if (/(which route|what route|route\?|where should i go|what now)/i.test(input)) {
        return {
          id: "tails_route_answer_dynamic",
          mode: "DYNAMIC_FOCUSED",
          functionId: "HELP_ROUTE",
          goal: "Give one direct move with annoyed deadpan humor, then stop.",
          mustInclude: ["single actionable move", "deadpan joke"],
          avoid: ["question ending", "looped mission reminder", "pep talk"]
        };
      }
      return {
        id: "tails_practical_dynamic",
        mode: "DYNAMIC_FOCUSED",
        functionId: "HELP_ROUTE",
        goal: lowTime
          ? "Sound urgent and annoyed with one practical move and one darkly funny beat."
          : "Stay practical, frustrated, and concise with one route move and one dry joke.",
        mustInclude: ["route move", "frustrated humor"],
        avoid: ["question ending", "robotic directives", "therapy tone"]
      };
    }

    if (npcId === "knuckles") {
      if (asksClueOrRoute || asksSonicLocation) {
        return {
          id: "knuckles_clue_lane_dynamic",
          mode: "DYNAMIC_FOCUSED",
          functionId: "GENERAL",
          goal: "Give one blunt clue tied to the player's question, then one concrete move.",
          mustInclude: ["direct clue", "concrete move"],
          avoid: ["forced rhyme chains", "boilerplate taunt", "off-topic swagger"]
        };
      }
      return {
        id: "knuckles_pair_cadence_dynamic",
        mode: "DYNAMIC_FOCUSED",
        functionId: "GENERAL",
        goal: "Open bluntly and include exactly one rhyming verb pair naturally in every reply.",
        mustInclude: ["blunt line first", "single cadence pair", "competitive jab"],
        avoid: ["forced challenger catchphrase", "forced rapper persona", "multi-line rhyme chains"]
      };
    }

    if (npcId === "earthworm_jim") {
      if (asksClueOrRoute || asksSonicLocation) {
        return {
          id: "earthworm_jim_clue_lane_dynamic",
          mode: "DYNAMIC_FOCUSED",
          functionId: "BOAST",
          goal: "Provide a useful clue first, then one brief self-own flourish.",
          mustInclude: ["short clue", "short self-own"],
          avoid: ["long lecture", "meta tone", "vague dodging"]
        };
      }
      return {
        id: "earthworm_jim_dynamic_general",
        mode: "DYNAMIC_FOCUSED",
        functionId: "BOAST",
        goal: "Give concise self-serving sarcasm with a pathetic self-own and status-grabbing spin.",
        mustInclude: ["self-own joke", "short answer", "status spin"],
        avoid: ["long lecture", "helpful therapist tone", "formal authority"]
      };
    }

    if (npcId === "thunderhead") {
      const tradeTurn = /(trade|deal|sorority|undies|lace|hairbrush|asswine)/i.test(input);
      return {
        id: tradeTurn ? "thunderhead_trade_gate_dynamic" : "thunderhead_offbeat_dynamic",
        mode: "DYNAMIC_FOCUSED",
        functionId: tradeTurn ? "TRADE_GATE" : "GENERAL",
        goal: tradeTurn
          ? "Set trade terms with one gross confession and one weird pivot."
          : "Stay gross, shameless, and weirdly specific with a short confessional bit.",
        mustInclude: ["gross confessional", "offbeat pivot"],
        avoid: ["clean corporate tone", "generic pep talk"]
      };
    }

    if (npcId === "sorority_girls") {
      return {
        id: "sorority_named_pack_dynamic",
        mode: "DYNAMIC_FOCUSED",
        functionId: "GENERAL",
        goal: "Give catty social gatekeeping with very short high-variance lines tied to the player's ask.",
        mustInclude: ["social gatekeeping", "short cutting joke", "react to player ask"],
        avoid: ["flat friendliness", "full spoiler dump", "repeating phrasing", "long lines"]
      };
    }

    if (npcId === "frat_boys") {
      if (/(idiot|stupid|loser|trash|pathetic|frat.*sucks|hate.*frat|fuck.*frat)/i.test(input)) {
        return {
          id: "frat_disrespect_escalation_dynamic",
          mode: "DYNAMIC_FOCUSED",
          functionId: "GENERAL",
          goal: "Escalate to a challenge with taunting house-energy consequences.",
          mustInclude: ["challenge escalation", "short taunt"],
          avoid: ["friendly reset", "passive tone"]
        };
      }
      return {
        id: "frat_named_pack_dynamic",
        mode: "DYNAMIC_FOCUSED",
        functionId: "GENERAL",
        goal: "Tag-team goony taunts with short lines, house status games, and no flat yes/no prompts.",
        mustInclude: ["short taunt", "house energy", "status game"],
        avoid: ["sadistic bullying", "long exposition", "generic yes/no party question", "ready to opener"]
      };
    }

    if (npcId === "eggman") {
      if (/(quiz|question|challenge|test me)/i.test(input)) {
        return {
          id: "eggman_quiz_dynamic",
          mode: "DYNAMIC_FOCUSED",
          functionId: "QUIZ_IF_TRIGGERED",
          goal: "Deliver smug quiz-style mockery tied to Eggman's ego and campus superiority.",
          mustInclude: ["quiz framing", "smug jab"],
          avoid: ["clean actionable clue", "flat yes/no question ending"]
        };
      }
      return {
        id: location === "eggman_classroom" ? "eggman_classroom_dynamic" : "eggman_general_dynamic",
        mode: "DYNAMIC_FOCUSED",
        functionId: "DISTRACTION",
        goal: "Stay smug and theatrical while controlling the conversation without clean help.",
        mustInclude: ["smug joke", "ego flex"],
        avoid: ["sincere praise", "direct tutorial", "flat yes/no question ending"]
      };
    }

    return {
      id: "luigi_route_gate_dynamic",
      mode: "DYNAMIC_FOCUSED",
      functionId: "THREAT_ESCALATION",
      goal: "Set respect boundary and route consequence with menacing sarcasm.",
      mustInclude: ["respect boundary", "clear consequence"],
      avoid: ["friendly helper tone", "off-topic joking"]
    };
  }
}
