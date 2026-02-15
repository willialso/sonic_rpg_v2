import fs from "fs/promises";
import path from "path";

const root = process.cwd();
const targets = [
  path.join(root, "data", "logs", "interaction_log.jsonl"),
  path.join(root, "data", "training", "voice_correction_candidates.jsonl")
];

for (const filePath of targets) {
  try {
    await fs.rm(filePath, { force: true });
    console.log(`Cleared: ${filePath}`);
  } catch (error) {
    console.log(`Skip: ${filePath} (${String(error)})`);
  }
}

console.log("QA logs reset complete.");
