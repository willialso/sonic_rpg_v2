import type { LocationContent, NpcProfile } from "../types/game";
import {
  createDefaultAssetManifest,
  normalizeAssetManifest,
  type AssetManifest
} from "../assets/AssetManifest";

export interface ContentBundle {
  gameContent: { version: string; objective: string };
  locations: LocationContent[];
  npcProfiles: NpcProfile[];
  dialogueRules: {
    safetyAbortKeywords: string[];
    maxSentencesPerReply?: number;
    maxBubbleLengthChars?: number;
  };
  assetManifest: AssetManifest;
}

export function createFallbackContentBundle(): ContentBundle {
  return {
    gameContent: {
      version: "2.0.0",
      objective: "Fallback mode: recover content files and restart for full experience."
    },
    locations: [
      { id: "dean_office", name: "Dean Office", description: "Fallback location.", exits: ["quad"] },
      { id: "quad", name: "Quad", description: "Fallback location.", exits: ["dean_office", "frat", "cafeteria"] },
      { id: "eggman_classroom", name: "Eggman Classroom", description: "Fallback location.", exits: ["quad"] },
      { id: "frat", name: "Frat House", description: "Fallback location.", exits: ["quad", "sorority", "dorms"] },
      { id: "sorority", name: "Sorority House", description: "Fallback location.", exits: ["frat", "tunnel"] },
      { id: "tunnel", name: "Tunnel", description: "Fallback location.", exits: ["sorority", "stadium"] },
      { id: "cafeteria", name: "Cafeteria", description: "Fallback location.", exits: ["quad", "dorms"] },
      { id: "dorms", name: "Dorm Hall", description: "Fallback location.", exits: ["frat", "cafeteria", "dorm_room"] },
      { id: "dorm_room", name: "Dorm Room", description: "Fallback location.", exits: ["dorms"] },
      { id: "stadium", name: "Stadium", description: "Fallback location.", exits: ["tunnel"] }
    ],
    npcProfiles: [],
    dialogueRules: {
      safetyAbortKeywords: ["self-harm", "suicide", "kill myself"],
      maxSentencesPerReply: 2,
      maxBubbleLengthChars: 220
    },
    assetManifest: createDefaultAssetManifest()
  };
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load content file: ${path}`);
  }
  return (await response.json()) as T;
}

export async function loadContentBundle(): Promise<ContentBundle> {
  try {
    const [gameContent, locationsWrap, npcWrap, dialogueRules, assetManifestRaw] = await Promise.all([
      loadJson<{ version: string; objective: string }>("/content/game_content.json"),
      loadJson<{ locations: LocationContent[] }>("/content/locations.json"),
      loadJson<{ npcs: NpcProfile[] }>("/content/npc_profiles.json"),
      loadJson<{ safetyAbortKeywords: string[]; maxSentencesPerReply?: number; maxBubbleLengthChars?: number }>("/content/dialogue_rules.json"),
      loadJson<unknown>("/content/asset_manifest.json").catch(() => createDefaultAssetManifest())
    ]);

    return {
      gameContent,
      locations: locationsWrap.locations,
      npcProfiles: npcWrap.npcs,
      dialogueRules,
      assetManifest: normalizeAssetManifest(assetManifestRaw)
    };
  } catch (err) {
    console.error("Content bootstrap failed, entering fallback content mode.", err);
    return createFallbackContentBundle();
  }
}
