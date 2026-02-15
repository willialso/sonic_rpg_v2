import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "public", "content", "asset_manifest.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function isDataUri(value) {
  return typeof value === "string" && value.startsWith("data:");
}

function toAssetFilePath(imageBasePath, assetRef) {
  if (!assetRef || isDataUri(assetRef)) return null;
  const base = imageBasePath || "/assets/images";
  const normalizedRef = assetRef.startsWith("/") ? assetRef : `${base}/${assetRef}`;
  const trimmed = normalizedRef.replace(/^\/+/, "");
  return path.join(projectRoot, "public", trimmed);
}

function pushIssue(issues, group, key, value, reason) {
  issues.push({ group, key, value, reason });
}

function checkRecordPaths(issues, group, record, imageBasePath) {
  for (const [key, value] of Object.entries(record || {})) {
    if (typeof value !== "string") {
      pushIssue(issues, group, key, String(value), "not a string");
      continue;
    }
    const filePath = toAssetFilePath(imageBasePath, value);
    if (filePath && !fs.existsSync(filePath)) {
      pushIssue(issues, group, key, value, "file missing");
    }
  }
}

function validateManifest(manifest) {
  const issues = [];
  const imageBasePath = manifest.imageBasePath || "/assets/images";

  checkRecordPaths(issues, "backgrounds", manifest.backgrounds, imageBasePath);
  checkRecordPaths(issues, "items", manifest.items, imageBasePath);
  checkRecordPaths(issues, "fallbacks", manifest.fallbacks, imageBasePath);

  for (const [npcId, entry] of Object.entries(manifest.characters || {})) {
    if (!entry || typeof entry !== "object") {
      pushIssue(issues, "characters", npcId, String(entry), "invalid character entry");
      continue;
    }
    checkRecordPaths(issues, `characters.${npcId}`, { default: entry.default }, imageBasePath);
    checkRecordPaths(issues, `characters.${npcId}.states`, entry.states, imageBasePath);
    checkRecordPaths(
      issues,
      `characters.${npcId}.speakerOverrides`,
      entry.speakerOverrides,
      imageBasePath
    );
  }

  return issues;
}

try {
  const manifest = readJson(manifestPath);
  const issues = validateManifest(manifest);
  if (issues.length === 0) {
    console.log("asset_manifest validation passed.");
    process.exit(0);
  }
  console.error(`asset_manifest validation failed (${issues.length} issue(s)).`);
  for (const issue of issues) {
    console.error(
      `- [${issue.group}] ${issue.key}: ${issue.value} (${issue.reason})`
    );
  }
  process.exit(1);
} catch (error) {
  console.error("asset_manifest validation failed with runtime error.");
  console.error(error);
  process.exit(1);
}
