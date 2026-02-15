import { normalizeCharacterId } from "./shared.js";

function normalizeTerms(raw = []) {
  return raw
    .map((term) => String(term || "").toLowerCase().trim())
    .filter(Boolean)
    .map((term) => term.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeAlternatives(raw = []) {
  return raw
    .map((item) => String(item || "").toLowerCase().trim())
    .filter(Boolean)
    .map((item) => item.split("|")
      .map((part) => part.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean));
}

function countWords(text = "") {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

function markerConceptVariants(marker = "") {
  const value = String(marker || "").toLowerCase().trim();
  const map = {
    reckless: ["reckless", "chaos", "wild", "bad decision"],
    nightlife: ["nightlife", "party", "drink", "booze", "afterhours"],
    celebrity: ["celebrity", "famous", "status", "spotlight"],
    excess: ["excess", "overspend", "overkill", "too much"],
    compliance: ["comply", "no deal", "not moving", "withhold", "gate"],
    direct: ["direct", "straight", "cut to", "clear"],
    mission: ["mission", "objective", "task", "route"],
    frustrated: ["frustrated", "annoyed", "over it", "done waiting"],
    hint: ["hint", "clue", "pointer", "best guess"],
    single: ["single", "one move", "one step"],
    challenge: ["challenge", "prove", "stand", "test"],
    trade: ["trade", "deal", "condition", "swap"],
    gross: ["gross", "filthy", "grime", "dirty", "bad decision"],
    confessional: ["confession", "i did", "i once", "my bad"],
    respect: ["respect", "careful", "warning", "consequence"],
    direction: ["direction", "route", "move", "next step"],
    results: ["results", "clock", "execute", "mission"]
  };
  const tokens = value.split(/\s+/).filter((token) => token.length >= 4);
  const variants = new Set([value, ...tokens]);
  tokens.forEach((token) => {
    (map[token] || []).forEach((alias) => variants.add(alias));
  });
  return [...variants].filter(Boolean);
}

function intentConceptVariants(term = "") {
  const value = String(term || "").toLowerCase().trim();
  const map = {
    id: ["id", "student id", "clearance", "badge"],
    clearance: ["clearance", "id", "student id", "authorized"],
    move: ["move", "go", "head", "hustle", "dash", "push"],
    route: ["route", "path", "track", "way", "lane", "line"],
    mission: ["mission", "objective", "task", "goal", "stadium", "execute"],
    finish: ["finish", "complete", "done", "wrap"],
    trade: ["trade", "deal", "swap", "condition"],
    respect: ["respect", "careful", "warning", "consequence"],
    drink: ["drink", "booze", "shot", "buzzed"],
    challenge: ["challenge", "callout", "prove", "play"],
    escort: ["escort", "follow", "walk", "bring"],
    taunt: ["taunt", "jab", "roast", "clown", "prove", "callout", "trash talk"],
    short: ["short", "brief", "quick", "one line"],
    cadence: ["cadence", "trainin and gainin", "movin and provin", "swingin and bringin"],
    single: ["single", "one", "exactly one"],
    social: ["social", "status", "vibe", "image"],
    flex: ["flex", "brag", "ego", "show off"],
    spin: ["spin", "frame", "reframe", "sell it"],
    ego: ["ego", "genius", "superior", "smug"]
  };
  const tokens = value.split(/\s+/).filter((token) => token.length >= 3);
  const variants = new Set([value, ...tokens]);
  tokens.forEach((token) => {
    (map[token] || []).forEach((alias) => variants.add(alias));
  });
  return [...variants].filter(Boolean);
}

export class Evaluator {
  scoreStyle(characterId, text, contract = null, styleMeta = null) {
    const id = normalizeCharacterId(characterId);
    const lower = String(text || "").toLowerCase();
    const words = countWords(text);
    const sentences = String(text || "").split(/[.!?]+/).filter((line) => line.trim());
    let score = 100;
    const reasons = [];

    if (sentences.length > 2) {
      score -= 24;
      reasons.push("too_many_sentences");
    }
    if (words > 34) {
      score -= 12;
      reasons.push("too_wordy_mobile");
    }
    if (["as an ai", "i apologize", "i appreciate your request"].some((token) => lower.includes(token))) {
      score -= 24;
      reasons.push("generic_assistant_voice");
    }
    const markers = Array.isArray(contract?.styleMarkers) ? contract.styleMarkers : [];
    if (markers.length > 0) {
      const markerHit = markers.some((marker) => markerConceptVariants(marker).some((variant) => lower.includes(variant)));
      if (!markerHit) {
        score -= 8;
        reasons.push("missing_character_markers");
      }
    }
    if (id === "sonic" && !/(drink|campus|chaos|party|status|reckless|nightlife)/i.test(lower)) {
      score -= 10;
      reasons.push("sonic_missing_cutting_joke");
    }
    if (id === "sonic" && /(yacht|jet|lawyer|insurance|party|rooftop)/i.test(lower)) {
      const hasNamedAnchor = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z.']+)+\b/.test(String(text || ""));
      if (!hasNamedAnchor) {
        score -= 12;
        reasons.push("sonic_missing_named_anchor");
      }
    }
    if (id === "thunderhead") {
      const hasSpecificGrime = /(deli|payphone|mannequin|roast beef|raccoon|motel|grease|tunnel)/i.test(lower);
      if (!hasSpecificGrime) {
        score -= 10;
        reasons.push("thunderhead_missing_specific_grime_detail");
      }
    }
    if (styleMeta?.globalEcho) {
      score -= 12;
      reasons.push("global_echo_repeat");
    }
    if (styleMeta?.openerRepeat) {
      score -= 10;
      reasons.push("repeated_first_three_tokens");
    }
    if (styleMeta?.styleMemory?.lastPattern) {
      const prior = String(styleMeta.styleMemory.lastPattern || "");
      if (prior && lower.includes(prior.replace(/_/g, " "))) {
        score -= 8;
        reasons.push("repeated_structure_pattern");
      }
    }
    if (["frat_boys", "sonic", "eggman", "knuckles"].includes(id) && /\?\s*$/.test(String(text || "").trim())) {
      if (/(^|\s)(ready to|you ready|wanna|want to|are you|should we)\b/i.test(lower)) {
        score -= 16;
        reasons.push("flat_yes_no_setup");
      }
    }
    if (id === "tails" && /\?\s*$/.test(String(text || "").trim())) {
      score -= 14;
      reasons.push("tails_question_ending");
    }
    return { score: Math.max(0, score), reasons };
  }

  scoreIntent(text, intentContext = {}) {
    const lower = String(text || "").toLowerCase();
    const mustIncludeGroups = normalizeAlternatives(intentContext.must_include);
    const avoid = normalizeTerms(intentContext.avoid);
    let score = 100;
    const reasons = [];

    mustIncludeGroups.forEach((alternatives) => {
      const matched = alternatives.some((term) => {
        const variants = intentConceptVariants(term);
        return variants.some((variant) => variant.length > 1 && lower.includes(variant));
      });
      if (!matched) {
        score -= 14;
        reasons.push(`missing_intent_${alternatives.join("_or_").replace(/\s+/g, "_")}`);
      }
    });
    avoid.forEach((term) => {
      const tokens = term.split(" ").filter(Boolean);
      let matched = false;
      if (tokens.length >= 2) {
        matched = lower.includes(term);
      } else {
        matched = tokens.some((token) => token.length > 3 && lower.includes(token));
      }
      if (matched) {
        score -= 22;
        reasons.push(`violates_avoid_${term.replace(/\s+/g, "_")}`);
      }
    });
    return { score: Math.max(0, score), reasons };
  }

  scoreContext(text, context = {}) {
    const lower = String(text || "").toLowerCase();
    let score = 100;
    const reasons = [];
    const location = String(context?.gameContext?.location || "").toLowerCase();
    const playerInput = String(context?.gameContext?.player_input || "").toLowerCase();
    const lexemes = {
      dean_office: ["dean", "office", "desk", "clock"],
      quad: ["quad", "campus", "route"],
      frat: ["frat", "pong", "house"],
      tunnel: ["tunnel", "trade", "deal", "asswine"],
      stadium: ["stadium", "gate", "entry"]
    };
    const markers = lexemes[location] || [];
    const hasLocationMarker = markers.some((token) => lower.includes(token));
    if (markers.length && !hasLocationMarker) {
      const hasMissionAnchor = /(mission|route|stadium|move|trade|escort|id|objective|next step)/i.test(lower);
      const mustInclude = normalizeTerms(context?.intentContext?.must_include || []);
      const hasMustIncludeAnchor = mustInclude.some((term) => lower.includes(term));
      if (!hasMissionAnchor && !hasMustIncludeAnchor) {
        score -= 8;
        reasons.push("weak_location_anchor");
      }
    }
    if (/(where.*sonic|sonic.*where|find sonic|seen sonic)/i.test(playerInput)) {
      const hasSonicAnchor = /(sonic|here|not here|frat|dorm|cafeteria|quad|location|find|challenge)/i.test(lower);
      if (!hasSonicAnchor) {
        score -= 18;
        reasons.push("generic_response_on_state_specific_question");
      }
    }
    return { score: Math.max(0, score), reasons };
  }

  scoreHumor(text = "", intentContext = {}) {
    const lower = String(text || "").toLowerCase();
    const goal = String(intentContext?.goal || "").toLowerCase();
    if (goal.includes("safety")) return { score: 100, reasons: [] };
    let score = 100;
    const reasons = [];
    const humorSignals = [
      /(plot twist|quick note|anyway|listen|right,)/i.test(lower),
      /(seriously|obviously|tragically|bold move|nice try)/i.test(lower),
      /[!?]/.test(lower)
    ].filter(Boolean).length;
    if (humorSignals === 0) {
      score -= 20;
      reasons.push("missing_humor_beat");
    }
    return { score: Math.max(0, score), reasons };
  }

  evaluate(text, context, threshold = 56) {
    const style = this.scoreStyle(context.characterId, text, context.contract, context?.styleMeta || null);
    const intent = this.scoreIntent(text, context.intentContext);
    const anchor = this.scoreContext(text, context);
    const humor = this.scoreHumor(text, context.intentContext);
    const composite = Math.round((style.score * 0.45) + (intent.score * 0.24) + (anchor.score * 0.16) + (humor.score * 0.15));
    const reasons = [...style.reasons, ...intent.reasons, ...anchor.reasons, ...humor.reasons];
    return {
      compositeScore: composite,
      styleScore: style.score,
      reasons,
      shouldRegenerate: composite < threshold
    };
  }
}
