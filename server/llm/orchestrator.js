import fs from "fs/promises";
import { config } from "./config.js";
import { ContextBuilder } from "./context-builder.js";
import { MemoryService } from "./memory-service.js";
import { PromptBuilder } from "./prompt-builder.js";
import { ModelRouter } from "./model-router.js";
import { OpenAIAdapter } from "./adapters/openai-adapter.js";
import { GeminiAdapter } from "./adapters/gemini-adapter.js";
import { SafetyService } from "./safety-service.js";
import { Evaluator } from "./evaluator.js";
import { FallbackService } from "./fallback-service.js";
import { extractJsonFromText, fitBubbleLineWithLimit, hash, percentile, sanitizeNpcText, sleep } from "./shared.js";

async function appendJsonl(filePath, payload) {
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function readJsonl(filePath, limit = 2000) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

const DEFAULT_SONIC_REFERENCE_DATA = {
  women: ["Heather Locklear", "Phoebe Cates", "Molly Ringwald", "Lea Thompson", "Mayim Bialik"],
  men: ["Joey Lawrence", "Rob Lowe", "Jason Bateman", "David Hasselhoff", "Don Johnson"]
};

let ACTIVE_SONIC_REFERENCE_DATA = { ...DEFAULT_SONIC_REFERENCE_DATA };

async function loadSonicReferenceData() {
  try {
    const raw = await fs.readFile(config.sonicReferencePath, "utf8");
    const parsed = JSON.parse(raw);
    const women = Array.isArray(parsed?.women) ? parsed.women.filter((v) => typeof v === "string" && v.trim()) : [];
    const men = Array.isArray(parsed?.men) ? parsed.men.filter((v) => typeof v === "string" && v.trim()) : [];
    if (women.length >= 3 && men.length >= 3) {
      ACTIVE_SONIC_REFERENCE_DATA = { women, men };
      return;
    }
  } catch {
    // Keep defaults if file missing or malformed.
  }
  ACTIVE_SONIC_REFERENCE_DATA = { ...DEFAULT_SONIC_REFERENCE_DATA };
}

function splitSentenceChunks(text = "") {
  const chunks = String(text || "").match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g);
  return (chunks || []).map((part) => part.trim()).filter(Boolean);
}

function pruneGenericOpener(text = "") {
  const line = String(text || "").trim();
  if (!line) return line;
  const stripped = line
    .replace(/^(great|listen|look|okay|ok|alright|well|honestly|seriously)\b[:,.-]?\s*/i, "")
    .replace(/^(quick note|real talk)\b[:,.-]?\s*/i, "")
    .trim();
  return stripped || line;
}

function enforceKnucklesCadence(text = "", seed = "") {
  const line = String(text || "").trim();
  if (!line) return "Trainin and gainin - pick your lane and close it.";
  const cadenceRx = /\b[a-z]{3,}in(?:g)?\s+and\s+[a-z]{3,}in(?:g)?\b/gi;
  const matches = [...line.matchAll(cadenceRx)];
  const normalizeOneSentence = (raw = "") => {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    const normalized = /^[a-z]/.test(trimmed) ? `${trimmed[0].toUpperCase()}${trimmed.slice(1)}` : trimmed;
    const first = splitSentenceChunks(normalized)[0] || normalized;
    return /[.!?]$/.test(first) ? first : `${first}.`;
  };
  if (matches.length === 1) return normalizeOneSentence(line);
  if (matches.length > 1) {
    let kept = 0;
    const compact = line.replace(cadenceRx, (m) => {
      kept += 1;
      return kept === 1 ? m : "";
    }).replace(/\s+/g, " ").trim();
    return normalizeOneSentence(compact);
  }
  const pairs = ["Trainin and gainin", "Movin and provin", "Swingin and bringin", "Stridin and glidin"];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  const pair = pairs[h % pairs.length];
  const compact = splitSentenceChunks(line)[0] || line;
  return normalizeOneSentence(`${pair} - ${compact}`);
}

function seededPick(seed = "", values = []) {
  if (!values.length) return "";
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = ((h * 37) ^ seed.charCodeAt(i)) >>> 0;
  return values[h % values.length];
}

function seededPickWithAvoid(seed = "", entries = [], avoidFn = () => false) {
  if (!entries.length) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = ((h * 41) ^ seed.charCodeAt(i)) >>> 0;
  const start = h % entries.length;
  for (let step = 0; step < entries.length; step += 1) {
    const candidate = entries[(start + step) % entries.length];
    if (!avoidFn(candidate)) return candidate;
  }
  return entries[start];
}

function normalizeForEcho(text = "") {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function firstThreeTokenKey(text = "") {
  return normalizeForEcho(text).split(" ").filter(Boolean).slice(0, 3).join(" ");
}

function pushRecent(list = [], value = "", limit = 4) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return Array.isArray(list) ? list.slice(-limit) : [];
  const next = Array.isArray(list) ? [...list, trimmed] : [trimmed];
  return next.slice(-limit);
}

function enforceFratSonicSpecificity(text = "", playerInput = "", gameContext = {}) {
  const line = String(text || "").trim();
  const input = String(playerInput || "").toLowerCase();
  if (!/(where.*sonic|sonic.*where|find sonic|seen sonic)/i.test(input)) return line;
  if (/(sonic|here|not here|frat|dorm|cafeteria|quad|location|challenge|find)/i.test(line)) return line;
  const fallbackLocation = String(gameContext?.sonic_location || "campus");
  return `Sonic is ${fallbackLocation}. Track him down, challenge him, then bring him to Frat.`;
}

function enforceFratNoFlatYesNo(text = "") {
  const line = String(text || "").trim();
  if (!line) return line;
  if (!/\?\s*$/.test(line)) return line;
  if (!/(^|\s)(ready to|you ready|wanna|want to|are you|should we)\b/i.test(line)) return line;
  return "Diesel: Skip the checkbox talk. Bring a stunt, a rumor, or a challenge and earn your lane.";
}

function enforceSonicMissionSilence(text = "", playerInput = "") {
  const line = String(text || "").trim();
  const input = String(playerInput || "").toLowerCase();
  const playerAskedMission = /(mission|stadium|route|escort|follow|objective|what now)/i.test(input);
  if (playerAskedMission) return line;
  if (!/(mission|stadium|escort|follow me|route)/i.test(line)) return line;
  return "Keep mission out of my mouth. Bring booze, gossip, or a reckless idea and maybe we talk.";
}

function sonicHasNamedAnchor(text = "") {
  const lower = String(text || "").toLowerCase();
  const names = [...ACTIVE_SONIC_REFERENCE_DATA.women, ...ACTIVE_SONIC_REFERENCE_DATA.men];
  return names.some((name) => lower.includes(String(name).toLowerCase()));
}

