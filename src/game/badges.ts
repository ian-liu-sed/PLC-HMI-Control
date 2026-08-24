import type { DifficultyTier, MissionResult } from "./types";

export type BadgeId =
  | "safety-first"
  | "scan-master"
  | "link-keeper"
  | "press-commissioner"
  | "capsule-specialist"
  | "q-line-integrator"
  | "blister-specialist"
  | "cell-commander"
  | "campaign-master";

export interface BadgeDefinition {
  id: BadgeId;
  icon: string;
  missionId?: string;
  title: { zh: string; ja: string; en: string };
}

export const BADGES: BadgeDefinition[] = [
  {
    id: "safety-first",
    icon: "S",
    title: { zh: "安全优先", ja: "安全優先", en: "Safety First" },
  },
  {
    id: "scan-master",
    icon: "Σ",
    title: { zh: "扫描高手", ja: "スキャン習熟", en: "Scan Master" },
  },
  {
    id: "link-keeper",
    icon: "⇄",
    title: { zh: "链路守护", ja: "リンク維持", en: "Link Keeper" },
  },
  {
    id: "press-commissioner",
    icon: "P",
    missionId: "M1-press",
    title: { zh: "压片投运", ja: "打錠立上げ", en: "Press Commissioner" },
  },
  {
    id: "capsule-specialist",
    icon: "C",
    missionId: "M2-capsule",
    title: { zh: "胶囊专工", ja: "カプセル専任", en: "Capsule Specialist" },
  },
  {
    id: "q-line-integrator",
    icon: "Q",
    missionId: "M3-bottle",
    title: { zh: "Q 线集成", ja: "Qライン統合", en: "Q Line Integrator" },
  },
  {
    id: "blister-specialist",
    icon: "B",
    missionId: "M4-blister",
    title: { zh: "泡罩专工", ja: "PTP専任", en: "Blister Specialist" },
  },
  {
    id: "cell-commander",
    icon: "Ω",
    missionId: "M5-line",
    title: { zh: "单元指挥", ja: "セル指揮", en: "Cell Commander" },
  },
  {
    id: "campaign-master",
    icon: "★",
    title: { zh: "战役大师", ja: "キャンペーン制覇", en: "Campaign Master" },
  },
];

const LINE_BADGE_IDS: BadgeId[] = [
  "press-commissioner",
  "capsule-specialist",
  "q-line-integrator",
  "blister-specialist",
  "cell-commander",
];

export function evaluateBadges(
  missionId: string,
  result: MissionResult,
  difficulty: DifficultyTier,
  alreadyUnlocked: Iterable<string>,
): BadgeId[] {
  if (!result.passed) return [];
  const unlocked = new Set(alreadyUnlocked);
  const earned = new Set<BadgeId>();
  const add = (id: BadgeId, condition: boolean) => {
    if (condition && !unlocked.has(id)) earned.add(id);
  };

  add("safety-first", result.incidentsHandled >= 1 && result.qualityPct >= 97);
  add("scan-master", result.oeePct >= 88 && result.qualityPct >= 98);
  add(
    "link-keeper",
    difficulty >= 2 && result.incidentsHandled >= 2 && result.oeePct >= 80,
  );
  add(
    "press-commissioner",
    missionId === "M1-press" && result.qualityPct >= 98 && result.oeePct >= 82,
  );
  add(
    "capsule-specialist",
    missionId === "M2-capsule" && result.qualityPct >= 98.5 && result.oeePct >= 84,
  );
  add(
    "q-line-integrator",
    missionId === "M3-bottle" && result.qualityPct >= 98 && result.oeePct >= 80,
  );
  add(
    "blister-specialist",
    missionId === "M4-blister" && result.qualityPct >= 98 && result.oeePct >= 83,
  );
  add(
    "cell-commander",
    missionId === "M5-line" &&
      difficulty >= 2 &&
      result.qualityPct >= 98 &&
      result.oeePct >= 82,
  );

  const after = new Set([...unlocked, ...earned]);
  add(
    "campaign-master",
    LINE_BADGE_IDS.every((id) => after.has(id)),
  );

  return BADGES.map((badge) => badge.id).filter((id) => earned.has(id));
}
