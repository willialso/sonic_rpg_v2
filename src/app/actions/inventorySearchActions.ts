import type { GameStateData, LocationId } from "../../types/game";

export function addInventory(state: GameStateData, item: string): void {
  if (!state.player.inventory.includes(item)) {
    state.player.inventory.push(item);
  }
}

export function removeInventory(state: GameStateData, item: string): void {
  state.player.inventory = state.player.inventory.filter((i) => i !== item);
}

export function revealSearchCache(state: GameStateData, location: LocationId, items: string[]): string[] {
  const existing = state.world.searchCaches[location];
  // Once a location cache exists (even empty), keep it authoritative for this run.
  if (existing !== undefined) return existing;
  state.world.searchCaches[location] = [...items];
  return state.world.searchCaches[location] ?? [];
}

export function takeFromSearchCache(state: GameStateData, location: LocationId, item: string): boolean {
  const existing = state.world.searchCaches[location] ?? [];
  if (!existing.includes(item)) return false;
  state.world.searchCaches[location] = existing.filter((value) => value !== item);
  addInventory(state, item);
  return true;
}
