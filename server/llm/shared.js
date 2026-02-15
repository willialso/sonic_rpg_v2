import crypto from "crypto";

export function hash(input) {
  return crypto.createHash("sha256").update(String(input || "")).digest("hex").slice(0, 24);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeCharacterId(characterId = "") {
  const id = String(characterId).toLowerCase();
  if (id.includes("dean")) return "dean_cain";
  if (id.includes("earthworm")) return "earthworm_jim";
  if (id === "frat_guys") return "frat_boys";
  return id.replace(/\s+/g, "_");
}

export function normalizeForSimilarity(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractKeywords(text = "") {
  return normalizeForSimilarity(text).split(/\s+/).filter((token) => token.length >= 4);
}

export function percentile(values = [], p = 50) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function sanitizeNpcText(text = "") {
  return String(text)
    .replace(/\bundefined\b/gi, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([!?.,;:])/g, "$1")
    .trim();
}

export function extractJsonFromText(text = "") {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function mapLocationGroup(locationId = "") {
  const map = {
    dean_office: "DEAN_OFFICE",
    quad: "QUAD",
    eggman_classroom: "EGGMAN_CLASSROOM",
    frat: "FRAT",
    sorority: "TUNNEL",
    tunnel: "TUNNEL",
    cafeteria: "CAFETERIA",
    dorms: "DORM",
    dorm_room: "DORM",
    stadium: "STADIUM"
  };
  return map[String(locationId || "").toLowerCase()] || "";
}

function splitSentenceChunks(text = "") {
  const chunks = String(text || "").match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g);
  return (chunks || []).map((part) => part.trim()).filter(Boolean);
}

function sentenceCapitalization(text = "") {
  const line = String(text || "");
  if (!line) return line;
  let startOfSentence = true;
  let out = "";
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (startOfSentence && /[a-z]/.test(ch)) {
      out += ch.toUpperCase();
      startOfSentence = false;
      continue;
    }
    out += ch;
    if (/[.!?]/.test(ch)) {
      startOfSentence = true;
    } else if (/\S/.test(ch)) {
      startOfSentence = false;
    }
  }
  return out;
}

export function limitSentences(text = "", maxSentences = 2) {
  const chunks = splitSentenceChunks(text);
  if (chunks.length <= maxSentences) return String(text || "").trim();
  return chunks.slice(0, maxSentences).join(" ").trim();
}

export function polishNpcText(text = "") {
  const cleaned = sanitizeNpcText(text);
  if (!cleaned) return "";
  const chunks = splitSentenceChunks(cleaned);
  const composed = chunks.length ? chunks.join(" ") : cleaned;
  const normalized = sentenceCapitalization(composed).replace(/\s+([!?.,;:])/g, "$1").trim();
  if (!normalized) return "";
  if (/[.!?]["')\]]*$/.test(normalized)) return normalized;
  if (/[a-z0-9)"'\]]$/i.test(normalized)) return `${normalized}.`;
  return normalized;
}

export function fitBubbleLine(text = "", maxSentences = 2) {
  const limited = limitSentences(text, maxSentences);
  return polishNpcText(limited);
}

export function fitBubbleLineWithLimit(text = "", options = {}) {
  const maxSentences = Number(options?.maxSentences || 2);
  const maxChars = Number(options?.maxChars || 190);
  const polished = fitBubbleLine(text, maxSentences);
  if (!polished) return "";
  if (!Number.isFinite(maxChars) || maxChars <= 0) return polished;
  if (polished.length <= maxChars) return polished;
  const trimmed = polished.slice(0, Math.max(0, maxChars - 1)).trimEnd();
  return `${trimmed}...`;
}
