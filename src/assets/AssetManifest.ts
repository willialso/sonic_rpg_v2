import type { LocationId, NpcId } from "../types/game";

export interface CharacterAssetEntry {
  default: string;
  states: Record<string, string>;
  speakerOverrides?: Record<string, string>;
}

export interface ExportGuidelines {
  backgrounds: {
    masterSize: string;
    safeZone: string;
    format: string;
  };
  characters: {
    masterSize: string;
    anchor: string;
    format: string;
  };
  items: {
    masterSize: string;
    format: string;
  };
}

export interface AssetManifest {
  version: string;
  imageBasePath: string;
  backgrounds: Record<string, string>;
  characters: Record<string, CharacterAssetEntry>;
  items: Record<string, string>;
  exportGuidelines: ExportGuidelines;
  fallbacks: {
    background: string;
    character: string;
    item: string;
  };
}

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export function createDefaultAssetManifest(): AssetManifest {
  return {
    version: "temp-v1",
    imageBasePath: "/assets/images",
    backgrounds: {},
    characters: {},
    items: {},
    exportGuidelines: {
      backgrounds: {
        masterSize: "2560x1440",
        safeZone: "1920x1080 centered",
        format: "webp"
      },
      characters: {
        masterSize: "1536x2048 transparent",
        anchor: "same per character across all states",
        format: "webp-alpha"
      },
      items: {
        masterSize: "512x512 transparent",
        format: "webp-alpha"
      }
    },
    fallbacks: {
      background: TRANSPARENT_PIXEL,
      character: TRANSPARENT_PIXEL,
      item: TRANSPARENT_PIXEL
    }
  };
}

function normalizePath(basePath: string, value: string): string {
  if (!value) return "";
  if (value.startsWith("data:")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return value;
  const cleanBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  return `${cleanBase}/${value}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function normalizeAssetManifest(raw: unknown): AssetManifest {
  const defaults = createDefaultAssetManifest();
  const root = asRecord(raw);
  const imageBasePath = typeof root.imageBasePath === "string" && root.imageBasePath.trim()
    ? root.imageBasePath
    : defaults.imageBasePath;

  const backgroundsRaw = asRecord(root.backgrounds);
  const backgrounds = Object.fromEntries(
    Object.entries(backgroundsRaw)
      .filter(([, path]) => typeof path === "string")
      .map(([key, path]) => [key, normalizePath(imageBasePath, path as string)])
  );

  const charactersRaw = asRecord(root.characters);
  const characters: Record<string, CharacterAssetEntry> = {};
  for (const [npc, entryValue] of Object.entries(charactersRaw)) {
    const entry = asRecord(entryValue);
    const statesRaw = asRecord(entry.states);
    const speakerOverridesRaw = asRecord(entry.speakerOverrides);
    const states = Object.fromEntries(
      Object.entries(statesRaw)
        .filter(([, path]) => typeof path === "string")
        .map(([state, path]) => [state, normalizePath(imageBasePath, path as string)])
    );
    const speakerOverrides = Object.fromEntries(
      Object.entries(speakerOverridesRaw)
        .filter(([, path]) => typeof path === "string")
        .map(([speaker, path]) => [speaker, normalizePath(imageBasePath, path as string)])
    );
    const defaultState = typeof entry.default === "string" ? normalizePath(imageBasePath, entry.default) : "";
    if (defaultState || Object.keys(states).length > 0) {
      characters[npc] = {
        default: defaultState || states.neutral || defaults.fallbacks.character,
        states,
        speakerOverrides: Object.keys(speakerOverrides).length > 0 ? speakerOverrides : undefined
      };
    }
  }

  const itemsRaw = asRecord(root.items);
  const items = Object.fromEntries(
    Object.entries(itemsRaw)
      .filter(([, path]) => typeof path === "string")
      .map(([key, path]) => [key, normalizePath(imageBasePath, path as string)])
  );

  const fallbacksRaw = asRecord(root.fallbacks);
  const fallbacks = {
    background: typeof fallbacksRaw.background === "string"
      ? normalizePath(imageBasePath, fallbacksRaw.background)
      : defaults.fallbacks.background,
    character: typeof fallbacksRaw.character === "string"
      ? normalizePath(imageBasePath, fallbacksRaw.character)
      : defaults.fallbacks.character,
    item: typeof fallbacksRaw.item === "string"
      ? normalizePath(imageBasePath, fallbacksRaw.item)
      : defaults.fallbacks.item
  };

  return {
    version: typeof root.version === "string" && root.version.trim() ? root.version : defaults.version,
    imageBasePath,
    backgrounds,
    characters,
    items,
    exportGuidelines: defaults.exportGuidelines,
    fallbacks
  };
}

export function resolveBackgroundImage(manifest: AssetManifest, location: LocationId | string): string {
  return manifest.backgrounds[location] ?? manifest.fallbacks.background;
}

export function resolveCharacterImage(
  manifest: AssetManifest,
  npcId: NpcId | string,
  state: string = "default",
  displaySpeaker?: string
): string {
  const entry = manifest.characters[npcId];
  if (!entry) return manifest.fallbacks.character;
  const speakerKey = String(displaySpeaker || "").trim();
  if (speakerKey && entry.speakerOverrides) {
    if (entry.speakerOverrides[speakerKey]) {
      return entry.speakerOverrides[speakerKey];
    }
    const loweredKey = speakerKey.toLowerCase();
    const matchedOverride = Object.entries(entry.speakerOverrides).find(
      ([name]) => name.toLowerCase() === loweredKey
    );
    if (matchedOverride) {
      return matchedOverride[1];
    }
  }
  return entry.states[state] ?? entry.default ?? manifest.fallbacks.character;
}

export function resolveItemImage(manifest: AssetManifest, itemName: string): string {
  return manifest.items[itemName] ?? manifest.fallbacks.item;
}
