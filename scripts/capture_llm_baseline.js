import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const LOG_PATH = path.join(ROOT, "data", "logs", "interaction_log.jsonl");
const CORRECTION_PATH = path.join(ROOT, "data", "training", "voice_correction_candidates.jsonl");
const OUTPUT_PATH = path.join(ROOT, "data", "logs", "llm_baseline_v2.json");

function percentile(values = [], p = 50) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function readJsonl(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

async function capture() {
  const interactions = await readJsonl(LOG_PATH);
  const corrections = await readJsonl(CORRECTION_PATH);
  const total = interactions.length;
  const sourceCounts = interactions.reduce((acc, row) => {
    const key = row?.source || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const latencies = interactions.map((row) => Number(row?.latency_ms)).filter((n) => Number.isFinite(n) && n >= 0);
  const avgLatency = latencies.length ? Number((latencies.reduce((sum, n) => sum + n, 0) / latencies.length).toFixed(2)) : null;

  const payload = {
    generated_at: new Date().toISOString(),
    note: "Baseline snapshot captured before/while migrating to LLM pipeline v3.",
    window_rows: total,
    source_counts: sourceCounts,
    latency_ms: {
      samples: latencies.length,
      avg: avgLatency,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95)
    },
    correction_dataset_rows: corrections.length
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote LLM baseline snapshot -> ${OUTPUT_PATH}`);
}

await capture();
