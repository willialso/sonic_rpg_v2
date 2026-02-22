import {
  DEAN_FAKE_ID_LIMIT,
  LUIGI_CONTRABAND_LIMIT,
  WARNING_LIMITS,
  shouldDeanExpelForFakeId,
  shouldDeanExpelForWarnings,
  shouldFratBeatdown,
  shouldLuigiExpelForDisrespect
} from "../gameplay/progressionRules";

export function evaluateDeanWarning(nextDeanWarnings: number): { hardFail: boolean; limitText: string } {
  return {
    hardFail: shouldDeanExpelForWarnings(nextDeanWarnings),
    limitText: `${nextDeanWarnings}/${WARNING_LIMITS.dean}`
  };
}

export function evaluateDeanFakeId(nextDeanWarnings: number): { hardFail: boolean; limitText: string } {
  return {
    hardFail: shouldDeanExpelForFakeId(nextDeanWarnings),
    limitText: `${nextDeanWarnings}/${DEAN_FAKE_ID_LIMIT}`
  };
}

export function evaluateLuigiDisrespect(nextLuigiWarnings: number): { hardFail: boolean; limitText: string } {
  return {
    hardFail: shouldLuigiExpelForDisrespect(nextLuigiWarnings),
    limitText: `${nextLuigiWarnings}/${WARNING_LIMITS.luigi}`
  };
}

export function evaluateFratWarning(nextFratWarnings: number): { hardFail: boolean; limitText: string } {
  return {
    hardFail: shouldFratBeatdown(nextFratWarnings),
    limitText: `${nextFratWarnings}/${WARNING_LIMITS.frat}`
  };
}
