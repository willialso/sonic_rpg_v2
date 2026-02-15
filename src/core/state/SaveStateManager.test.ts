import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState } from "./initialState";
import { SaveStateManager } from "./SaveStateManager";

const localStore = new Map<string, string>();

beforeEach(() => {
  localStore.clear();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => localStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStore.set(key, value);
      },
      removeItem: (key: string) => {
        localStore.delete(key);
      }
    },
    configurable: true,
    writable: true
  });
});

describe("SaveStateManager", () => {
  it("saves and restores a valid game state", () => {
    const manager = new SaveStateManager();
    const state = createInitialState("save-load-seed");
    state.sonic.drunkLevel = 3;
    manager.save(state);
    const loaded = manager.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.meta.seed).toBe("save-load-seed");
    expect(loaded?.sonic.drunkLevel).toBe(3);
  });

  it("returns null for malformed or invalid save payloads", () => {
    const manager = new SaveStateManager();
    localStorage.setItem("sonic_rpg_v2_autosave", JSON.stringify({ bad: "shape" }));
    expect(manager.load()).toBeNull();
  });
});