function detectSonicPattern(text = "") {
  const lower = String(text || "").toLowerCase();
  if (/i crashed .* into /.test(lower)) return "crash";
  if (/tequila|vodka|coke|pill|hangover|blackout|shot/.test(lower)) return "substance_spiral";
  if (/credit card|maxed|debt|bank|receipt|invoice|auction/.test(lower)) return "financial_disaster";
  if (/lawyer|served me|insurance/.test(lower)) return "legal";
  if (/camera crew|charity gala|satellite|headline/.test(lower)) return "publicity";
  if (/penthouse|limo|suite|vip|chauffeur/.test(lower)) return "luxury";
  if (/voicemail|rebound|hook up|hookup|date|ex/.test(lower)) return "romance";
  return "wild";
}

function detectSonicStem(text = "") {
  const normalized = normalizeForEcho(text);
  if (normalized.startsWith("i crashed")) return "i crashed";
  if (normalized.startsWith("i left a voicemail")) return "i left a voicemail";
  if (normalized.startsWith("i rented a penthouse")) return "i rented a penthouse";
  if (normalized.startsWith("i faked a charity gala")) return "i faked a charity gala";
  if (/ dared me to race /.test(normalized)) return "dared me to race";
  return firstThreeTokenKey(text);
}

function recentIncludes(list = [], value = "", window = 3) {
  const needle = String(value || "").trim();
  if (!needle) return false;
  const recent = Array.isArray(list) ? list.slice(-window) : [];
  return recent.includes(needle);
}

function generateSonicAnecdote(seed = "", styleMemory = null) {
  const women = ACTIVE_SONIC_REFERENCE_DATA.women;
  const men = ACTIVE_SONIC_REFERENCE_DATA.men;
  const womanA = seededPick(`${seed}:womanA`, women);
  const womanB = seededPick(`${seed}:womanB`, women.filter((name) => name !== womanA));
  const manA = seededPick(`${seed}:manA`, men);
  const manB = seededPick(`${seed}:manB`, men.filter((name) => name !== manA));
  const incidents = [
    { category: "crash", line: `I crashed ${manA}'s leased jet into ${manB}'s yacht trying to hook up with ${womanA}.` },
    { category: "publicity", line: `${womanA} dared me to race a limo through studio backlots, and I clipped ${manA}'s catering truck on live satellite feed.` },
    { category: "luxury", line: `I rented a penthouse for ${womanA}, flooded the suite with champagne foam, then billed ${manA}'s producer by accident.` },
    { category: "legal", line: `I left a voicemail for ${womanA}, then ${manA}'s lawyer served me before breakfast and charged me for tone.` },
    { category: "romance", line: `I faked a charity gala to meet ${womanB}, but ${manB} showed up first and stole my exit car.` },
    { category: "substance_spiral", line: `I mixed champagne, cough syrup, and ${womanA}'s vitamin gummies, blacked out, and woke up on ${manA}'s studio lot fountain.` },
    { category: "financial_disaster", line: `I maxed a platinum card buying ${womanA} a crystal fog machine, then sold ${manB}'s golf cart to cover valet.` },
    { category: "publicity", line: `I crashed Mayim Bialik's jet into Joey Lawrence's yacht trying to impress the actress who played Six.` },
    { category: "romance", line: `Mayim Bialik banned me from her jet after I landed it on Joey Lawrence's yacht chasing a Six-level rebound fantasy.` }
  ];
  const punchlines = [
    { id: "networking", text: "My lawyer billed it as networking." },
    { id: "weather", text: "Insurance called it a weather event." },
    { id: "autographs", text: "Security booed me, then asked for autographs." },
    { id: "cleanup", text: "Cleanup took three crews and a priest." },
    { id: "alleged", text: "They called it a scandal. I called it Tuesday." }
  ];
  const recentCategories = Array.isArray(styleMemory?.recentCategories) ? styleMemory.recentCategories.slice(-2) : [];
  const recentPatterns = Array.isArray(styleMemory?.recentPatterns) ? styleMemory.recentPatterns.slice(-2) : [];
  const recentPunchlines = Array.isArray(styleMemory?.recentPunchlines) ? styleMemory.recentPunchlines.slice(-3) : [];
  const recentStems = Array.isArray(styleMemory?.recentStems) ? styleMemory.recentStems.slice(-3) : [];
  const selectedIncident = seededPickWithAvoid(
    `${seed}:body`,
    incidents,
    (entry) => recentCategories.includes(entry?.category)
      || recentPatterns.includes(detectSonicPattern(entry?.line || ""))
      || recentStems.includes(detectSonicStem(entry?.line || ""))
  ) || incidents[0];
  const selectedPunchline = seededPickWithAvoid(
    `${seed}:punch`,
    punchlines,
    (entry) => recentPunchlines.includes(entry?.id)
  ) || punchlines[0];
  return {
    line: `${selectedIncident.line} ${selectedPunchline.text}`.replace(/\s+/g, " ").trim(),
    category: selectedIncident.category,
    pattern: detectSonicPattern(selectedIncident.line),
    punchlineId: selectedPunchline.id,
    stem: detectSonicStem(selectedIncident.line),
    openerKey: firstThreeTokenKey(selectedIncident.line)
  };
}

function enforceSonicAnecdoteMode(text = "", playerInput = "", gameContext = {}, styleMemory = null) {
  const line = String(text || "").trim();
  const input = String(playerInput || "").toLowerCase();
  const askedMission = /(mission|stadium|route|escort|objective|what now|follow)/i.test(input);
  if (askedMission) return { line, meta: null };
  const recentStems = Array.isArray(styleMemory?.recentStems) ? styleMemory.recentStems : [];
  const sonicBragMarkers = /(yacht|jet|lawyer|insurance|rooftop|limo|studio|camera crew|cleanup|autograph)/i;
  if (sonicBragMarkers.test(line) && sonicHasNamedAnchor(line)) {
    const stem = detectSonicStem(line);
    if (!recentIncludes(recentStems, stem, 3)) {
      return {
        line,
        meta: {
          category: "model",
          pattern: detectSonicPattern(line),
          punchlineId: hash(splitSentenceChunks(line)[1] || line).slice(0, 10),
          stem,
          openerKey: firstThreeTokenKey(line)
        }
      };
    }
  }
  const seedBase = `${playerInput}:${gameContext?.time_remaining_sec || 0}:${gameContext?.sonic_drunk_level || 0}`;
  let generated = generateSonicAnecdote(seedBase, styleMemory);
  for (let i = 1; i <= 5; i += 1) {
    if (!recentIncludes(recentStems, generated.stem, 3)) break;
    generated = generateSonicAnecdote(`${seedBase}:alt:${i}`, styleMemory);
  }
  return {
    line: generated.line,
    meta: {
      category: generated.category,
      pattern: generated.pattern,
      punchlineId: generated.punchlineId,
      stem: generated.stem,
      openerKey: generated.openerKey
    }
  };
}

