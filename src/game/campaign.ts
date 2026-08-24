import type { CampaignState, DifficultyTier } from "./types";

export type { CampaignState, DifficultyTier };

export const HOLD_THRESHOLD = 3;
export const HOLD_DURATION_MS = 60 * 60 * 1000;

const COOKIE_KEY = "sed_control_pilot_campaign_v1";
const COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const INITIAL: CampaignState = {
  failures: {},
  holds: {},
  badges: {},
  cooperations: 0,
  difficulty: 1,
};

function freshState(): CampaignState {
  return { ...INITIAL, failures: {}, holds: {}, badges: {} };
}

function normalize(raw: Partial<CampaignState>): CampaignState {
  const cooperations = Math.max(0, Math.floor(Number(raw.cooperations) || 0));
  const savedDifficulty = Math.floor(Number(raw.difficulty) || 1);
  const difficulty = Math.min(3, Math.max(1, savedDifficulty)) as DifficultyTier;
  const failures = Object.fromEntries(
    Object.entries(raw.failures ?? {}).map(([key, value]) => [
      key,
      Math.max(0, Math.floor(Number(value) || 0)),
    ]),
  );
  const holds: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw.holds ?? {})) {
    const holdUntil = Math.max(0, Number(value) || 0);
    if (holdUntil > 0) holds[key] = holdUntil;
  }
  const badges: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw.badges ?? {})) {
    const unlockedAt = Math.max(0, Number(value) || 0);
    if (unlockedAt > 0) badges[key] = unlockedAt;
  }
  return { failures, holds, badges, cooperations, difficulty };
}

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${COOKIE_KEY}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

function writeCookie(state: CampaignState): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(state))}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function loadCampaign(): CampaignState {
  try {
    const saved = readCookie();
    if (saved) return normalize(JSON.parse(saved) as Partial<CampaignState>);
    return freshState();
  } catch {
    return freshState();
  }
}

export function saveCampaign(state: CampaignState): void {
  try {
    writeCookie(normalize(state));
  } catch {
    /* session-only progress */
  }
}

export function failureCount(state: CampaignState, missionId: string): number {
  return state.failures[missionId] ?? 0;
}

export function holdRemainingMs(
  state: CampaignState,
  missionId: string,
  now = Date.now(),
): number {
  return Math.max(0, (state.holds[missionId] ?? 0) - now);
}

export function recordOutcome(
  state: CampaignState,
  missionId: string,
  passed: boolean,
  now = Date.now(),
): CampaignState {
  const next = normalize(state);
  if (passed) {
    next.failures[missionId] = 0;
    delete next.holds[missionId];
  } else {
    const failures = failureCount(state, missionId) + 1;
    next.failures[missionId] = failures;
    if (failures >= HOLD_THRESHOLD && !next.holds[missionId]) {
      next.holds[missionId] = now + HOLD_DURATION_MS;
    }
  }
  saveCampaign(next);
  return next;
}

export function selectDifficulty(
  state: CampaignState,
  difficulty: DifficultyTier,
): CampaignState {
  const next = normalize({ ...state, difficulty });
  saveCampaign(next);
  return next;
}

export function unlockBadges(
  state: CampaignState,
  badgeIds: Iterable<string>,
  now = Date.now(),
): CampaignState {
  const next = normalize(state);
  for (const badgeId of badgeIds) {
    if (!next.badges[badgeId]) next.badges[badgeId] = now;
  }
  saveCampaign(next);
  return next;
}

export function completeClientRecovery(
  state: CampaignState,
  missionId: string,
): CampaignState {
  const cooperations = state.cooperations + 1;
  const next: CampaignState = {
    failures: { ...state.failures, [missionId]: 0 },
    holds: { ...state.holds },
    badges: { ...state.badges },
    cooperations,
    difficulty: Math.min(3, cooperations + 1) as DifficultyTier,
  };
  delete next.holds[missionId];
  saveCampaign(next);
  return next;
}
