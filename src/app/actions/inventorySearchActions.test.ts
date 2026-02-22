import { describe, expect, it } from "vitest";
import { createInitialState } from "../../core/state/initialState";
import { revealSearchCache, takeFromSearchCache } from "./inventorySearchActions";

describe("inventorySearchActions", () => {
  it("does not repopulate search cache after item is taken", () => {
    const state = createInitialState("search-cache-seed");
    const location = "quad";
    const sourceItems = ["Campus Map"];

    const firstReveal = revealSearchCache(state, location, sourceItems);
    expect(firstReveal).toEqual(["Campus Map"]);

    const took = takeFromSearchCache(state, location, "Campus Map");
    expect(took).toBe(true);
    expect(state.world.searchCaches[location]).toEqual([]);

    const secondReveal = revealSearchCache(state, location, sourceItems);
    expect(secondReveal).toEqual([]);
  });
});