function generateThunderheadUncouth(seed = "", styleMemory = null) {
  const confessions = [
    { id: "deli", line: "I found a roast beef sandwich down here that looked like an 80-year-old prostitute who used to work a deli." },
    { id: "panties", line: "I keep a shrine of stolen tunnel panties in a tackle box and call it romance." },
    { id: "payphone", line: "I licked barbecue sauce off a payphone, got aroused, and wrote your name in axle grease." },
    { id: "mannequin", line: "I dry-humped a perfume mannequin till dawn and she still had more standards than this campus." },
    { id: "thong", line: "I traded raccoon bones for motel cologne and a truck-stop thong, then wore both to confession." },
    { id: "underwear_curse", line: "I found cursed lace underwear in a storm drain, kissed it for luck, and my tongue went numb for an hour." },
    { id: "bus_station", line: "I made out with a bus-station mop bucket behind the tunnel vent and called it foreplay." },
    { id: "locker_ritual", line: "I sniffed stolen gym-locker socks till sunrise and wrote dirty haikus in motor oil." },
    { id: "sorority_trash", line: "I dug through sorority trash for lipstick-stained napkins and framed 'em like family photos." },
    { id: "ashtray_kink", line: "I rubbed motel ashtray dust on my chest and whispered pickup lines to a traffic cone." },
    { id: "vending_affair", line: "I had a toxic affair with a busted vending machine and paid alimony in gum wrappers." },
    { id: "drainpipe_date", line: "I took a drainpipe on a dinner date and fed it cold ravioli with my fingers." },
    { id: "boot_lick", line: "I licked tunnel mud off my own boot and told myself it was artisanal seasoning." },
    { id: "gas_station_perfume", line: "I mixed gas-station perfume with sweat and called it seduction science." },
    { id: "laundry_bin", line: "I climbed into a laundry bin full of stranger underwear and meditated till I got dizzy." },
    { id: "grease_poetry", line: "I wrote dirty sonnets in axle grease to a pothole and begged it not to leave me." },
    { id: "concrete_cuddle", line: "I spooned a warm patch of concrete under the tunnel light and called it intimacy." },
    { id: "bar_stool", line: "I bought a bar stool dinner and undressed emotionally in front of a jukebox." },
    { id: "coin_slot", line: "I flirted with a parking meter coin slot for twenty minutes and left feeling seen." },
    { id: "motel_bible", line: "I hid motel-room Polaroids in a tunnel bible and filed them under spiritual growth." }
  ];
  const pivots = [
    "Bring lace, mascara, or a filthy token if you want Asswine.",
    "No contraband, no bottle, no mercy.",
    "Pay in grime or crawl back to daylight.",
    "Bring me something pervy and precious, then we talk."
  ];
  const laughs = [
    { id: "heh", value: "heh-heh." },
    { id: "khh", value: "khh." },
    { id: "hrrk", value: "hrrk-heh." },
    { id: "none", value: "" }
  ];
  const recentConfessionIds = Array.isArray(styleMemory?.recentConfessionIds) ? styleMemory.recentConfessionIds.slice(-3) : [];
  const recentLaughIds = Array.isArray(styleMemory?.recentLaughIds) ? styleMemory.recentLaughIds.slice(-2) : [];
  const chosenConfession = seededPickWithAvoid(`${seed}:confess`, confessions, (entry) => recentConfessionIds.includes(entry?.id)) || confessions[0];
  const pivot = seededPick(`${seed}:pivot`, pivots);
  const laughPick = seededPickWithAvoid(`${seed}:laugh`, laughs, (entry) => recentLaughIds.includes(entry?.id)) || laughs[0];
  const laugh = laughPick.value;
  return {
    line: `${chosenConfession.line} ${pivot}${laugh ? ` ${laugh}` : ""}`.replace(/\s+/g, " ").trim(),
    category: chosenConfession.id,
    pattern: "perv_confession",
    punchlineId: hash(`${pivot}:${laugh}`).slice(0, 10),
    confessionId: chosenConfession.id,
    laughId: laughPick.id,
    openerKey: firstThreeTokenKey(chosenConfession.line)
  };
}

