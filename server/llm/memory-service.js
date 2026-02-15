import fs from "fs/promises";
import { config } from "./config.js";
import { extractKeywords, mapLocationGroup, normalizeCharacterId } from "./shared.js";

export class MemoryService {
  constructor() {
    this.retrieval = { entries: [] };
    this.retrievalReady = false;
  }

  async init() {
    try {
      const raw = await fs.readFile(config.retrievalPath, "utf8");
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
      this.retrieval = { entries };
      this.retrievalReady = entries.length > 0;
    } catch {
      this.retrieval = { entries: [] };
      this.retrievalReady = false;
    }
  }

  getStats() {
    return {
      retrievalReady: this.retrievalReady,
      retrievalEntries: this.retrieval.entries?.length || 0
    };
  }

  retrieveExamples(characterId, gameContext = {}, playerInput = "", limit = 6) {
    const entries = this.retrieval.entries || [];
    if (!entries.length) return [];
    const targetCharacter = normalizeCharacterId(characterId);
    const targetLocation = mapLocationGroup(gameContext.location || "");
    const keywords = extractKeywords(playerInput);
    const askedMission = /(mission|stadium|route|escort|follow|objective|what now)/i.test(String(playerInput || ""));

    const scoped = entries.filter((entry) => normalizeCharacterId(entry.speaker || "") === targetCharacter);
    const byLocation = targetLocation
      ? scoped.filter((entry) => String(entry.locationGroup || "").toUpperCase() === targetLocation)
      : scoped;
    const pool = byLocation.length >= 3 ? byLocation : scoped;

    const filtered = pool.filter((entry) => {
      const line = String(entry.line || "");
      if (targetCharacter === "sonic" && !askedMission && /(mission|stadium|route|escort|follow)/i.test(line)) {
        return false;
      }
      if (targetCharacter === "frat_boys" && /(^|\s)(ready to|you ready|wanna|want to|are you|should we)\b/i.test(line)) {
        return false;
      }
      return true;
    });
    const scoringPool = filtered.length >= 3 ? filtered : pool;

    return scoringPool
      .map((entry) => {
        const line = String(entry.line || "").toLowerCase();
        let score = 0;
        if (targetLocation && String(entry.locationGroup || "").toUpperCase() === targetLocation) score += 5;
        if (keywords.length) score += keywords.filter((kw) => line.includes(kw)).length * 2;
        return { entry, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((row) => row.entry);
  }
}
