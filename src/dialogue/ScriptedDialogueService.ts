import type { GameStateData, NpcId } from "../types/game";
import { ESCORT_READY_DRUNK_LEVEL, isEscortReady } from "../gameplay/progressionRules";

function pickLine(lines: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash * 33) ^ seed.charCodeAt(i)) >>> 0;
  return lines[hash % lines.length];
}

function inferProgressBand(state: GameStateData): "intake" | "hunt_early" | "route_committed" | "endgame" {
  if (!state.player.inventory.includes("Student ID")) return "intake";
  if (state.timer.remainingSec < 180 || (state.sonic.following && isEscortReady(state.sonic.drunkLevel))) return "endgame";
  if (state.routes.routeA.progress > 0 || state.routes.routeB.complete || state.routes.routeC.complete || state.sonic.drunkLevel >= 2) {
    return "route_committed";
  }
  return "hunt_early";
}

export class ScriptedDialogueService {
  getGreeting(npcId: NpcId, encounterCount = 0, seedKey = ""): string {
    const firstEncounterGreetings: Record<NpcId, string[]> = {
      dean_cain: [
        "Hey sport, welcome to Console U. What's your name, bud?",
        "Well look at that. Give me your name before this becomes paperwork.",
        "Great. I'm Dean Cain. Name, then mission, then you disappoint me professionally.",
        "Welcome to Console U. Give me your name now so I can issue your ID and move this along.",
        "You're in my office, so we skip small talk. Name first, mission second.",
        "I run this campus and this clock. Your first name, then your assignment.",
        "Welcome. State your name so I can stamp your ID and point you at Sonic.",
        "Good entrance, bad timing. Name now, mission briefing next."
      ],
      luigi: [
        "Start respectful and we get along fine.",
        "Luigi. I can hear you from a mile away, so let's keep this civil.",
        "Say your piece clean and we skip the drama."
      ],
      eggman: [
        "Ah, finally, an audience with acceptable posture and questionable judgment.",
        "Congratulations, you found the only genius on this lawn.",
        "Ask something worth my brain cells and we both win."
      ],
      earthworm_jim: [
        "Good, you're here. I was almost about to look responsible by accident.",
        "Perfect timing. I need results I can take credit for.",
        "Great, a witness. Keep this flattering and legally vague."
      ],
      frat_boys: [
        "Diesel: House rule one, no spectators. Bring heat or bring snacks.",
        "Provolone Toney: Welcome to Frat. Reputation in, excuses out.",
        "Frat Boys: Door's open, rank is not. Earn your seat."
      ],
      sorority_girls: [
        "Apple: Cute entrance. What's your angle?",
        "Fedora: Confidence acceptable, judgment still pending.",
        "Sorority Girls: Welcome. Quick intro, then we decide your ranking."
      ],
      thunderhead: [
        "Tunnel desk is open. You here to trade or hear an inadvisable confession?",
        "You found me. Either fate or your standards collapsed in real time.",
        "New visitor. Great. I run weird deals and worse judgment."
      ],
      sonic: [
        "If this is about the tab, my card called it fraud and my soul called it Tuesday.",
        "If you're here about last night, yes, someone proposed in a hot tub and it was not legal advice.",
        "Before you lecture me, I turned one drink into a blackout TED Talk on bad decisions."
      ],
      tails: [
        "Finish Dean's mission and move Sonic to Stadium. Spare me the chaos documentary.",
        "Leverage beats theory. Pick a route and stop stalling.",
        "Commit to one line and execute. Hesitation is just failure with extra steps."
      ],
      knuckles: [
        "Say what you need and keep it concrete.",
        "Ask straight. I'll answer straight.",
        "No fluff. What's your move?"
      ]
    };
    const returnGreetings: Record<NpcId, string[]> = {
      dean_cain: [
        "Back already? Keep it moving unless you brought progress.",
        "You again. Clock's running, chief. Mission updates only.",
        "Oh, it's my favorite recurring appointment. Be brief and useful.",
        "Back so soon? Progress report, not performance art.",
        "Return visit accepted. Mission still stands; excuses still denied.",
        "You again. Give me results or give me hallway silence."
      ],
      luigi: [
        "Back again. Respect stays high, tension stays low.",
        "You returned. Keep your tone clean and we stay good.",
        "Round two. Make it useful."
      ],
      eggman: [
        "Back already? Excellent, my superiority was getting lonely.",
        "Repeat visitor. I assume your previous strategy exploded.",
        "Welcome back to office hours for avoidable mistakes."
      ],
      earthworm_jim: [
        "Back already? Great, reality is still sabotaging my excellence.",
        "You again. Good. I can resume unauthorized credit intake.",
        "There you are. Keep this quick, I'm busy being unfairly judged."
      ],
      frat_boys: [
        "Diesel: Back in the house. Momentum talks, posture walks.",
        "Provolone Toney: Return visit logged. Performance still pending.",
        "Frat Boys: Round two energy. Don't waste our music."
      ],
      sorority_girls: [
        "Apple: You came back. That's either confidence or a warning sign.",
        "Fedora: Return visit noted. Keep it sharp.",
        "Sorority Girls: Again? Fine. Don't make it weird."
      ],
      thunderhead: [
        "You came back. Great, my poor judgment feels seen.",
        "Repeat customer in my swamp of choices. Terms still stand.",
        "Back for the weird lane? I admire your lack of caution."
      ],
      sonic: [
        "Back again. Keep it reckless and keep receipts off my name.",
        "You returned. Great, we can skip ethics and speedrun regret.",
        "Round two. Keep up and keep me entertained."
      ],
      tails: [
        "Back again. Move Sonic to Stadium and stop bleeding time.",
        "Still stuck. Shortest route, fast leverage, go.",
        "Progress now. One route, one move, done."
      ],
      knuckles: [
        "Back again? Ask directly and move.",
        "Round two. Keep it simple and I'll keep it useful.",
        "Still here? Take your next shot and stop stalling."
      ]
    };
    const rows = encounterCount <= 0 ? firstEncounterGreetings[npcId] : returnGreetings[npcId];
    const key = `${seedKey}:${npcId}:${encounterCount}`;
    return pickLine(rows, key);
  }