function enforceThunderheadDialect(text = "", playerInput = "", gameContext = {}, styleMemory = null) {
  const line = String(text || "").trim();
  const cleanPattern = /\b(therefore|however|furthermore|please|kindly|professional|proceed|accordingly|transaction)\b/i;
  const coarsePattern = /\b(ya|ain't|filthy|grime|grease|stank|perv|horny|sleaze|nasty|gutter|trash|panties|thong|hump|aroused|khh|heh-heh|hrrk)\b/i;
  const recentConfessionIds = Array.isArray(styleMemory?.recentConfessionIds) ? styleMemory.recentConfessionIds : [];
  const seed = `${playerInput}:${gameContext?.time_remaining_sec || 0}:${gameContext?.sonic_drunk_level || 0}`;
  if (!line || cleanPattern.test(line) || !coarsePattern.test(line)) {
    let generated = generateThunderheadUncouth(seed, styleMemory);
    for (let i = 1; i <= 5; i += 1) {
      if (!recentIncludes(recentConfessionIds, generated.confessionId, 3)) break;
      generated = generateThunderheadUncouth(`${seed}:alt:${i}`, styleMemory);
    }
    return {
      line: generated.line,
      meta: generated
    };
  }
  let next = line;
  if (!/(heh-heh|khh|hrrk|ehh-heh-heh)\.?$/i.test(line)) {
    const laugh = seededPick(`${seed}:laugh-append`, [" heh-heh.", " khh.", " hrrk-heh."]);
    next = `${line}${laugh}`.trim();
  }
  const modelConfessionId = detectThunderheadConfessionId(next);
  if (recentIncludes(recentConfessionIds, modelConfessionId, 3)) {
    let generated = generateThunderheadUncouth(`${seed}:model-retry`, styleMemory);
    for (let i = 1; i <= 5; i += 1) {
      if (!recentIncludes(recentConfessionIds, generated.confessionId, 3)) break;
      generated = generateThunderheadUncouth(`${seed}:model-retry:${i}`, styleMemory);
    }
    return {
      line: generated.line,
      meta: generated
    };
  }
  return {
    line: next,
    meta: {
      category: "model",
      pattern: "perv_confession",
      punchlineId: hash(splitSentenceChunks(next)[1] || next).slice(0, 10),
      confessionId: modelConfessionId,
      laughId: /(heh-heh)\.?$/i.test(next) ? "heh" : /(khh)\.?$/i.test(next) ? "khh" : /(hrrk)/i.test(next) ? "hrrk" : "none",
      openerKey: firstThreeTokenKey(next)
    }
  };
}

function voiceSeparationGuard(characterId = "", text = "") {
  const id = String(characterId || "").toLowerCase();
  const line = String(text || "");
  if (id === "sonic") {
    const sonicFingerprint = /(yacht|private jet|jet|rooftop|lawyer|insurance|camera crew|cleanup|autograph)/i;
    const namedAnchor = sonicHasNamedAnchor(line);
    return {
      separated: sonicFingerprint.test(line) && namedAnchor,
      reason: sonicFingerprint.test(line) && namedAnchor ? null : "sonic_missing_named_anchor"
    };
  }
  if (id === "thunderhead") {
    const polished = /\b(therefore|however|furthermore|kindly|professional|accordingly|transaction-only|protocol)\b/i.test(line);
    const filthyFingerprint = /\b(heh-heh|khh|hrrk|filthy|grime|sleaze|gutter|perv|horny|stank|nasty|deli|payphone|mannequin|raccoon)\b/i.test(line);
    return {
      separated: !polished && filthyFingerprint,
      reason: !polished && filthyFingerprint ? null : "thunderhead_too_clean_or_generic"
    };
  }
  return { separated: true, reason: null };
}

function shouldDropSecondSentence(first = "", second = "") {
  const trimmed = String(second || "").trim();
  if (!trimmed) return false;
  const weakLead = /^(and|also|anyway|so|plus|besides)\b/i.test(trimmed);
  const humorSignal = /[!?]|(lawyer|insurance|security|cleanup|heh-heh|khh|hrrk|autograph|deli|payphone|raccoon)/i.test(trimmed);
  const lowNovelty = jaccardSimilarity(first, trimmed) > 0.56;
  return (weakLead || trimmed.length < 24 || lowNovelty) && !humorSignal;
}

function compactPunchlineFlow(text = "", characterId = "") {
  const id = String(characterId || "").toLowerCase();
  if (!["sonic", "thunderhead", "knuckles"].includes(id)) return text;
  const chunks = splitSentenceChunks(text);
  if (chunks.length < 2) return text;
  if (shouldDropSecondSentence(chunks[0], chunks[1])) return chunks[0];
  return [chunks[0], chunks[1]].join(" ");
}

function globalEchoGuard(text = "", recentGlobalLines = []) {
  const normalized = normalizeForEcho(text);
  if (!normalized) return { echoed: false, score: 0 };
  let max = 0;
  for (const prior of recentGlobalLines) {
    const score = jaccardSimilarity(normalized, normalizeForEcho(prior));
    if (score > max) max = score;
  }
  return { echoed: max >= 0.7, score: Number(max.toFixed(3)) };
}

function globalEchoGuardForCharacter(characterId = "", text = "", recentGlobalLines = []) {
  const id = String(characterId || "").toLowerCase();
  const raw = globalEchoGuard(text, recentGlobalLines);
  const threshold = id === "sonic" || id === "thunderhead" ? 0.64 : 0.7;
  return {
    echoed: raw.score >= threshold,
    score: raw.score,
    threshold
  };
}

function openerRepeatGuard(text = "", recentOpenerKeys = []) {
  const key = firstThreeTokenKey(text);
  if (!key) return { repeated: false, key };
  const recent = Array.isArray(recentOpenerKeys) ? recentOpenerKeys.slice(-3) : [];
  return { repeated: recent.includes(key), key };
}

function detectThunderheadConfessionId(text = "") {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("roast beef sandwich")) return "deli";
  if (lower.includes("tunnel panties")) return "panties";
  if (lower.includes("barbecue sauce off a payphone")) return "payphone";
  if (lower.includes("perfume mannequin")) return "mannequin";
  if (lower.includes("truck-stop thong")) return "thong";
  if (lower.includes("cursed lace underwear")) return "underwear_curse";
  if (lower.includes("bus-station mop bucket")) return "bus_station";
  if (lower.includes("gym-locker socks")) return "locker_ritual";
  if (lower.includes("sorority trash")) return "sorority_trash";
  if (lower.includes("ashtray dust")) return "ashtray_kink";
  if (lower.includes("vending machine")) return "vending_affair";
  if (lower.includes("drainpipe")) return "drainpipe_date";
  if (lower.includes("tunnel mud")) return "boot_lick";
  if (lower.includes("gas-station perfume")) return "gas_station_perfume";
  if (lower.includes("laundry bin")) return "laundry_bin";
  if (lower.includes("dirty sonnets")) return "grease_poetry";
  if (lower.includes("warm patch of concrete")) return "concrete_cuddle";
  if (lower.includes("bar stool")) return "bar_stool";
  if (lower.includes("parking meter coin slot")) return "coin_slot";
  if (lower.includes("motel-room polaroids")) return "motel_bible";
  return hash(lower).slice(0, 8);
}

function inferStyleMeta(characterId = "", text = "", context = {}, existing = null) {
  const id = String(characterId || "").toLowerCase();
  const line = String(text || "").trim();
  const second = splitSentenceChunks(line)[1] || "";
  if (!line) return existing || null;
  if (id === "sonic") {
    const category = /jet|yacht|crash/i.test(line)
      ? "crash"
      : /lawyer|served|insurance/i.test(line)
        ? "legal"
        : /camera|crew|gala|satellite/i.test(line)
          ? "publicity"
          : /penthouse|suite|chauffeur|vip/i.test(line)
            ? "luxury"
            : /hook up|hookup|rebound|voicemail|date/i.test(line)
              ? "romance"
              : /tequila|vodka|pill|hangover|blackout|shot/i.test(line)
                ? "substance_spiral"
                : /credit card|maxed|debt|receipt|invoice|bank/i.test(line)
                  ? "financial_disaster"
                  : "wild";
    const pattern = detectSonicPattern(line);
    const punchline = hash(second || line).slice(0, 10);
    const stem = detectSonicStem(line);
    const openerKey = firstThreeTokenKey(line);
    return {
      lastCategory: category,
      lastPattern: pattern,
      lastPunchline: punchline,
      recentCategories: pushRecent(existing?.recentCategories, category, 4),
      recentPatterns: pushRecent(existing?.recentPatterns, pattern, 4),
      recentPunchlines: pushRecent(existing?.recentPunchlines, punchline, 5),
      recentStems: pushRecent(existing?.recentStems, stem, 4),
      recentOpenerKeys: pushRecent(existing?.recentOpenerKeys, openerKey, 5)
    };
  }
  if (id === "thunderhead") {
    const category = /panties|thong|hump|aroused|underwear|foreplay/i.test(line)
      ? "sexual"
      : /deli|payphone|motel|raccoon|mannequin|trash|grease|mud/i.test(line)
        ? "grime"
        : "perv_misc";
    const punchline = hash(second || line).slice(0, 10);
    const laughId = /(heh-heh)\.?$/i.test(line) ? "heh" : /(khh)\.?$/i.test(line) ? "khh" : /(hrrk)/i.test(line) ? "hrrk" : "none";
    const confessionId = detectThunderheadConfessionId(line);
    const openerKey = firstThreeTokenKey(line);
    return {
      lastCategory: category,
      lastPattern: "perv_confession",
      lastPunchline: punchline,
      recentCategories: pushRecent(existing?.recentCategories, category, 5),
      recentPatterns: pushRecent(existing?.recentPatterns, "perv_confession", 4),
      recentPunchlines: pushRecent(existing?.recentPunchlines, punchline, 5),
      recentConfessionIds: pushRecent(existing?.recentConfessionIds, confessionId, 5),
      recentLaughIds: pushRecent(existing?.recentLaughIds, laughId, 4),
      recentOpenerKeys: pushRecent(existing?.recentOpenerKeys, openerKey, 5)
    };
  }
  const genericCategory = normalizeForEcho(line).split(" ").slice(0, 2).join("_");
  const genericPattern = normalizeForEcho(line).split(" ").slice(0, 3).join("_");
  const genericPunchline = hash(second || line).slice(0, 10);
  const openerKey = firstThreeTokenKey(line);
  return {
    lastCategory: genericCategory,
    lastPattern: genericPattern,
    lastPunchline: genericPunchline,
    recentCategories: pushRecent(existing?.recentCategories, genericCategory, 4),
    recentPatterns: pushRecent(existing?.recentPatterns, genericPattern, 4),
    recentPunchlines: pushRecent(existing?.recentPunchlines, genericPunchline, 4),
    recentOpenerKeys: pushRecent(existing?.recentOpenerKeys, openerKey, 4)
  };
}

