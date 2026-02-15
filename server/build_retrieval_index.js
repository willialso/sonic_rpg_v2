import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "data", "retrieval_index.json");
const SOURCE = path.join(ROOT, "data", "retrieval_index.json");

function normalizeSpeakerName(raw = "") {
  const value = String(raw).toLowerCase();
  if (value.includes("dean")) return "dean_cain";
  if (value.includes("earthworm")) return "earthworm_jim";
  return value.replace(/\s+/g, "_");
}

async function build() {
  let sourceRaw;
  try {
    sourceRaw = await fs.readFile(SOURCE, "utf8");
  } catch {
    throw new Error(`Missing retrieval source: ${SOURCE}`);
  }

  const parsed = JSON.parse(sourceRaw);
  const inputEntries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  const entries = inputEntries
    .map((entry) => ({
      speaker: normalizeSpeakerName(entry.speaker || entry.character || ""),
      line: String(entry.line || "").trim(),
      locationGroup: String(entry.locationGroup || "").toUpperCase(),
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      source: String(entry.source || "canonical")
    }))
    .filter((entry) => entry.speaker && entry.line);

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(
    OUTPUT,
    JSON.stringify(
      {
        version: "v1",
        generated_at: new Date().toISOString(),
        source_file: SOURCE,
        entries
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Built retrieval index with ${entries.length} entries -> ${OUTPUT}`);
}

await build();