  respond(npcId: NpcId, input: string, state: GameStateData, intentId = "generic"): string {
    const text = input.toLowerCase();
    const voiceSeed = `${state.timer.remainingSec}:${state.player.location}:${state.routes.routeA.progress}:${state.routes.routeB.progress}:${state.routes.routeC.progress}:${text.length}`;
    const progressBand = inferProgressBand(state);
    if (npcId === "dean_cain") {
      if (state.player.inventory.includes("Exam Keycard")) {
        return state.fail.warnings.dean >= 2
          ? "You keep showing up with restricted office material. I am out of patience and almost out of mercy."
          : "Still carrying my Exam Keycard? Hand it over before this becomes an expulsion hearing.";
      }
      if (intentId === "dean_mock_name_mission") {
        state.dialogue.deanStage = "mission_given";
        return "That name is tragic. Mission is still simple: get Sonic to Stadium. Try not to fail publicly.";
      }
      if (intentId === "dean_exam_redirect") {
        state.dialogue.deanStage = "name_pending";
        return "You are drifting. Retake the entrance exam, then come back with a real answer.";
      }
      if (intentId === "dean_discipline") {
        state.fail.warnings.dean += 1;
        if (state.fail.warnings.dean >= 2) {
          state.fail.hardFailed = true;
          state.fail.reason = "Dean expelled you for disrespect.";
          state.dialogue.deanStage = "expelled";
          return "You're expelled. Security will escort you out.";
        }
        state.dialogue.deanStage = "name_pending";
        return state.fail.warnings.dean > 0
          ? "Cute attitude. One more disrespect and you're expelled."
          : "Watch it. I run this office.";
      }
      if (intentId === "dean_intake_gate") {
        if (!state.player.inventory.includes("Student ID")) {
          state.player.inventory.push("Student ID");
        }
        state.dialogue.deanStage = "mission_given";
        return pickLine([
          "Name logged, ID issued. Mission is simple to say and painful to execute: get Sonic to Stadium. Move.",
          "Good. Student ID is live. Your assignment is Sonic to Stadium, no drama bonus points.",
          "Done. You're cleared. Mission starts now: escort Sonic to Stadium and keep this office out of headlines.",
          "Accepted. ID active. Get Sonic to Stadium before this campus invents another crisis.",
          "Fine. Paperwork complete. Mission is Sonic to Stadium; do it fast and do it clean."
        ], `${voiceSeed}:dean:intake`);
      }
      if (intentId === "dean_post_mission_dismiss") {
        state.dialogue.deanStage = "dismiss_mode";
        return "Mission already assigned. You're still here why?";
      }
      if (intentId === "dean_dismiss_to_distraction") {
        state.dialogue.deanStage = "dismiss_mode";
        return "If you're done talking, move. If you're stalling, at least be subtle.";
      }
      if (/(name|entrance exam|enroll)/i.test(text)) {
        state.dialogue.deanStage = "mission_given";
        return "You still owe me a passable entrance exam. Do it, then run the Sonic-to-Stadium mission.";
      }
      if (/(sorry|respect|sir)/i.test(text)) {
        state.dialogue.deanStage = "mission_given";
        return state.fail.warnings.dean > 0
          ? "Apology accepted. Warning stays. Finish the mission and stay useful."
          : "Good. Keep it respectful and get Sonic to Stadium.";
      }
      if (/(desk|whiskey|steal)/i.test(text)) {
        state.dialogue.deanStage = "dismiss_mode";
        return state.fail.warnings.dean > 0
          ? "You touched my office twice. Expulsion is one move away."
          : "You are close to a warning. Stop hovering near my desk.";
      }
      state.dialogue.deanStage = "name_pending";
      return pickLine([
        "Name, mission, exit. Don't make this longer than your GPA can handle.",
        "Give me your first name so I can issue your ID and assign Sonic duty.",
        "This is intake, not improv. Name first, then mission.",
        "You're one name away from clearance. Keep it simple.",
        "Name now, mission now, clock keeps moving either way."
      ], `${voiceSeed}:dean:name-pending`);
    }

    if (npcId === "luigi") {
      if (/(id|student id|clearance)/i.test(text)) {
        return state.player.inventory.includes("Student ID")
          ? "You got Student ID. Good. That means you can stop improvising excuses and start executing routes."
          : "No Student ID, no clean clearance. Go get stamped before you get stopped.";
      }
      if (state.player.inventory.includes("Fake ID Wristband") || state.player.inventory.includes("Exam Keycard") || state.player.inventory.includes("Frat Bong")) {
        return "What are you carrying right now? That item gets people expelled. Fix this before I do.";
      }
      if (/(sorry|respect|thanks|nice|cool)/i.test(text)) {
        return state.player.inventory.includes("Lace Undies")
          ? "You already have what Thunderhead needs. Take tunnel route now."
          : "Accepted. Tunnel route starts under Sorority. Bring him the lace contraband.";
      }
      if (/(idiot|useless|stupid|hate|trash)/i.test(text)) {
        return state.fail.warnings.luigi > 0
          ? "Keep that tone up and you're done here."
          : "Tone check. That's your warning.";
      }
      return "Say one useful thing: tunnel, sorority, or route.";
    }

    if (npcId === "eggman") {
      if (/(where.*sonic|sonic.*where|seen sonic|find sonic|locate sonic|track sonic)/i.test(text)) {
        return pickLine([
          `Sonic is rotating through ${state.sonic.location}. Intercept there, then force a challenge.`,
          `Telemetry says Sonic is at ${state.sonic.location}. Move now before he rotates again.`,
          `You want Sonic? Current sighting is ${state.sonic.location}. Stop asking, start moving.`
        ], `${voiceSeed}:eggman:sonic-location`);
      }
      if (intentId === "eggman_quiz_dynamic") {
        return pickLine([
          "Quiz mode: where does your run leak time first? Hint: Sorority loitering.",
          "Pop quiz, underachiever: which stop burns clock fastest? Sorority.",
          "Exam time. Name one place you stall for no reason. Yes, Sorority."
        ], `${voiceSeed}:eggman:quiz`);
      }
      if (intentId === "eggman_quad_dynamic") {
        return pickLine([
          "Quad traffic is leverage. Move with intent, not theater.",
          "Quad is noise. The winner routes through it, not into it.",
          "This square is for transitions, not life stories."
        ], `${voiceSeed}:eggman:quad`);
      }
      if (intentId === "eggman_cafeteria_dynamic") {
        return pickLine([
          "Cafeteria chaos, classic. I could help, but then where is your growth arc?",
          "You came to the cafeteria for strategy? Bold and incorrect.",
          "Yes, the cafeteria again. Truly a strategic mastermind at work."
        ], `${voiceSeed}:eggman:cafe`);
      }
      if (intentId === "eggman_classroom_dynamic") {
        return pickLine([
          "Welcome to my classroom, where your grades are theoretical and my ego is mandatory.",
          "Class is in session. Topic one: why your decision-making terrifies science.",
          "Take a seat. Today's lecture is called 'How Not To Waste My Genius'."
        ], `${voiceSeed}:eggman:class`);
      }
      if (/(quiz|question|challenge)/i.test(text)) {
        return "Quiz answer: Campus loops kill runs. Ask, then act. If you have a lead, move immediately.";
      }
      if (/(hint|route|plan)/i.test(text)) {
        if (progressBand === "intake") return "You are still in paperwork tutorial. Get ID first, then ask me for route science.";
        if (progressBand === "hunt_early") return "Route brief: Frat pressure route is fastest, Dean Whiskey is safer, Tunnel trade is highest setup cost.";
        if (progressBand === "route_committed") return "You have enough data. Stop collecting trivia and execute your chosen route chain.";
        return "Endgame protocol: no detours, no loops, move Sonic to Stadium now.";
      }
      if (progressBand === "intake") return "Actionable clue: only one task matters right now - intake with Dean.";
      if (progressBand === "endgame") return "Actionable clue: if Sonic is ready, escort now. If not, force one final drink and move.";
      return "Actionable clue: do not camp one room. Rotate Quad -> Cafeteria -> Dorm Hall and watch rumor updates.";
    }

    if (npcId === "earthworm_jim") {
      if (state.timer.remainingSec < 300) return "Time is bleeding out. Pick one move now and I'll rewrite history in my favor later.";
      if (!state.routes.routeA.complete) return "Easy play is right there. I'll steal credit before your sentence ends.";
      return "Choose one mess and finish it so I can spin it as leadership.";
    }

    if (npcId === "frat_boys") {
      if (/(id|student id|clearance)/i.test(text)) {
        return state.player.inventory.includes("Student ID")
          ? "Diesel: You got the badge, cool. Now earn respect at the table."
          : "Provolone Toney: No ID, no swagger. Go get official first.";
      }
      if (/(where.*sonic|sonic.*where|seen sonic|find sonic)/i.test(text)) {
        if (state.world.presentNpcs[state.player.location]?.includes("sonic")) {
          return pickLine([
            "Diesel: He's right here. Ask less, play more.",
            "Provolone Toney: Sonic is in the room, genius. Challenge him or keep sightseeing.",
            "Provolone Toney: You found him. Now prove you're not just decorative."
          ], `${voiceSeed}:frat:sonic-here`);
        }
        return pickLine([
          "Diesel: Not here. Track rumors at Quad/Cafeteria/Dorm Hall, then challenge him and drag him back.",
          "Provolone Toney: You want Sonic? Get two real clues first. Frat gets him after the challenge.",
          "Provolone Toney: Sonic pops in after callout. Ask around campus and stop hard-camping one room."
        ], `${voiceSeed}:frat:sonic-away`);
      }
      if (/(search|snoop|stash|steal|bong)/i.test(text) && state.world.presentNpcs.frat.includes("frat_boys")) {
        return pickLine([
          "Diesel: Keep your hands off house stash unless you want the whole porch on you.",
          "Provolone Toney: You snoop in front of us again and we skip straight to consequences.",
          "Provolone Toney: You can look, but if you grab, we're all suddenly very cardio-positive."
        ], `${voiceSeed}:frat:stash-warning`);
      }
      if (/(beer|pong|challenge|prove)/i.test(text)) {
        return pickLine([
          "Diesel: Good. Cups up. No speeches.",
          "Provolone Toney: Prove it at the table, not with your mouth.",
          "Provolone Toney: If this goes bad I'm calling my mom, but yeah, let's run it."
        ], `${voiceSeed}:frat:challenge`);
      }
      if (progressBand === "endgame") {
        return "Diesel: Clock is bleeding. If Sonic is loaded, stop talking and move him to gate.";
      }
      return pickLine([
        "Diesel: No free passes in this house. Bring proof.",
        "Provolone Toney: Status is rented nightly. Pay in results.",
        "Provolone Toney: You look like a before photo. Let's fix that."
      ], `${voiceSeed}:frat:general`);
    }

    if (npcId === "sorority_girls") {
      if (state.world.restrictions.sororityBanned) {
        return pickLine([
          "Apple: Ban stands. You stole once and trust is permanently sold out.",
          "Fedora: You are on the no-entry list. We laminated it for drama and durability.",
          "Responsible Rachel: House decision is final. You're not rejoining this space today."
        ], `${voiceSeed}:sorority:banned`);
      }
      if (/(search|look around|snoop|scan)/i.test(text)) {
        return pickLine([
          "Responsible Rachel: Hard no. This house isn't your scavenger hunt.",
          "Apple: If you're snooping, at least pretend to be subtle.",
          "Fedora: Wow, boundary awareness is not your major."
        ], `${voiceSeed}:sorority:search`);
      }
      if (/(party|last night|handcuff|hookup)/i.test(text)) {
        return pickLine([
          "Apple: Last night was chaos. If you're searching for leverage, do it when house traffic is low.",
          "Fedora: Party archives are closed. But yes, people stash questionable gear in plain sight.",
          "Responsible Rachel: We do not litigate party history. Also, don't get caught taking anything."
        ], `${voiceSeed}:sorority:party`);
      }
      return pickLine([
        "Apple: We run this house by receipts and memory. Helpful items exist; consequences exist too.",
        "Fedora: You can stand there, just don't be weird. Move fast when the room clears out.",
        "Responsible Rachel: Keep it respectful and short. If we catch theft, you are banned."
      ], `${voiceSeed}:sorority:general`);
    }

    if (npcId === "thunderhead") {
      if (state.player.inventory.includes("Lace Undies") || state.player.inventory.includes("Sorority Mascara") || state.player.inventory.includes("Sorority Composite")) {
        return pickLine([
          "You brought premium sorority contraband. My filthy chapel approves. Trade accepted.",
          "Lace item confirmed. That is sacred grime-tier currency. Bottle is yours.",
          "That souvenir is depraved in exactly the right flavor. Deal.",
          "Mascara or composite? Perfect. Degenerate logistics complete, Asswine dispensed.",
          "You understood the assignment and the moral collapse. Trade done."
        ], `${voiceSeed}:thunderhead:trade`);
      }
      if (state.player.inventory.includes("Hairbrush") || state.player.inventory.includes("Fake ID Wristband") || state.player.inventory.includes("Sorority House Key")) {
        return pickLine([
          "Hairbrush? That's hygiene, not heresy. Bring chaos-tier contraband.",
          "Fake wristband? Cute fake sin, wrong altar. Still no bottle.",
          "Wrong sorority relic. My standards are filthy, not flexible.",
          "Too practical. I trade in glorious bad decisions and collectible shame.",
          "This isn't perverted enough to clear customs in my tunnel."
        ], `${voiceSeed}:thunderhead:reject`);
      }
      return pickLine([
        "One rule: sorority contraband for Asswine. Mascara, lace, or composite all count.",
        "No approved contraband, no bottle. Hairbrush and fake wristband are trash tier here.",
        "Bring the right sorority trophy and we do filthy commerce with ceremonial respect.",
        "I need a relic with scandal energy, not a normal object with a backstory.",
        "Trade terms are simple: shock me, then I pour."
      ], `${voiceSeed}:thunderhead:block`);
    }

    if (npcId === "sonic") {
      if (/(go to stadium|head to stadium|take.*stadium|escort.*stadium|stadium now|follow me)/i.test(text)) {
        if (!isEscortReady(state.sonic.drunkLevel)) {
          return `Stadium pitch is weak right now. Push me to drunk level ${ESCORT_READY_DRUNK_LEVEL}+ first, then we move.`;
        }
        if (state.sonic.following) {
          return "I am already moving with you. Keep pace and point me at the gate.";
        }
        return "Fine, now we're talking. Keep this loud and keep me moving - no boring detours.";
      }
      if (state.sonic.drunkLevel >= 3) {
        return pickLine(
          state.sonic.following
            ? [
                "I'm walking with you, not behaving for you. Keep pace and keep me out of court.",
                "Escort mode, not rehab mode. Move fast and let me improvise bad choices responsibly.",
                "I'm following, but this is still my movie. Keep moving and keep receipts fake."
              ]
            : [
                "You got me loaded, not leashed. Pitch something wild enough to interrupt my legend.",
                "I'm drunk, famous, and dangerously available for terrible plans. Impress me.",
                "Buzz is at prophecy level. Bring a stunt with budget and plausible deniability."
              ],
          `${voiceSeed}:sonic:loaded:${state.sonic.following ? "follow" : "free"}`
        );
      }
      if (/(beer|drink|shot|pong|party)/i.test(text)) {
        return pickLine([
          "Sure. Last time I did shots here, campus security asked me to autograph the citation.",
          "Pour first, flex harder. I lost a sports car in a coin toss and called it character development.",
          "Quick drink, reckless headline, expensive regret. That's my cardio.",
          "I once toasted with champagne in a fountain and woke up trending in three counties.",
          "I party like a bad sequel with perfect lighting and no adult supervision."
        ], `${voiceSeed}:sonic:drink`);
      }
      if (state.player.inventory.includes("Dean Whiskey") || state.player.inventory.includes("Asswine")) {
        return pickLine([
          "That bottle is leverage. If tonight trends for the wrong reason, you're my publicist.",
          "Good bottle. Bad consequences. Pour it and let history misquote me.",
          "Now we're speaking fluent chaos. Pour and don't ask follow-up questions."
        ], `${voiceSeed}:sonic:inventory`);
      }
      return pickLine([
        "No freebies. Bring chaos, gossip, or cash-burn energy, then we talk.",
        "I do big, bold, and dumb in elegant packaging. Bring me something worthy.",
        "Come back with scandal fuel and a disrespectful budget."
      ], `${voiceSeed}:sonic:block`);
    }

    if (npcId === "knuckles") {
      const userTriedRhyme = /(ime|ight|ow|ay|oon)\b/i.test(text.trim());
      if (userTriedRhyme) {
        return pickLine([
          "Trainin and painin, that was decent. Now move.",
          "Grindin and findin, you almost had it. Now prove it.",
          "Stridin and glidin, clean cadence. Keep pushin."
        ], `${voiceSeed}:knuckles:cadence`);
      }
      return pickLine([
        "Swingin and bringin. Pick your move and stand on it.",
        "Risin and prizin. I am not impressed yet. Prove it.",
        "Movin and provin. Brag after results."
      ], `${voiceSeed}:knuckles:challenge`);
    }

    if (npcId === "tails") {
      if (/(where.*sonic|sonic.*where|seen sonic|find sonic|locate sonic|track sonic)/i.test(text)) {
        return `Latest solid lead: Sonic at ${state.sonic.location}. Intercept, pressure, then convert to movement.`;
      }
      if (/(id|student id|clearance)/i.test(text)) {
        return state.player.inventory.includes("Student ID")
          ? "Good, you have Student ID. Gate excuses are gone, so route execution is all that matters."
          : "No Student ID means no clean stadium entry. Fix that now.";
      }
      if (progressBand === "intake") {
        return "Dean first. Name intake, Student ID, then route hunting. Anything else is wasted clock.";
      }
      if (state.timer.remainingSec < 240) {
        return pickLine([
          "Clock is red. Move Sonic now or we fail in public.",
          "No heroics left. Pick one route and execute before the timer humiliates us.",
          "Time is nearly gone. One move, then finish. Yes, I am judging your pace."
        ], `${voiceSeed}:tails:late`);
      }
      if (progressBand === "route_committed") {
        return pickLine([
          "You've committed. Convert setup to movement: dose Sonic, escort, gate.",
          "No more scavenger loops. Your route is built - execute in sequence.",
          "You're at the midpoint. One mistake is recoverable; two ends the run."
        ], `${voiceSeed}:tails:committed`);
      }
      return pickLine([
        "Best guess: build two clues first, then sweep Dorm Hall/Cafeteria for Sonic sightings.",
        "Booze leverage is ugly but efficient. If Sonic is tipsy, escort immediately.",
        "Commit to one route and execute. Frat for speed, Dean Whiskey for control, Tunnel for heavy effect."
      ], `${voiceSeed}:tails:normal`);
    }

    return "Stay sharp and keep your angle.";
  }
}
