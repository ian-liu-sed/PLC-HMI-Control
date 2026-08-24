import type {
  CpuFamily,
  FaultKind,
  I18nText,
  Recipe,
} from "../simulator/types";

export type DifficultyTier = 1 | 2 | 3;
export type CampaignScreen =
  | "hub"
  | "brief"
  | "play"
  | "result"
  | "hold"
  | "negotiate"
  | "client";

export type EquipmentId =
  | "tablet-press"
  | "capsule-filler"
  | "capsule-polisher"
  | "metal-detector"
  | "pill-counter"
  | "capping"
  | "induction-sealer"
  | "blister-packer";

export interface RecipeFieldDef {
  key: keyof Recipe;
  device: string;
  label: I18nText;
  unit: string;
}

export interface RemoteStationDef {
  id: number;
  equipmentId: EquipmentId;
  name: I18nText;
}

export interface MissionIncident {
  id: string;
  atMs: number;
  kind: FaultKind;
  message: I18nText;
}

export interface MissionDef {
  id: string;
  title: I18nText;
  subtitle: I18nText;
  briefing: I18nText;
  family: CpuFamily;
  cpuModel: string;
  product: "tablet" | "capsule";
  equipment: EquipmentId[];
  recipe: Recipe;
  recipeFields: RecipeFieldDef[];
  remotes: RemoteStationDef[];
  stations: Array<{ id: string; label: I18nText }>;
  photo: string;
}

export interface DifficultyProfile {
  qualityPct: number;
  oeePct: number;
  incidents: MissionIncident[];
}

export interface CampaignState {
  failures: Record<string, number>;
  holds: Record<string, number>;
  badges: Record<string, number>;
  cooperations: number;
  difficulty: DifficultyTier;
}

export interface MissionResult {
  aborted: boolean;
  completed: boolean;
  passed: boolean;
  qualityPct: number;
  oeePct: number;
  total: number;
  good: number;
  rejected: number;
  incidentsHandled: number;
  score: number;
}
