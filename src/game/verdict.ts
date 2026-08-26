import type { I18nText } from "../simulator/types";
import type { MissionResult } from "./types";

export type VerdictReason = "aborted" | "incomplete" | "quality" | "oee";

export interface BatchVerdict {
  passed: boolean;
  qualityOk: boolean;
  oeeOk: boolean;
  reasons: VerdictReason[];
}

export function batchVerdict(
  result: Pick<MissionResult, "passed" | "aborted" | "completed" | "qualityPct" | "oeePct">,
  qualityGate: number,
  oeeGate: number,
): BatchVerdict {
  const qualityOk = result.qualityPct + 1e-9 >= qualityGate;
  const oeeOk = result.oeePct + 1e-9 >= oeeGate;
  const reasons: VerdictReason[] = [];
  if (result.aborted) reasons.push("aborted");
  if (!result.completed) reasons.push("incomplete");
  if (result.completed && !qualityOk) reasons.push("quality");
  if (result.completed && !oeeOk) reasons.push("oee");
  return {
    passed: result.passed,
    qualityOk,
    oeeOk,
    reasons,
  };
}

export const VERDICT_REASON_COPY: Record<VerdictReason, I18nText> = {
  aborted: {
    zh: "任务被中止，批次不计通过。",
    ja: "ミッション中止。バッチは不合格。",
    en: "Mission aborted. The batch does not pass.",
  },
  incomplete: {
    zh: "未打满批次目标，不能算完成。",
    ja: "バッチ目標未達。完了とみなさない。",
    en: "Batch target was not reached, so the run is incomplete.",
  },
  quality: {
    zh: "质量低于门槛。",
    ja: "品質が基準未満。",
    en: "Quality is below the gate.",
  },
  oee: {
    zh: "OEE 低于门槛。",
    ja: "OEEが基準未満。",
    en: "OEE is below the gate.",
  },
};
