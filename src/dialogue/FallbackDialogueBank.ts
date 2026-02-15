import type { GameStateData, NpcId } from "../types/game";

function pick(lines: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash * 31) + seed.charCodeAt(i)) >>> 0;
  return lines[hash % lines.length];
}

export class FallbackDialogueBank {
  pick(npcId: NpcId, state: GameStateData, intentId = "generic"): string {
    const seed = `${state.timer.remainingSec}:${state.player.location}:${intentId}:${state.routes.routeA.progress}:${state.routes.routeB.progress}:${state.routes.routeC.progress}`;
    if (npcId === "dean_cain") {
      if (intentId.includes("mock_name")) return "That name is a bad decision. Mission still stands: get Sonic to Stadium.";
      if (intentId.includes("exam")) return "Name check failed. Retake entrance exam and move along.";
      if (intentId.includes("discipline")) return "Watch your tone. One more strike and you're expelled.";
      const deanEncounters = state.dialogue.encounterCountByNpc.dean_cain ?? 0;
      if (state.dialogue.deanStage === "name_pending") {
        return pick([
          "Hey sport, welcome to Console U. Name first, then we talk mission.",
          "Fresh entry. Give me your name before I issue anything official.",
          "You're in my office, so we do this in order: your name, then your assignment."
        ], `${seed}:dean:name:${deanEncounters}`);
      }
      return pick([
        "Back already? Mission is still Sonic to Stadium. Keep moving.",
        "You again. Progress report, not a monologue.",
        "Mission stands. Execute faster and talk less."
      ], `${seed}:dean:return:${deanEncounters}`);
    }
    if (npcId === "eggman") {
      if (intentId.includes("quiz")) return "Pop quiz: where does the clock die? Sorority stalls.";
      if (state.player.location === "quad") return "Quad is chaos and you still chose public thinking. Bold.";
      if (state.player.location === "cafeteria") return "Cafeteria strategy, amazing. Truly innovation with crumbs.";
      return "Petty fact: your timing is poor and your confidence is louder than your plan.";
    }
    if (npcId === "sonic") {
      return state.sonic.drunkLevel >= 3
        ? "I am buzzed, famous, and one bass drop away from a campus incident report."
        : pick([
          "No free ride. Bring leverage and a glorious bad idea.",
          "I can do reckless, random, and weirdly poetic, but never boring.",
          "Bring fuel, a rumor, and an exit strategy your lawyer can deny."
        ], `${seed}:sonic`);
    }
    if (npcId === "tails") {
      return pick([
        "Pick one route and run it. Overthinking is how this mission dies.",
        "Shortest path, fast leverage, move Sonic. That's the whole movie.",
        "Do one useful move right now, then we can panic later."
      ], `${seed}:tails`);
    }
    if (npcId === "earthworm_jim") {
      return pick([
        "Do one useful move now and I will absolutely pretend I planned it.",
        "Credit theft first, accountability never. That's my leadership framework.",
        "Pick a move and finish it. I need a win I can misreport to future biographers."
      ], `${seed}:jim`);
    }
    if (npcId === "frat_boys") {
      if (intentId.includes("sonic_location")) {
        return state.world.presentNpcs[state.player.location]?.includes("sonic")
          ? pick([
            "Diesel: Sonic is right here. Stop asking and start challenging.",
            "Erection Bill: He's in front of you. Cups up or hush up.",
            "Provoloney Tony: Found him. Don't waste the moment."
          ], `${seed}:frat:sonic-here`)
          : pick([
            "Diesel: Not here. Find Sonic first, then bring him back to Frat by challenging him.",
            "Erection Bill: Sonic comes after the callout, not before.",
            "Provoloney Tony: Track him down, talk your trash, then run it here."
          ], `${seed}:frat:sonic-away`);
      }
      return pick([
        "Diesel: No handouts. Earn your lane.",
        "Erection Bill: Reputation is rented nightly. Pay in results.",
        "Provoloney Tony: Don't embarrass us in front of the Bluetooth speaker."
      ], `${seed}:frat`);
    }
    if (npcId === "sorority_girls") {
      return pick([
        "Apple: You're in our house, so act normal.",
        "Fedora: We can help accidentally, not intentionally.",
        "Responsible Rachel: Keep this brief and non-chaotic."
      ], `${seed}:sorority`);
    }
    if (npcId === "thunderhead") {
      return pick([
        "No Sorority contraband, no Asswine. These tunnel commandments are carved in grime.",
        "Bring lace-tier chaos and we do reverent, disgusting commerce.",
        "You came empty-handed; I came spiritually shirtless. No trade."
      ], `${seed}:thunderhead`);
    }
    if (npcId === "knuckles") {
      return pick([
        "Trainin and gainin. Move.",
        "Swingin and bringin. Show me one clean move.",
        "Movin and provin. Don't freeze when it's time to strike."
      ], `${seed}:knuckles`);
    }
    return "Stay sharp.";
  }
}
