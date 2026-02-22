export const ESCORT_READY_DRUNK_LEVEL = 3;

export const WARNING_LIMITS = {
  dean: 3,
  luigi: 3,
  frat: 2
} as const;

export const LUIGI_CONTRABAND_LIMIT = 2;
export const DEAN_FAKE_ID_LIMIT = 2;

export function isEscortReady(drunkLevel: number): boolean {
  return drunkLevel >= ESCORT_READY_DRUNK_LEVEL;
}

export function warningMeter(current: number, limit: number): string {
  return `${Math.max(0, current)}/${limit}`;
}

export function shouldDeanExpelForWarnings(deanWarnings: number): boolean {
  return deanWarnings >= WARNING_LIMITS.dean;
}

export function shouldDeanExpelForFakeId(deanWarnings: number): boolean {
  return deanWarnings >= DEAN_FAKE_ID_LIMIT;
}

export function shouldLuigiExpelForContraband(contrabandStrikes: number): boolean {
  return contrabandStrikes >= LUIGI_CONTRABAND_LIMIT;
}

export function shouldLuigiExpelForDisrespect(luigiWarnings: number): boolean {
  return luigiWarnings >= WARNING_LIMITS.luigi;
}

export function shouldFratBeatdown(fratWarnings: number): boolean {
  return fratWarnings >= WARNING_LIMITS.frat;
}