function enforceCharacterPostRules(characterId = "", text = "", context = {}) {
  const id = String(characterId || "").toLowerCase();
  const playerInput = context?.playerInput || "";
  const gameContext = context?.gameContext || {};
  const styleMemory = context?.styleMemory || null;
  let line = String(text || "").trim();
  if (id === "knuckles") line = enforceKnucklesCadence(line, `${playerInput}:${gameContext.time_remaining_sec || 0}`);
  if (id === "frat_boys") {
    line = enforceFratSonicSpecificity(line, playerInput, gameContext);
    line = enforceFratNoFlatYesNo(line);
  }
  if (id === "sonic") {
    line = enforceSonicMissionSilence(line, playerInput);
    line = enforceSonicAnecdoteMode(line, playerInput, gameContext, styleMemory)?.line || line;
  }
  if (id === "thunderhead") line = enforceThunderheadDialect(line, playerInput, gameContext, styleMemory)?.line || line;
  line = pruneGenericOpener(line);
  line = compactPunchlineFlow(line, id);
  const maxSentences = Number(gameContext?.max_sentences_per_reply || config.maxSentencesPerReply || 2);
  const maxChars = Number(gameContext?.max_bubble_length_chars || config.maxBubbleLengthChars || 190);
  if (id === "sonic" || id === "thunderhead") {
    return fitBubbleLineWithLimit(sanitizeNpcText(line), { maxSentences: 1, maxChars });
  }
  if (id === "knuckles") {
    return fitBubbleLineWithLimit(sanitizeNpcText(line), { maxSentences: 1, maxChars });
  }
  return fitBubbleLineWithLimit(sanitizeNpcText(line), { maxSentences, maxChars });
}

const FORBIDDEN_CLICHE_PATTERNS = {
  sonic: [
    /one drink,\s*one rumor,\s*one bad decision/i,
    /bring chaos,\s*gossip,\s*or cash-burn energy/i,
    /no freebies\.\s*bring chaos/i
  ],
  frat_boys: [
    /bring a stunt,\s*a rumor,\s*or a challenge/i,
    /earn your lane/i,
    /frat vibe/i
  ],
  thunderhead: [
    /trade me the right contraband\. no freebies\./i,
    /no deal without the right move/i,
    /gross, but true/i
  ]
};

function normalizeLine(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text = "") {
  return new Set(normalizeLine(text).split(" ").filter((token) => token.length > 2));
}

function jaccardSimilarity(a = "", b = "") {
  const as = tokenSet(a);
  const bs = tokenSet(b);
  if (as.size === 0 || bs.size === 0) return 0;
  let intersection = 0;
  as.forEach((token) => {
    if (bs.has(token)) intersection += 1;
  });
  const union = as.size + bs.size - intersection;
  if (union <= 0) return 0;
  return intersection / union;
}

function repetitionGuardCheck(text = "", recentNpcTurns = []) {
  const line = normalizeLine(text);
  if (!line) return { repetitive: false, score: 0 };
  const recent = (recentNpcTurns || []).slice(-2).map((entry) => normalizeLine(entry));
  let maxScore = 0;
  for (const prior of recent) {
    if (!prior) continue;
    const score = Math.max(
      jaccardSimilarity(line, prior),
      line === prior ? 1 : 0
    );
    if (score > maxScore) maxScore = score;
  }
  return { repetitive: maxScore >= 0.74, score: Number(maxScore.toFixed(3)) };
}

function noveltyGuardCheck(text = "", recentNpcTurns = []) {
  const line = normalizeLine(text);
  if (!line) return { stale: false, opener_repeat: false, overlap_score: 0 };
  const tokens = line.split(" ").filter(Boolean);
  const opener = tokens.slice(0, 4).join(" ");
  const recent = (recentNpcTurns || []).slice(-2).map((entry) => normalizeLine(entry)).filter(Boolean);
  const openerRepeat = recent.some((prior) => prior.split(" ").slice(0, 4).join(" ") === opener);
  let maxOverlap = 0;
  for (const prior of recent) {
    const overlap = jaccardSimilarity(line, prior);
    if (overlap > maxOverlap) maxOverlap = overlap;
  }
  const overlapScore = Number(maxOverlap.toFixed(3));
  return {
    stale: openerRepeat || overlapScore >= 0.66,
    opener_repeat: openerRepeat,
    overlap_score: overlapScore
  };
}

function clicheGuardCheck(characterId = "", text = "") {
  const patterns = FORBIDDEN_CLICHE_PATTERNS[String(characterId || "").toLowerCase()] || [];
  const hit = patterns.some((rx) => rx.test(String(text || "")));
  return { blocked: hit };
}

function thunderheadBlandGuard(characterId = "", text = "") {
  const id = String(characterId || "").toLowerCase();
  if (id !== "thunderhead") return { bland: false };
  const lower = String(text || "").toLowerCase();
  const hasTrade = /(trade|deal|swap|contraband|asswine|item)/i.test(lower);
  const hasDegenerateFlavor = /(filthy|gross|weird|perv|bad decision|sleazy|degenerate|horny|sketchy|creepy|shame)/i.test(lower);
  return { bland: hasTrade && !hasDegenerateFlavor };
}

function isCriticalIntent(intent = "") {
  const value = String(intent || "").toUpperCase();
  return /(WELCOME|MISSION|HINT|SAFETY|THREAT|ESCORT|STADIUM|HANDOFF|DISMISSAL)/.test(value);
}

