export function seededRoll(seedInput: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedInput.length; i += 1) {
    h ^= seedInput.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}
