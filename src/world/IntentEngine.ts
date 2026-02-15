import type { GameStateData, NpcId, NpcIntentState } from "../types/game";

const GOAL_BY_NPC: Record<NpcId, string> = {
  dean_cain: "enforce results",
  luigi: "seek validation",
  eggman: "stall with quizzes",
  earthworm_jim: "redirect to frat",
  frat_boys: "protect frat house lane",
  sorority_girls: "run social gatekeeping",
  thunderhead: "gate Asswine trade",
  sonic: "avoid responsibility",
  tails: "guide efficiently",
  knuckles: "hype and advise"
};

export class IntentEngine {
  compute(state: GameStateData): Partial<Record<NpcId, NpcIntentState>> {
    const urgency = state.timer.remainingSec < 240 ? 8 : state.timer.remainingSec < 480 ? 5 : 2;
    const sonicMood: NpcIntentState["mood"] = state.sonic.drunkLevel >= 3 ? "calm" : "annoyed";

    return {
      dean_cain: { goal: GOAL_BY_NPC.dean_cain, mood: "urgent", patience: 3 - state.fail.warnings.dean, urgency: urgency + 1 },
      luigi: { goal: GOAL_BY_NPC.luigi, mood: state.fail.warnings.luigi > 0 ? "annoyed" : "calm", patience: 2 - state.fail.warnings.luigi, urgency },
      eggman: { goal: GOAL_BY_NPC.eggman, mood: "calm", patience: 3, urgency: urgency - 1 },
      earthworm_jim: { goal: GOAL_BY_NPC.earthworm_jim, mood: "calm", patience: 3, urgency: urgency - 1 },
      frat_boys: { goal: GOAL_BY_NPC.frat_boys, mood: "annoyed", patience: 2, urgency },
      sorority_girls: { goal: GOAL_BY_NPC.sorority_girls, mood: "calm", patience: 2, urgency: urgency - 1 },
      thunderhead: { goal: GOAL_BY_NPC.thunderhead, mood: "calm", patience: 3, urgency },
      sonic: { goal: GOAL_BY_NPC.sonic, mood: sonicMood, patience: 3, urgency },
      tails: { goal: GOAL_BY_NPC.tails, mood: "calm", patience: 3, urgency },
      knuckles: { goal: GOAL_BY_NPC.knuckles, mood: "calm", patience: 3, urgency: urgency - 1 }
    };
  }
}
