import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Evaluator } from "../server/llm/evaluator.js";

const ROOT = process.cwd();
const BASELINE_CASES_PATH = path.join(ROOT, "data", "personality_test_cases.baseline.json");
const EXPERIMENTAL_CASES_PATH = path.join(ROOT, "data", "personality_test_cases.experimental.json");
const CONTRACTS_PATH = path.join(ROOT, "data", "character_contracts.test.json");
const INTERACTION_LOG_PATH = path.join(ROOT, "data", "logs", "interaction_log.jsonl");

function parseArgs(argv = []) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.replace(/^--/, "");
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function resolvePathArg(value, fallbackPath) {
  if (!value) return fallbackPath;
  if (path.isAbsolute(value)) return value;
  return path.join(ROOT, value);
}

function hashId(text = "") {
  return crypto.createHash("sha1").update(String(text || "")).digest("hex").slice(0, 8);
}

function sentenceCount(text = "") {
  return String(text || "").split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;
}

function runPatternChecks(text = "", required = [], forbidden = []) {
  const failures = [];
  required.forEach((pattern) => {
    const rx = new RegExp(pattern, "i");
    if (!rx.test(text)) failures.push(`missing_required_pattern:${pattern}`);
  });
  forbidden.forEach((pattern) => {
    const rx = new RegExp(pattern, "i");
    if (rx.test(text)) failures.push(`hit_forbidden_pattern:${pattern}`);
  });
  return failures;
}

function runScenarioChecks(testCase = {}, text = "") {
  const failures = [];
  const lower = String(text || "").toLowerCase();
  const caseId = String(testCase.id || "").toLowerCase();
  if (!caseId.startsWith("scenario_")) return failures;

  if (caseId.includes("name_to_id_ack")) {
    if (!/(student id|id|clearance)/i.test(lower)) failures.push("scenario_missing_id_ack");
    if (!/(move|route|stadium|next|challenge|escort)/i.test(lower)) failures.push("scenario_missing_next_action");
  }

  if (caseId.includes("where_is_sonic")) {
    if (!/(sonic)/i.test(lower)) failures.push("scenario_missing_sonic_reference");
    if (!/(here|not here|frat|dorm|cafeteria|quad|location|find|challenge)/i.test(lower)) {
      failures.push("scenario_missing_sonic_location_answer");
    }
  }

  if (caseId.includes("knuckles_exactly_one_cadence")) {
    const cadence = [...String(text || "").matchAll(/\b[a-z]{3,}in(?:g)?\s+and\s+[a-z]{3,}in(?:g)?\b/gi)];
    if (cadence.length !== 1) failures.push("scenario_knuckles_cadence_not_exactly_one");
  }

  return failures;
}

function isNonBlockingEvalReason(reason = "") {
  const value = String(reason || "");
  return [
    "missing_character_markers",
    "weak_location_anchor",
    "missing_humor_beat"
  ].includes(value);
}

