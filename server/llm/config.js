import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

export const config = {
  // Prefer explicit API_PORT so unrelated PORT env vars do not break local proxy routing.
  apiPort: Number(process.env.API_PORT || process.env.PORT || 8787),
  llmPipelineVersion: String(process.env.LLM_PIPELINE_VERSION || "v3").toLowerCase(),
  debug: process.env.LLM_DEBUG === "1",
  primaryProvider: (process.env.PRIMARY_PROVIDER || "openai").toLowerCase(),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  throttleMs: Number(process.env.LLM_THROTTLE_MS || 380),
  cacheTtlMs: Number(process.env.LLM_CACHE_TTL_MS || 300000),
  maxBackoffMs: Number(process.env.LLM_MAX_BACKOFF_MS || 60000),
  styleThreshold: Number(process.env.LLM_STYLE_THRESHOLD || 56),
  fetchTimeoutMs: Number(process.env.LLM_FETCH_TIMEOUT_MS || 9000),
  transientRetries: Number(process.env.LLM_TRANSIENT_RETRIES || 1),
  maxBubbleLengthChars: Number(process.env.LLM_MAX_BUBBLE_CHARS || 190),
  maxSentencesPerReply: Number(process.env.LLM_MAX_SENTENCES || 2),
  retrievalExamplesDefault: Number(process.env.LLM_RETRIEVAL_EXAMPLES_DEFAULT || 3),
  retrievalExamplesCritical: Number(process.env.LLM_RETRIEVAL_EXAMPLES_CRITICAL || 4),
  dataDir: DATA_DIR,
  logsDir: path.join(DATA_DIR, "logs"),
  trainingDir: path.join(DATA_DIR, "training"),
  personaDir: path.join(DATA_DIR, "persona"),
  sonicReferencePath: path.join(DATA_DIR, "persona", "sonic_named_references.json"),
  retrievalPath: path.join(DATA_DIR, "retrieval_index.json"),
  interactionLogPath: path.join(DATA_DIR, "logs", "interaction_log.jsonl"),
  correctionLogPath: path.join(DATA_DIR, "training", "voice_correction_candidates.jsonl")
};
