import { describe, expect, it } from "vitest";
import {
  DEAN_FAKE_ID_LIMIT,
  ESCORT_READY_DRUNK_LEVEL,
  LUIGI_CONTRABAND_LIMIT,
  WARNING_LIMITS,
  isEscortReady,
  shouldDeanExpelForFakeId,
  shouldDeanExpelForWarnings,
  shouldFratBeatdown,
  shouldLuigiExpelForContraband,
  shouldLuigiExpelForDisrespect,
  warningMeter
} from "./progressionRules";

describe("progressionRules", () => {
  it("uses a single escort readiness threshold", () => {
    expect(isEscortReady(ESCORT_READY_DRUNK_LEVEL - 1)).toBe(false);
    expect(isEscortReady(ESCORT_READY_DRUNK_LEVEL)).toBe(true);
  });

  it("formats warning meter safely", () => {
    expect(warningMeter(0, 3)).toBe("0/3");
    expect(warningMeter(2, 3)).toBe("2/3");
    expect(warningMeter(-2, 3)).toBe("0/3");
  });

  it("enforces fail-path warning thresholds consistently", () => {
    expect(shouldDeanExpelForWarnings(WARNING_LIMITS.dean - 1)).toBe(false);
    expect(shouldDeanExpelForWarnings(WARNING_LIMITS.dean)).toBe(true);

    expect(shouldDeanExpelForFakeId(DEAN_FAKE_ID_LIMIT - 1)).toBe(false);
    expect(shouldDeanExpelForFakeId(DEAN_FAKE_ID_LIMIT)).toBe(true);

    expect(shouldLuigiExpelForContraband(LUIGI_CONTRABAND_LIMIT - 1)).toBe(false);
    expect(shouldLuigiExpelForContraband(LUIGI_CONTRABAND_LIMIT)).toBe(true);

    expect(shouldLuigiExpelForDisrespect(WARNING_LIMITS.luigi - 1)).toBe(false);
    expect(shouldLuigiExpelForDisrespect(WARNING_LIMITS.luigi)).toBe(true);

    expect(shouldFratBeatdown(WARNING_LIMITS.frat - 1)).toBe(false);
    expect(shouldFratBeatdown(WARNING_LIMITS.frat)).toBe(true);
  });
});