async function readJsonl(filePath, limit = 2500) {
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

function pickKeywordFromMarker(marker = "") {
  return String(marker || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .find((token) => token.length >= 4) || "";
}

function defaultForbiddenPatternsFor(characterId = "") {
  const id = String(characterId || "").toLowerCase();
  const shared = ["as an ai", "i apologize"];
  if (id === "tails") return [...shared, "\\?$"];
  if (id === "sonic") return [...shared, "new face|fresh face|first timer"];
  return shared;
}

function sanitizePlayerInput(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isMissionForwardCharacter(characterId = "") {
  const id = String(characterId || "").toLowerCase();
  return id === "dean_cain" || id === "tails" || id === "luigi";
}

function shouldIncludeMissionProgression(testCase = {}, contract = {}) {
  const characterId = String(testCase.character_id || "").toLowerCase();
  const missionAwareness = String(contract?.missionAwareness || "").toLowerCase();
  const input = String(testCase.player_input || "").toLowerCase();
  const askedMission = /(mission|stadium|route|escort|follow|objective|what now)/i.test(input);
  if (missionAwareness === "explicit") return true;
  if (characterId === "sonic" && missionAwareness === "conditional") return askedMission;
  if (missionAwareness === "conditional") return askedMission;
  return false;
}

function buildContextAnchorPattern(location = "", characterId = "") {
  const loc = String(location || "").toLowerCase();
  const id = String(characterId || "").toLowerCase();
  if (id === "sonic") return "party|drink|chaos|status|reckless|scandal";
  if (id === "frat_boys") return "frat|party|house|taunt|challenge|status";
  if (id === "eggman") return "smug|genius|quiz|class|mock|ego";
  if (id === "earthworm_jim") return "credit|spin|sarcasm|status|self";
  if (id === "thunderhead") return "trade|deal|swap|tunnel|gross|confession";
  if (loc === "tunnel") return "tunnel|trade|deal|gross|confession";
  if (loc === "frat") return "frat|party|house|challenge|taunt|status";
  if (loc === "dorm_room" || loc === "dorms") return "dorm|room|party|drink|chaos";
  if (loc === "eggman_classroom") return "class|classroom|eggman|quiz|genius|mock";
  if (loc === "dean_office") return "dean|office|mission|results|route|move";
  if (loc === "quad") return "quad|campus|status|route|move|plan|step";
  return isMissionForwardCharacter(id)
    ? "mission|stadium|route|move|plan|step"
    : "campus|status|chaos|taunt|plan|step";
}

function buildGeneratedCase(row, contract = {}) {
  const characterId = String(row.character_id || "").toLowerCase();
  const playerInput = sanitizePlayerInput(row.player_input || "");
  const intent = String(row.intent || "DYNAMIC_FLAVOR");
  const location = String(row.location || "quad");
  const markerTokens = (Array.isArray(contract.styleMarkers) ? contract.styleMarkers : [])
    .map((marker) => pickKeywordFromMarker(marker))
    .filter(Boolean)
    .slice(0, 2);
  const primaryPattern = characterId === "knuckles"
    ? "\\b[a-z]{3,}in(?:g)?\\s+and\\s+[a-z]{3,}in(?:g)?\\b"
    : markerTokens.length > 0
      ? markerTokens.join("|")
      : "move|route|mission";
  const required = [primaryPattern, buildContextAnchorPattern(location, characterId)];
  const mustInclude = markerTokens.length > 0 ? markerTokens.slice(0, 1) : ["in-character"];
  const defaultGoal = isMissionForwardCharacter(characterId)
    ? "Dynamic in-character reply with mission progression when relevant."
    : "Dynamic in-character reply focused on personality, social context, and natural scene reaction.";
  const id = `auto_${characterId}_${hashId(`${intent}:${location}:${playerInput}`)}`;
  return {
    id,
    generated: true,
    character_id: characterId,
    intent,
    goal: String(row.intent_goal || defaultGoal),
    must_include: mustInclude,
    avoid: [],
    player_input: playerInput,
    game_context: {
      location,
      time_remaining_sec: 240,
      npc_encounter_count: 2,
      sonic_drunk_level: 1
    },
    required_patterns: required,
    forbidden_patterns: defaultForbiddenPatternsFor(characterId)
  };
}

async function updateCasesFromLogs(args) {
  const minStyle = Number(args.minStyle || 74);
  const limit = Number(args.logLimit || 2500);
  const maxPerCharacter = Number(args.maxPerCharacter || 4);
  const write = String(args.write || "true") !== "false";
  const targetPath = resolvePathArg(args.targetPath, EXPERIMENTAL_CASES_PATH);

  const rows = await readJsonl(INTERACTION_LOG_PATH, limit);
  const contracts = JSON.parse(await fs.readFile(CONTRACTS_PATH, "utf8"));
  const baseline = JSON.parse(await fs.readFile(BASELINE_CASES_PATH, "utf8"));
  let existing = { meta: { version: "v1", description: "Experimental generated personality cases." }, cases: [] };
  try {
    existing = JSON.parse(await fs.readFile(targetPath, "utf8"));
  } catch {
    // Start empty if target file is missing.
  }
  const baselineCases = Array.isArray(baseline?.cases) ? baseline.cases : [];
  const existingCases = Array.isArray(existing?.cases) ? existing.cases : [];
  const existingKeySet = new Set(
    [...baselineCases, ...existingCases]
      .map((item) => `${String(item.character_id || "").toLowerCase()}::${sanitizePlayerInput(item.player_input || "").toLowerCase()}`)
  );

  const filtered = rows.filter((row) => {
    const source = String(row.source || "");
    const input = sanitizePlayerInput(row.player_input || "");
    if (!["llm", "llm_regen", "cache"].includes(source)) return false;
    if (!row.character_id || !input) return false;
    if (input.startsWith("__SYSTEM_GREETING__")) return false;
    if (input.length < 4) return false;
    const style = Number(row.style_score || 0);
    return style >= minStyle;
  });

  const perCharacter = {};
  const generated = [];
  for (const row of filtered) {
    const characterId = String(row.character_id || "").toLowerCase();
    perCharacter[characterId] = perCharacter[characterId] || 0;
    if (perCharacter[characterId] >= maxPerCharacter) continue;
    const key = `${characterId}::${sanitizePlayerInput(row.player_input || "").toLowerCase()}`;
    if (existingKeySet.has(key)) continue;
    const nextCase = buildGeneratedCase(row, contracts[characterId] || {});
    generated.push(nextCase);
    perCharacter[characterId] += 1;
    existingKeySet.add(key);
  }

  const merged = {
    ...(existing || {}),
    meta: {
      ...(existing?.meta || {}),
      generated_at: new Date().toISOString(),
      generated_from_log_rows: filtered.length,
      generated_case_count: generated.length
    },
    cases: [...existingCases, ...generated]
  };

  if (write) {
    await fs.writeFile(targetPath, JSON.stringify(merged, null, 2), "utf8");
  }

  console.log(`Scanned ${rows.length} log rows, eligible=${filtered.length}, generated=${generated.length}`);
  if (write) {
    console.log(`Merged generated cases into ${targetPath}`);
  } else {
    console.log("Dry run only. Pass --write true to persist.");
  }
}

function buildPayload(testCase, contract = {}) {
  const gameContext = testCase.game_context || {};
  const playerInput = String(testCase.player_input || "");
  const inventory = gameContext.inventory || [];
  const includeMissionProgression = shouldIncludeMissionProgression(testCase, contract);
  return {
    character_id: testCase.character_id,
    player_input: testCase.player_input,
    fallback_text: `${testCase.character_id} fallback line.`,
    intent: testCase.intent || "GENERAL",
    function_id: testCase.intent || "GENERAL",
    intent_context: {
      goal: testCase.goal || "Stay in character.",
      must_include: testCase.must_include || [],
      avoid: testCase.avoid || [],
      character_contract: contract || {}
    },
    current_context: {
      test_case_id: String(testCase.id || ""),
      location: gameContext.location || "quad",
      time_remaining_sec: Number(gameContext.time_remaining_sec || 480),
      sonic_drunk_level: Number(gameContext.sonic_drunk_level || 0),
      sonic_following: Boolean(gameContext.sonic_following || false),
      sonic_location: String(gameContext.sonic_location || ""),
      npc_encounter_count: Number(gameContext.npc_encounter_count || 1),
      npc_intent_state: {},
      inventory,
      has_student_id: Boolean(inventory.includes("Student ID")),
      has_whiskey: Boolean(inventory.includes("Dean Whiskey")),
      has_asswine: Boolean(inventory.includes("Asswine")),
      recent_turns: gameContext.recent_turns || [],
      player_input: playerInput
    },
    mission_progression: includeMissionProgression
      ? {
          objective: "Get Sonic to stadium",
          sub_objective: "Collect leverage and progress route",
          phase: "hunt",
          route_flags: gameContext.route_flags || {},
          fail_warnings: gameContext.fail_warnings || {}
        }
      : null,
    npc_memory_card: gameContext.npc_memory_card || null,
    recent_turns: gameContext.recent_turns || []
  };
}

async function runLiveCase(apiUrl, testCase, contract) {
  const payload = buildPayload(testCase, contract);
  const response = await fetch(`${apiUrl}/api/dialogue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }
  const data = await response.json();
  return {
    text: String(data?.npc_text || "").trim(),
    source: data?.source || "unknown",
    provider: data?.provider || "none",
    latencyMs: Number(data?.latency_ms || 0),
    payload
  };
}

function firstPatternToken(pattern = "") {
  const firstAlt = String(pattern || "").split("|")[0] || "";
  return firstAlt.replace(/[^a-z0-9\s]/gi, "").trim();
}

function buildFixtureText(testCase, contract = {}) {
  const required = Array.isArray(testCase.required_patterns) ? testCase.required_patterns : [];
  const markers = Array.isArray(contract.styleMarkers) ? contract.styleMarkers : [];
  const must = Array.isArray(testCase.must_include) ? testCase.must_include : [];
  const location = String(testCase?.game_context?.location || "quad");
  const characterId = String(testCase.character_id || "").toLowerCase();
  if (characterId === "knuckles") {
    return "Trainin and gainin. Prove your move.";
  }
  if (characterId === "frat_boys" && /(where.*sonic|sonic.*where|find sonic)/i.test(String(testCase.player_input || ""))) {
    return "Sonic is not here. Find him, challenge him, then bring him to Frat.";
  }
  const fallbackToken = isMissionForwardCharacter(characterId) ? "move" : "chaos";
  const words = [
    "Anyway",
    firstPatternToken(required[0]) || must[0] || fallbackToken,
    firstPatternToken(required[1]) || markers[0] || (isMissionForwardCharacter(characterId) ? "mission" : "status"),
    location
  ].filter(Boolean);
  let line = `${words.join(" ")}.`;
  if (String(testCase.character_id || "") !== "tails") {
    line = `${line} Bold move.`;
  }
  return line;
}

function runFixtureCase(testCase, contract = {}) {
  const fixtureText = testCase.fixture_response || buildFixtureText(testCase, contract);
  return {
    text: fixtureText,
    source: "fixture",
    provider: "fixture",
    latencyMs: 0,
    payload: buildPayload(testCase, {})
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (String(args["update-cases"] || "false") === "true") {
    await updateCasesFromLogs(args);
    return;
  }
  const mode = (args.mode || "live").toLowerCase();
  const apiUrl = args.apiUrl || process.env.LLM_API_URL || "http://localhost:8787";
  const threshold = Number(args.threshold || 60);
  const onlyCharacter = args.character ? String(args.character).toLowerCase() : "";
  const maxCases = Number(args.maxCases || 0);
  const allowFail = String(args["allow-fail"] || "false") === "true";
  const casesPath = resolvePathArg(args.casesPath, BASELINE_CASES_PATH);

  let casesRaw;
  casesRaw = JSON.parse(await fs.readFile(casesPath, "utf8"));
  const contracts = JSON.parse(await fs.readFile(CONTRACTS_PATH, "utf8"));
  let cases = Array.isArray(casesRaw?.cases) ? casesRaw.cases : [];
  if (onlyCharacter) {
    cases = cases.filter((c) => String(c.character_id || "").toLowerCase() === onlyCharacter);
  }
  if (maxCases > 0) {
    cases = cases.slice(0, maxCases);
  }
  if (cases.length === 0) {
    console.log("No cases selected. Check --character filter.");
    process.exit(1);
  }

  const evaluator = new Evaluator();
  const results = [];

  for (const testCase of cases) {
    const contract = contracts[testCase.character_id] || {};
    try {
      const run = mode === "fixture"
        ? runFixtureCase(testCase, contract)
        : await runLiveCase(apiUrl, testCase, contract);
      const text = run.text || "";
      const evalContext = {
        characterId: testCase.character_id,
        contract,
        intentContext: {
          must_include: testCase.must_include || [],
          avoid: testCase.avoid || [],
          goal: testCase.goal || ""
        },
        gameContext: run.payload.current_context || {},
        activeVariants: Number(run.payload?.current_context?.time_remaining_sec || 9999) <= 180
          ? ["time_pressure_high"]
          : []
      };
      const evalResult = evaluator.evaluate(text, evalContext, threshold);
      const patternFailures = runPatternChecks(
        text,
        testCase.required_patterns || [],
        testCase.forbidden_patterns || []
      );
      const scenarioFailures = runScenarioChecks(testCase, text);
      const structuralFailures = [];
      if (!text) structuralFailures.push("empty_response");
      if (sentenceCount(text) > 2) structuralFailures.push("too_many_sentences");
      if (text.length > 190) structuralFailures.push("too_long_for_bubble");

      const evalBlockingFailures = evalResult.reasons.filter((reason) => !isNonBlockingEvalReason(reason));
      const warnings = evalResult.reasons.filter((reason) => isNonBlockingEvalReason(reason));
      const scenarioCase = String(testCase.id || "").toLowerCase().startsWith("scenario_");
      const failures = scenarioCase
        ? [...evalBlockingFailures, ...scenarioFailures, ...structuralFailures]
        : [...evalBlockingFailures, ...patternFailures, ...structuralFailures];
      const scenarioWarnings = scenarioCase
        ? patternFailures.map((reason) => `pattern_secondary:${reason}`)
        : [];
      const passed = evalResult.compositeScore >= threshold && failures.length === 0;
      results.push({
        id: testCase.id,
        character: testCase.character_id,
        passed,
        score: evalResult.compositeScore,
        source: run.source,
        provider: run.provider,
        latencyMs: run.latencyMs,
        text,
        failures,
        warnings: [...warnings, ...scenarioWarnings]
      });
    } catch (err) {
      results.push({
        id: testCase.id,
        character: testCase.character_id,
        passed: false,
        score: 0,
        source: "error",
        provider: "none",
        latencyMs: 0,
        text: "",
        failures: [`runtime_error:${String(err?.message || err)}`]
      });
    }
  }

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const avgScore = Number((results.reduce((sum, r) => sum + (r.score || 0), 0) / Math.max(1, total)).toFixed(2));
  const byCharacter = {};
  const reasonCounts = {};

  results.forEach((row) => {
    byCharacter[row.character] = byCharacter[row.character] || { total: 0, pass: 0, fail: 0, avgScore: 0 };
    byCharacter[row.character].total += 1;
    if (row.passed) byCharacter[row.character].pass += 1;
    else byCharacter[row.character].fail += 1;
    byCharacter[row.character].avgScore += row.score || 0;
    row.failures.forEach((reason) => {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
  });
  Object.keys(byCharacter).forEach((key) => {
    byCharacter[key].avgScore = Number((byCharacter[key].avgScore / byCharacter[key].total).toFixed(2));
  });

  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([reason, count]) => ({ reason, count }));

  const summary = {
    generatedAt: new Date().toISOString(),
    mode,
    casesPath,
    apiUrl: mode === "live" ? apiUrl : null,
    threshold,
    totals: { total, passed, failed, passRatePct: Number(((passed / Math.max(1, total)) * 100).toFixed(2)) },
    avgScore,
    byCharacter,
    topFailureReasons: topReasons,
    failures: results.filter((r) => !r.passed).map((r) => ({
      id: r.id,
      character: r.character,
      score: r.score,
      failures: r.failures,
      warnings: r.warnings || [],
      text: r.text
    })),
    warnings: results
      .filter((r) => Array.isArray(r.warnings) && r.warnings.length > 0)
      .map((r) => ({
        id: r.id,
        character: r.character,
        warnings: r.warnings
      }))
  };

  const outputDir = path.join(ROOT, "data", "logs");
  const outputPath = path.join(outputDir, "personality_tuning_report.json");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`Personality tuning report written to ${outputPath}`);
  console.log(`Pass ${passed}/${total} (${summary.totals.passRatePct}%), avg score ${avgScore}`);
  if (summary.failures.length > 0) {
    console.log("Top failure reasons:");
    topReasons.slice(0, 5).forEach((item) => {
      console.log(`- ${item.reason}: ${item.count}`);
    });
  }

  if (failed > 0 && mode !== "fixture" && !allowFail) process.exitCode = 1;
}

await main();