function normalizeTokens(text = "") {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function topRepeatedNgrams(lines = [], size = 2, topN = 3) {
  const counts = new Map();
  for (const line of lines) {
    const tokens = normalizeTokens(line);
    if (tokens.length < size) continue;
    for (let i = 0; i <= tokens.length - size; i += 1) {
      const ngram = tokens.slice(i, i + size).join(" ");
      counts.set(ngram, (counts.get(ngram) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([ngram, count]) => ({ ngram, count }));
}

export class DialogueOrchestrator {
  constructor() {
    this.state = {
      cache: new Map(),
      inflightByKey: new Map(),
      cooldownUntil: 0,
      quotaFailures: 0,
      lastLlmCallAt: 0,
      logWriteErrors: 0,
      lastLogWriteErrorAt: null,
      styleMemoryByNpc: new Map(),
      recentGlobalNpcLines: []
    };
    this.contextBuilder = new ContextBuilder();
    this.memoryService = new MemoryService();
    this.promptBuilder = new PromptBuilder();
    this.safetyService = new SafetyService();
    this.evaluator = new Evaluator();
    this.fallbackService = new FallbackService();

    this.timedFetch = async (url, options = {}) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    };

    this.modelRouter = new ModelRouter({
      openaiAdapter: new OpenAIAdapter(this.timedFetch),
      geminiAdapter: new GeminiAdapter(this.timedFetch)
    });
  }

  getStyleMemory(characterId = "") {
    return this.state.styleMemoryByNpc.get(String(characterId || "").toLowerCase()) || null;
  }

  setStyleMemory(characterId = "", styleMeta = null) {
    const id = String(characterId || "").toLowerCase();
    if (!id || !styleMeta) return;
    this.state.styleMemoryByNpc.set(id, styleMeta);
  }

  pushGlobalNpcLine(line = "") {
    const trimmed = String(line || "").trim();
    if (!trimmed) return;
    this.state.recentGlobalNpcLines.push(trimmed);
    if (this.state.recentGlobalNpcLines.length > 30) {
      this.state.recentGlobalNpcLines = this.state.recentGlobalNpcLines.slice(-30);
    }
  }

  async init() {
    await fs.mkdir(config.logsDir, { recursive: true });
    await fs.mkdir(config.trainingDir, { recursive: true });
    await fs.mkdir(config.personaDir, { recursive: true });
    await loadSonicReferenceData();
    await this.memoryService.init();
  }

  buildCacheKey(context) {
    const recent = (context.gameContext?.recent_turns || [])
      .slice(-2)
      .map((turn) => `${turn?.speaker || ""}:${String(turn?.text || "").slice(0, 48)}`)
      .join("|");
    return hash(JSON.stringify({
      c: context.characterId,
      i: context.intent,
      l: context.gameContext?.location || "",
      d: context.gameContext?.sonic_drunk_level || 0,
      e: Number(context.gameContext?.npc_encounter_count || 0),
      t: String(context.gameContext?.test_case_id || ""),
      p: String(context.playerInput || "").toLowerCase().trim(),
      r: hash(recent)
    }));
  }

  getCached(key) {
    const item = this.state.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.state.cache.delete(key);
      return null;
    }
    return item.value;
  }

  setCached(key, value) {
    this.state.cache.set(key, {
      value,
      expiresAt: Date.now() + config.cacheTtlMs
    });
  }

  async appendLog(filePath, payload, label) {
    try {
      await appendJsonl(filePath, payload);
    } catch (err) {
      this.state.logWriteErrors += 1;
      this.state.lastLogWriteErrorAt = new Date().toISOString();
      if (config.debug) {
        console.warn(`Log write failed for ${label}:`, err);
      }
    }
  }

  async execute(body = {}) {
    const startedAt = Date.now();
    const context = this.contextBuilder.build(body);
    const styleMemory = this.getStyleMemory(context.characterId);
    const contextWithStyle = { ...context, styleMemory };
    const requestedExamples = isCriticalIntent(context.intent)
      ? config.retrievalExamplesCritical
      : config.retrievalExamplesDefault;
    const examples = this.memoryService.retrieveExamples(
      context.characterId,
      context.gameContext,
      context.playerInput,
      requestedExamples
    );
    const cacheKey = this.buildCacheKey(context);
    const requestId = hash(`${cacheKey}:${startedAt}`);
    const logBase = {
      ts: new Date().toISOString(),
      request_id: requestId,
      character_id: context.characterId,
      intent: context.intent,
      location: context.gameContext?.location || "",
      player_input: context.playerInput || ""
    };
    const latencyMs = () => Math.max(0, Date.now() - startedAt);

    const inputSafety = this.safetyService.checkInput(context.playerInput || "");
    if (!inputSafety.ok) {
      const payload = {
        npc_text: "Nope. I am not running with that request. Try another angle.",
        intent: "SAFETY_ABORT",
        time_cost_seconds: 0,
        suggested_state_effects: { safety_abort: true },
        source: "fallback",
        latency_ms: latencyMs()
      };
      await this.appendLog(config.interactionLogPath, { ...logBase, source: "safety_abort", latency_ms: latencyMs() }, "interaction:safety_abort");
      return payload;
    }

    const cached = this.getCached(cacheKey);
    if (cached) {
      await this.appendLog(config.interactionLogPath, { ...logBase, source: "cache", latency_ms: latencyMs() }, "interaction:cache");
      this.pushGlobalNpcLine(cached.npc_text || "");
      return {
        ...cached,
        npc_text: enforceCharacterPostRules(context.characterId, cached.npc_text || "", contextWithStyle),
        latency_ms: latencyMs()
      };
    }

    const inflight = this.state.inflightByKey.get(cacheKey);
    if (inflight) {
      const reused = await inflight;
      await this.appendLog(config.interactionLogPath, {
        ...logBase,
        source: "cache",
        provider: reused?.provider || null,
        style_score: reused?.style_score ?? null,
        repetition_guard: Boolean(reused?.repetition_guard),
        repetition_score: Number(reused?.repetition_score || 0),
        novelty_guard: Boolean(reused?.novelty_guard),
        voice_guard_fail: Boolean(reused?.voice_guard_fail),
        npc_text: String(reused?.npc_text || "").slice(0, 280),
        latency_ms: latencyMs()
      }, "interaction:inflight_reuse");
      return {
        ...reused,
        npc_text: enforceCharacterPostRules(context.characterId, reused.npc_text || "", contextWithStyle),
        latency_ms: latencyMs()
      };
    }

    if (Date.now() < this.state.cooldownUntil) {
      const payload = this.fallbackService.build(context, examples, "cooldown");
      await this.appendLog(config.interactionLogPath, { ...logBase, source: "cooldown", latency_ms: latencyMs() }, "interaction:cooldown");
      return {
        ...payload,
        npc_text: enforceCharacterPostRules(context.characterId, payload.npc_text || "", contextWithStyle),
        latency_ms: latencyMs()
      };
    }

    const waitMs = Math.max(0, config.throttleMs - (Date.now() - this.state.lastLlmCallAt));
    if (waitMs > 0) await sleep(waitMs);

    const executePromise = (async () => {
      const prompt = this.promptBuilder.build(context, examples);
      const modelResult = await this.modelRouter.complete(prompt, {
        fastPath: !isCriticalIntent(context.intent),
        criticalPath: isCriticalIntent(context.intent)
      });
      this.state.lastLlmCallAt = Date.now();
      const parsed = extractJsonFromText(modelResult.text) || {};
      const firstRaw = fitBubbleLineWithLimit(sanitizeNpcText(parsed.npc_text || modelResult.text || ""), {
        maxSentences: Number(context?.gameContext?.max_sentences_per_reply || config.maxSentencesPerReply || 2),
        maxChars: Number(context?.gameContext?.max_bubble_length_chars || config.maxBubbleLengthChars || 190)
      });
      const firstText = enforceCharacterPostRules(context.characterId, firstRaw, contextWithStyle);
      const outputSafety = this.safetyService.checkOutput(firstText);
      const repetitionCheck = repetitionGuardCheck(firstText, context.recentNpcTurns || []);
      const noveltyCheck = noveltyGuardCheck(firstText, context.recentNpcTurns || []);
      const globalEcho = globalEchoGuardForCharacter(context.characterId, firstText, this.state.recentGlobalNpcLines);
      const openerRepeat = openerRepeatGuard(firstText, styleMemory?.recentOpenerKeys || []);
      const clicheCheck = clicheGuardCheck(context.characterId, firstText);
      const thunderheadBland = thunderheadBlandGuard(context.characterId, firstText);
      const voiceSeparation = voiceSeparationGuard(context.characterId, firstText);
      const firstEval = this.evaluator.evaluate(firstText, {
        ...contextWithStyle,
        styleMeta: {
          globalEcho: globalEcho.echoed,
          openerRepeat: openerRepeat.repeated,
          styleMemory
        }
      }, config.styleThreshold);

      let response = {
        npc_text: firstText,
        intent: parsed.intent || context.intent,
        time_cost_seconds: Number(parsed.time_cost_seconds || 0),
        suggested_state_effects: parsed.suggested_state_effects || {},
        source: "llm",
        style_score: firstEval.compositeScore,
        provider: modelResult.provider,
        repetition_guard: repetitionCheck.repetitive,
        repetition_score: repetitionCheck.score,
        novelty_guard: noveltyCheck.stale,
        voice_guard_fail: !voiceSeparation.separated
      };

      const severeStyleMiss = firstEval.compositeScore < Math.max(40, config.styleThreshold - 14);
      const shouldForceRewrite = repetitionCheck.repetitive
        || noveltyCheck.stale
        || globalEcho.echoed
        || openerRepeat.repeated
        || clicheCheck.blocked
        || thunderheadBland.bland
        || !voiceSeparation.separated;
      if (!outputSafety.ok || severeStyleMiss || shouldForceRewrite) {
        try {
          const guardReasons = [];
          if (repetitionCheck.repetitive) guardReasons.push(`repetition_score=${repetitionCheck.score}`);
          if (noveltyCheck.stale) guardReasons.push(`novelty_overlap=${noveltyCheck.overlap_score}`);
          if (clicheCheck.blocked) guardReasons.push("forbidden_cliche");
          if (thunderheadBland.bland) guardReasons.push("thunderhead_generic_trade_line");
          if (globalEcho.echoed) guardReasons.push(`global_echo_score=${globalEcho.score}`);
          if (openerRepeat.repeated) guardReasons.push(`opener_repeat=${openerRepeat.key}`);
          if (!voiceSeparation.separated && voiceSeparation.reason) guardReasons.push(voiceSeparation.reason);
          const rewritePrompt = this.promptBuilder.build(
            context,
            examples,
            `Rewrite for stronger character voice and cleaner in-world response. Fix: ${(firstEval.reasons || []).join(", ")}${guardReasons.length ? `; Guard: ${guardReasons.join(", ")}` : ""}. Use a new angle and no reused phrasing from recent replies.`
          );
          const secondResult = await this.modelRouter.complete(rewritePrompt, {
            fastPath: false,
            criticalPath: true
          });
          this.state.lastLlmCallAt = Date.now();
          const secondParsed = extractJsonFromText(secondResult.text) || {};
          const secondRaw = fitBubbleLineWithLimit(sanitizeNpcText(secondParsed.npc_text || secondResult.text || ""), {
            maxSentences: Number(context?.gameContext?.max_sentences_per_reply || config.maxSentencesPerReply || 2),
            maxChars: Number(context?.gameContext?.max_bubble_length_chars || config.maxBubbleLengthChars || 190)
          });
          const secondText = enforceCharacterPostRules(context.characterId, secondRaw, contextWithStyle);
          const secondSafety = this.safetyService.checkOutput(secondText);
          const secondRepetition = repetitionGuardCheck(secondText, context.recentNpcTurns || []);
          const secondNovelty = noveltyGuardCheck(secondText, context.recentNpcTurns || []);
          const secondEcho = globalEchoGuardForCharacter(context.characterId, secondText, this.state.recentGlobalNpcLines);
          const secondOpenerRepeat = openerRepeatGuard(secondText, styleMemory?.recentOpenerKeys || []);
          const secondCliche = clicheGuardCheck(context.characterId, secondText);
          const secondVoiceSeparation = voiceSeparationGuard(context.characterId, secondText);
          const secondEval = this.evaluator.evaluate(secondText, {
            ...contextWithStyle,
            styleMeta: {
              globalEcho: secondEcho.echoed,
              openerRepeat: secondOpenerRepeat.repeated,
              styleMemory
            }
          }, config.styleThreshold);
          if (secondSafety.ok && !secondRepetition.repetitive && !secondNovelty.stale && !secondEcho.echoed && !secondOpenerRepeat.repeated && !secondCliche.blocked && secondVoiceSeparation.separated && secondEval.compositeScore >= firstEval.compositeScore) {
            response = {
              npc_text: secondText,
              intent: secondParsed.intent || context.intent,
              time_cost_seconds: Number(secondParsed.time_cost_seconds || 0),
              suggested_state_effects: secondParsed.suggested_state_effects || {},
              source: "llm_regen",
              style_score: secondEval.compositeScore,
              provider: secondResult.provider,
              repetition_guard: secondRepetition.repetitive,
              repetition_score: secondRepetition.score,
              novelty_guard: secondNovelty.stale,
              voice_guard_fail: !secondVoiceSeparation.separated
            };
          }
        } catch {
          // Keep first response.
        }
      }

      this.state.quotaFailures = 0;
      this.state.cooldownUntil = 0;
      this.setStyleMemory(context.characterId, inferStyleMeta(context.characterId, response.npc_text, contextWithStyle, styleMemory));
      this.pushGlobalNpcLine(response.npc_text || "");
      this.setCached(cacheKey, response);
      await this.appendLog(config.interactionLogPath, {
        ...logBase,
        source: response.source,
        provider: response.provider,
        style_score: response.style_score,
        repetition_guard: Boolean(response.repetition_guard),
        repetition_score: Number(response.repetition_score || 0),
        novelty_guard: Boolean(response.novelty_guard),
        voice_guard_fail: Boolean(response.voice_guard_fail),
        npc_text: String(response.npc_text || "").slice(0, 280),
        latency_ms: latencyMs()
      }, "interaction:response");
      if (response.style_score < config.styleThreshold) {
        await this.appendLog(config.correctionLogPath, {
          ...logBase,
          model_output: response.npc_text,
          style_score: response.style_score,
          style_reasons: ["below_threshold"],
          recommended_fallback: this.fallbackService.build(context, examples, "quality").npc_text
        }, "correction:below_threshold");
      }
      return { ...response, latency_ms: latencyMs() };
    })();
    this.state.inflightByKey.set(cacheKey, executePromise);
    try {
      const result = await executePromise;
      return result;
    } catch (err) {
      const reason = this.modelRouter.normalizeErrorReason(err);
      if (Number(err?.status || 0) === 429) {
        this.state.quotaFailures += 1;
        const backoffMs = Math.min(config.maxBackoffMs, config.throttleMs * (2 ** (this.state.quotaFailures - 1)));
        this.state.cooldownUntil = Date.now() + backoffMs;
      }
      const fallback = this.fallbackService.build(context, examples, reason);
      await this.appendLog(config.interactionLogPath, {
        ...logBase,
        source: "fallback",
        reason,
        npc_text: String(fallback.npc_text || "").slice(0, 280),
        latency_ms: latencyMs()
      }, "interaction:fallback");
      await this.appendLog(config.correctionLogPath, {
        ...logBase,
        model_output: null,
        style_score: null,
        style_reasons: [reason],
        recommended_fallback: fallback.npc_text
      }, "correction:fallback");
      const finalNpcText = enforceCharacterPostRules(context.characterId, fallback.npc_text || "", contextWithStyle);
      this.setStyleMemory(
        context.characterId,
        inferStyleMeta(context.characterId, finalNpcText, contextWithStyle, styleMemory)
      );
      this.pushGlobalNpcLine(finalNpcText || "");
      return {
        ...fallback,
        npc_text: finalNpcText,
        latency_ms: latencyMs()
      };
    } finally {
      this.state.inflightByKey.delete(cacheKey);
    }
  }

  health() {
    const memoryStats = this.memoryService.getStats();
    const cooldownSeconds = this.state.cooldownUntil > Date.now()
      ? Math.ceil((this.state.cooldownUntil - Date.now()) / 1000)
      : 0;
    return {
      ok: true,
      pipeline_version: config.llmPipelineVersion,
      primary_provider: config.primaryProvider,
      openai_configured: Boolean(config.openaiApiKey),
      gemini_configured: Boolean(config.geminiApiKey),
      retrieval_ready: memoryStats.retrievalReady,
      retrieval_entries: memoryStats.retrievalEntries,
      cache_size: this.state.cache.size,
      inflight_requests: this.state.inflightByKey.size,
      log_write_errors: this.state.logWriteErrors,
      last_log_write_error_at: this.state.lastLogWriteErrorAt,
      cooldown_seconds: cooldownSeconds,
      throttle_ms: config.throttleMs,
      fetch_timeout_ms: config.fetchTimeoutMs,
      style_threshold: config.styleThreshold
    };
  }

  clearCharacterCache(characterId = "") {
    const target = String(characterId || "").toLowerCase();
    if (!target) return 0;
    let cleared = 0;
    for (const key of this.state.cache.keys()) {
      if (key.includes(`"${target}"`)) {
        this.state.cache.delete(key);
        cleared += 1;
      }
    }
    return cleared;
  }

  async quality(limit = 2000) {
    const interactions = await readJsonl(config.interactionLogPath, limit);
    const corrections = await readJsonl(config.correctionLogPath, limit);
    const total = interactions.length;
    const sourceCounts = interactions.reduce((acc, row) => {
      const key = row?.source || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const latencyValues = interactions
      .map((row) => Number(row?.latency_ms))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const latencyBySource = interactions.reduce((acc, row) => {
      const src = String(row?.source || "unknown");
      const ms = Number(row?.latency_ms);
      if (!Number.isFinite(ms) || ms < 0) return acc;
      if (!acc[src]) acc[src] = [];
      acc[src].push(ms);
      return acc;
    }, {});
    const sourceLatencyMs = Object.keys(latencyBySource).reduce((acc, source) => {
      const values = latencyBySource[source];
      acc[source] = {
        samples: values.length,
        avg: values.length ? Number((values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(2)) : null,
        p50: percentile(values, 50),
        p95: percentile(values, 95)
      };
      return acc;
    }, {});
    const perCharacter = interactions.reduce((acc, row) => {
      const id = String(row?.character_id || "unknown");
      if (!acc[id]) {
        acc[id] = {
          rows: 0,
          source_counts: {},
          repetition_hits: 0,
          novelty_hits: 0,
          voice_guard_hits: 0,
          lines: []
        };
      }
      acc[id].rows += 1;
      const src = String(row?.source || "unknown");
      acc[id].source_counts[src] = (acc[id].source_counts[src] || 0) + 1;
      if (row?.repetition_guard) acc[id].repetition_hits += 1;
      if (row?.novelty_guard) acc[id].novelty_hits += 1;
      if (row?.voice_guard_fail) acc[id].voice_guard_hits += 1;
      if (typeof row?.npc_text === "string" && row.npc_text.trim()) acc[id].lines.push(row.npc_text.trim());
      return acc;
    }, {});
    Object.keys(perCharacter).forEach((id) => {
      const rows = perCharacter[id].rows || 0;
      const fallbackRows = (perCharacter[id].source_counts.fallback || 0) + (perCharacter[id].source_counts.cooldown || 0);
      perCharacter[id].fallback_rate_pct = rows > 0 ? Number(((fallbackRows / rows) * 100).toFixed(2)) : 0;
      perCharacter[id].repetition_rate_pct = rows > 0 ? Number(((perCharacter[id].repetition_hits / rows) * 100).toFixed(2)) : 0;
      perCharacter[id].novelty_pressure_rate_pct = rows > 0 ? Number(((perCharacter[id].novelty_hits / rows) * 100).toFixed(2)) : 0;
      perCharacter[id].voice_separation_fail_rate_pct = rows > 0 ? Number(((perCharacter[id].voice_guard_hits / rows) * 100).toFixed(2)) : 0;
      perCharacter[id].top_repeated_bigrams = topRepeatedNgrams(perCharacter[id].lines, 2, 3);
      perCharacter[id].top_repeated_trigrams = topRepeatedNgrams(perCharacter[id].lines, 3, 3);
      delete perCharacter[id].lines;
    });
    const pct = (n) => (total > 0 ? Number(((n / total) * 100).toFixed(2)) : 0);
    return {
      ok: true,
      generated_at: new Date().toISOString(),
      window_rows: total,
      source_counts: sourceCounts,
      rates_pct: {
        llm_direct: pct(sourceCounts.llm || 0),
        llm_regen: pct(sourceCounts.llm_regen || 0),
        cache: pct(sourceCounts.cache || 0),
        fallback: pct(sourceCounts.fallback || 0),
        cooldown: pct(sourceCounts.cooldown || 0)
      },
      latency_ms: {
        samples: latencyValues.length,
        avg: latencyValues.length
          ? Number((latencyValues.reduce((sum, n) => sum + n, 0) / latencyValues.length).toFixed(2))
          : null,
        p50: percentile(latencyValues, 50),
        p95: percentile(latencyValues, 95)
      },
      source_latency_ms: sourceLatencyMs,
      correction_dataset_rows: corrections.length,
      per_character: perCharacter
    };
  }
}
