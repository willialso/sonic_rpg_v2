import { describe, expect, it } from "vitest";
import { DEAN_FAKE_ID_LIMIT, WARNING_LIMITS } from "../gameplay/progressionRules";
import {
  evaluateDeanFakeId,
  evaluateDeanWarning,
  evaluateFratWarning,
  evaluateLuigiDisrespect
} from "./controllerPolicies";

describe("controllerPolicies", () => {
  it("evaluates dean warning escalation against shared limit", () => {
    expect(evaluateDeanWarning(WARNING_LIMITS.dean - 1).hardFail).toBe(false);
    expect(evaluateDeanWarning(WARNING_LIMITS.dean).hardFail).toBe(true);
    expect(evaluateDeanWarning(WARNING_LIMITS.dean).limitText).toBe(`${WARNING_LIMITS.dean}/${WARNING_LIMITS.dean}`);
  });

  it("evaluates dean fake-id escalation against shared limit", () => {
    expect(evaluateDeanFakeId(DEAN_FAKE_ID_LIMIT - 1).hardFail).toBe(false);
    expect(evaluateDeanFakeId(DEAN_FAKE_ID_LIMIT).hardFail).toBe(true);
    expect(evaluateDeanFakeId(1).limitText).toBe(`1/${DEAN_FAKE_ID_LIMIT}`);
  });

  it("evaluates luigi and frat warning escalations against shared limits", () => {
    expect(evaluateLuigiDisrespect(WARNING_LIMITS.luigi - 1).hardFail).toBe(false);
    expect(evaluateLuigiDisrespect(WARNING_LIMITS.luigi).hardFail).toBe(true);

    expect(evaluateFratWarning(WARNING_LIMITS.frat - 1).hardFail).toBe(false);
    expect(evaluateFratWarning(WARNING_LIMITS.frat).hardFail).toBe(true);
  });
});
