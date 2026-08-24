import type { SimConfig } from "../simulator/types";
import type {
  DifficultyProfile,
  DifficultyTier,
  MissionDef,
  MissionIncident,
} from "./types";

const fields = {
  speed: {
    key: "speedPpm" as const,
    device: "D100",
    label: { zh: "生产速度", ja: "生産速度", en: "Line speed" },
    unit: "pcs/min",
  },
  weight: {
    key: "targetWeightMg" as const,
    device: "D101",
    label: { zh: "目标重量", ja: "目標重量", en: "Target weight" },
    unit: "mg",
  },
  force: {
    key: "targetWeightMg" as const,
    device: "D101",
    label: { zh: "主压缩力", ja: "本圧圧力", en: "Main compression" },
    unit: "×10 N",
  },
  fill: {
    key: "targetWeightMg" as const,
    device: "D101",
    label: { zh: "填充重量", ja: "充填重量", en: "Fill weight" },
    unit: "mg",
  },
  seal: {
    key: "targetWeightMg" as const,
    device: "D101",
    label: { zh: "热封设定", ja: "シール設定", en: "Seal setpoint" },
    unit: "×0.1",
  },
  tolerance: {
    key: "toleranceMg" as const,
    device: "D102",
    label: { zh: "允许偏差", ja: "許容偏差", en: "Tolerance" },
    unit: "±",
  },
  reject: {
    key: "rejectPulseMs" as const,
    device: "D103",
    label: { zh: "剔除脉冲", ja: "排出パルス", en: "Reject pulse" },
    unit: "ms",
  },
  batch: {
    key: "batchTarget" as const,
    device: "D104",
    label: { zh: "批次目标", ja: "バッチ目標", en: "Batch target" },
    unit: "pcs",
  },
};

export const MISSIONS: MissionDef[] = [
  {
    id: "M1-press",
    title: {
      zh: "任务 1 — 旋转压片机投运",
      ja: "ミッション1 — ロータリー打錠機立上げ",
      en: "Mission 1 — Rotary press startup",
    },
    subtitle: {
      zh: "FX5U 紧凑型 PLC · SED-GY-D",
      ja: "FX5U コンパクトPLC · SED-GY-D",
      en: "FX5U compact PLC · SED-GY-D",
    },
    briefing: {
      zh: "压片机本体安装 FX5U。接通 24 V，用 SLMP 连接 HMI，确认 X0/X1/X2 后复位，写入压缩与转速配方，AUTO 启动。颗粒在料斗中等待——把主压缩和转速留在工艺窗内。",
      ja: "打錠機にFX5Uを搭載。24V投入、SLMPでHMI接続、X0/X1/X2確認後にリセットし、圧縮と回転数を書き込んでAUTO起動します。",
      en: "An FX5U sits on the tablet press. Power 24 V, open SLMP, prove X0/X1/X2, reset, write compression and speed, then AUTO start. Keep the main compression window valid.",
    },
    family: "FX",
    cpuModel: "FX5U",
    product: "tablet",
    equipment: ["tablet-press"],
    recipe: {
      speedPpm: 48,
      targetWeightMg: 500,
      toleranceMg: 18,
      rejectPulseMs: 120,
      batchTarget: 40,
    },
    recipeFields: [fields.speed, fields.force, fields.tolerance, fields.reject, fields.batch],
    remotes: [],
    stations: [
      { id: "feed", label: { zh: "加料器", ja: "フィーダ", en: "Feeder" } },
      { id: "process", label: { zh: "转台压缩", ja: "ターレット圧縮", en: "Turret press" } },
      { id: "inspect", label: { zh: "片重检测", ja: "重量検査", en: "Weight check" } },
      { id: "sort", label: { zh: "剔除", ja: "排出", en: "Reject" } },
    ],
    photo: "./equipment/tablet-press.jpg",
  },
  {
    id: "M2-capsule",
    title: {
      zh: "任务 2 — 胶囊充填运行",
      ja: "ミッション2 — カプセル充填",
      en: "Mission 2 — Capsule fill run",
    },
    subtitle: {
      zh: "FX5U · SED-J + 抛光",
      ja: "FX5U · SED-J + ポリッシャ",
      en: "FX5U · SED-J + polisher",
    },
    briefing: {
      zh: "空心胶囊进入剂量转塔。真空分离和填压力决定装量。配方必须停机写入并回读。胶囊线会安静地失败——盯住剔除计数。",
      ja: "空カプセルが定量タレットへ。真空とタッピングが充填精度を決めます。レシピは停止中に書込み・照合します。",
      en: "Empty shells enter the dosing turret. Vacuum and tamping set fill accuracy. Recipes write only while stopped, then verify. Watch rejects — capsule lines fail quietly.",
    },
    family: "FX",
    cpuModel: "FX5U",
    product: "capsule",
    equipment: ["capsule-filler", "capsule-polisher"],
    recipe: {
      speedPpm: 52,
      targetWeightMg: 380,
      toleranceMg: 16,
      rejectPulseMs: 110,
      batchTarget: 42,
    },
    recipeFields: [fields.speed, fields.fill, fields.tolerance, fields.reject, fields.batch],
    remotes: [],
    stations: [
      { id: "feed", label: { zh: "囊壳分离", ja: "カプセル分離", en: "Shell split" } },
      { id: "process", label: { zh: "定量充填", ja: "定量充填", en: "Dosing" } },
      { id: "inspect", label: { zh: "抛光/检重", ja: "研磨/重量", en: "Polish / check" } },
      { id: "sort", label: { zh: "不良排出", ja: "不良排出", en: "Reject" } },
    ],
    photo: "./equipment/capsule-filler.jpg",
  },
  {
    id: "M3-bottle",
    title: {
      zh: "任务 3 — 装瓶包装线",
      ja: "ミッション3 — ボトル包装ライン",
      en: "Mission 3 — Bottle pack line",
    },
    subtitle: {
      zh: "Q03UDE 线体 PLC · CC-Link 远程站",
      ja: "Q03UDE ラインPLC · CC-Link遠隔局",
      en: "Q03UDE line PLC · CC-Link remotes",
    },
    briefing: {
      zh: "Q03UDE 做线体主站。金属检测、电子数粒、旋盖、电磁感应封口作为 CC-Link 远程站。本地 X/Y 走安全与主输送；远程站掉线必须受控停止，恢复通信后不得自动启动。",
      ja: "Q03UDEがラインマスタ。金属検出、計数、キャッピング、誘導シールはCC-Link遠隔局です。遠隔局落ちは制御停止、通信復帰で自動再起動しません。",
      en: "A Q03UDE is the line master. Metal detect, counter, capper and induction sealer are CC-Link remotes. A remote drop is a controlled stop. Link restore must never auto-start motion.",
    },
    family: "Q",
    cpuModel: "Q03UDE",
    product: "tablet",
    equipment: ["metal-detector", "pill-counter", "capping", "induction-sealer"],
    recipe: {
      speedPpm: 44,
      targetWeightMg: 620,
      toleranceMg: 20,
      rejectPulseMs: 140,
      batchTarget: 36,
    },
    recipeFields: [fields.speed, fields.seal, fields.tolerance, fields.reject, fields.batch],
    remotes: [
      {
        id: 1,
        equipmentId: "metal-detector",
        name: { zh: "金属检测", ja: "金属検出", en: "Metal detector" },
      },
      {
        id: 2,
        equipmentId: "pill-counter",
        name: { zh: "电子数粒", ja: "電子計数", en: "Pill counter" },
      },
      {
        id: 3,
        equipmentId: "capping",
        name: { zh: "旋盖机", ja: "キャッパー", en: "Capper" },
      },
      {
        id: 4,
        equipmentId: "induction-sealer",
        name: { zh: "电磁感应封口", ja: "誘導シール", en: "Induction sealer" },
      },
    ],
    stations: [
      { id: "feed", label: { zh: "金属检测", ja: "金属検出", en: "Metal detect" } },
      { id: "process", label: { zh: "数粒", ja: "計数", en: "Count" } },
      { id: "inspect", label: { zh: "旋盖", ja: "キャッピング", en: "Cap" } },
      { id: "sort", label: { zh: "感应封口", ja: "誘導シール", en: "Induction seal" } },
    ],
    photo: "./equipment/pill-counter.jpg",
  },
  {
    id: "M4-blister",
    title: {
      zh: "任务 4 — 泡罩包装挑战",
      ja: "ミッション4 — PTP包装",
      en: "Mission 4 — Blister pack challenge",
    },
    subtitle: {
      zh: "FX5U · SED-P-A + 金属检测",
      ja: "FX5U · SED-P-A + 金属検出",
      en: "FX5U · SED-P-A + metal detect",
    },
    briefing: {
      zh: "成型 PVC 腔、放入胶囊、热封铝箔、冲切。成型温度和封合压力决定腔体塌陷还是封口剥离。用 FX 顺序步跟踪成型 → 充填 → 封合 → 冲切。",
      ja: "PVC成形、カプセル供給、アルミシール、打抜き。成形温度とシール圧が品質を決めます。",
      en: "Form PVC cavities, place capsules, seal ALU foil, punch cards. Forming temperature and seal pressure decide collapsed pockets versus peel seals.",
    },
    family: "FX",
    cpuModel: "FX5U",
    product: "capsule",
    equipment: ["blister-packer", "metal-detector"],
    recipe: {
      speedPpm: 40,
      targetWeightMg: 540,
      toleranceMg: 22,
      rejectPulseMs: 150,
      batchTarget: 34,
    },
    recipeFields: [fields.speed, fields.seal, fields.tolerance, fields.reject, fields.batch],
    remotes: [],
    stations: [
      { id: "feed", label: { zh: "成型", ja: "成形", en: "Form" } },
      { id: "process", label: { zh: "充填", ja: "充填", en: "Place" } },
      { id: "inspect", label: { zh: "热封", ja: "ヒートシール", en: "Seal" } },
      { id: "sort", label: { zh: "冲切/检测", ja: "打抜き/検査", en: "Punch / detect" } },
    ],
    photo: "./equipment/blister-packer.jpg",
  },
  {
    id: "M5-line",
    title: {
      zh: "任务 5 — 固体制剂单元 OEE",
      ja: "ミッション5 — 固形剤セルOEE",
      en: "Mission 5 — Solid-dose cell OEE",
    },
    subtitle: {
      zh: "Q13UDV 单元 PLC + FX5U 压片机",
      ja: "Q13UDV セルPLC + FX5U 打錠機",
      en: "Q13UDV cell PLC + FX5U press",
    },
    briefing: {
      zh: "Q13UDV 作为单元控制器，通过 MC 3E 对上 HMI、通过 CC-Link 对下协调压片（FX5U）、检测、数粒、旋盖、封口。OEE = 可用率 × 性能 × 质量。通信恢复不等于运动恢复。",
      ja: "Q13UDVがセルコントローラ。HMIはMC 3E、下位はCC-LinkでFX5U打錠機ほかを協調します。通信復帰は運転復帰ではありません。",
      en: "Q13UDV is the cell controller. HMI talks MC 3E; CC-Link coordinates the FX5U press plus detect, count, cap and seal. OEE = Availability × Performance × Quality. A restored link is not a restart.",
    },
    family: "Q",
    cpuModel: "Q13UDV",
    product: "tablet",
    equipment: [
      "tablet-press",
      "metal-detector",
      "pill-counter",
      "capping",
      "induction-sealer",
    ],
    recipe: {
      speedPpm: 46,
      targetWeightMg: 500,
      toleranceMg: 15,
      rejectPulseMs: 120,
      batchTarget: 48,
    },
    recipeFields: [fields.speed, fields.weight, fields.tolerance, fields.reject, fields.batch],
    remotes: [
      {
        id: 1,
        equipmentId: "tablet-press",
        name: { zh: "FX5U 压片机", ja: "FX5U 打錠機", en: "FX5U tablet press" },
      },
      {
        id: 2,
        equipmentId: "metal-detector",
        name: { zh: "金属检测", ja: "金属検出", en: "Metal detector" },
      },
      {
        id: 3,
        equipmentId: "pill-counter",
        name: { zh: "数粒", ja: "計数", en: "Counter" },
      },
      {
        id: 4,
        equipmentId: "capping",
        name: { zh: "旋盖/封口", ja: "キャップ/シール", en: "Cap / seal" },
      },
    ],
    stations: [
      { id: "feed", label: { zh: "压片 (FX)", ja: "打錠 (FX)", en: "Press (FX)" } },
      { id: "process", label: { zh: "检测", ja: "検出", en: "Detect" } },
      { id: "inspect", label: { zh: "数粒", ja: "計数", en: "Count" } },
      { id: "sort", label: { zh: "旋盖封口", ja: "キャップシール", en: "Cap / seal" } },
    ],
    photo: "./equipment/tablet-press.jpg",
  },
];

function qualityDrift(atMs: number, id: string): MissionIncident {
  return {
    id,
    atMs,
    kind: "quality",
    message: {
      zh: "过程窗口漂移：检查 D101/D102 并在停机后回写配方。",
      ja: "工程ウィンドウがドリフト。D101/D102を確認し、停止後にレシピを再書込み。",
      en: "Process window drifted. Check D101/D102 and rewrite the recipe while stopped.",
    },
  };
}

function doorIncident(atMs: number, id: string): MissionIncident {
  return {
    id,
    atMs,
    kind: "door",
    message: {
      zh: "运行中安全门打开。运动输出必须立即切断，复位前不得启动。",
      ja: "運転中に安全扉が開きました。出力を即遮断し、リセット前は起動禁止。",
      en: "Guard opened while running. Drop motion outputs. Do not start before a safety reset.",
    },
  };
}

function linkIncident(atMs: number, id: string): MissionIncident {
  return {
    id,
    atMs,
    kind: "link",
    message: {
      zh: "HMI 会话中断。3 秒无心跳翻转则受控停止。",
      ja: "HMIセッション断。ハートビート変化なし3秒で制御停止。",
      en: "HMI session dropped. A 3 s heartbeat freeze is a controlled stop.",
    },
  };
}

function remoteIncident(atMs: number, id: string): MissionIncident {
  return {
    id,
    atMs,
    kind: "remote",
    message: {
      zh: "CC-Link 远程站掉线。Q CPU 锁存链路报警，禁止自动再启动。",
      ja: "CC-Link遠隔局が脱落。Q CPUがリンク警報をラッチし、自動再起動しません。",
      en: "CC-Link remote station dropped. The Q CPU latches a link alarm and will not auto-restart.",
    },
  };
}

export function difficultyProfile(
  mission: MissionDef,
  difficulty: DifficultyTier,
): DifficultyProfile {
  const q = mission.family === "Q";
  if (difficulty === 1) {
    return {
      qualityPct: 96,
      oeePct: 68,
      incidents: [qualityDrift(8000, `${mission.id}-d1-q`)],
    };
  }
  if (difficulty === 2) {
    return {
      qualityPct: 98,
      oeePct: 78,
      incidents: [
        qualityDrift(7000, `${mission.id}-d2-q`),
        q
          ? remoteIncident(16000, `${mission.id}-d2-r`)
          : doorIncident(15000, `${mission.id}-d2-d`),
      ],
    };
  }
  return {
    qualityPct: 99,
    oeePct: 84,
    incidents: [
      qualityDrift(6000, `${mission.id}-d3-q`),
      q
        ? remoteIncident(12000, `${mission.id}-d3-r`)
        : doorIncident(12000, `${mission.id}-d3-d`),
      linkIncident(22000, `${mission.id}-d3-l`),
    ],
  };
}

export function missionSimConfig(
  mission: MissionDef,
  difficulty: DifficultyTier,
  seed = 0x5ed2026,
): SimConfig {
  const profile = difficultyProfile(mission, difficulty);
  return {
    seed,
    family: mission.family,
    cpuModel: mission.cpuModel,
    missionId: mission.id,
    recipe: mission.recipe,
    remotes: mission.remotes,
    incidents: profile.incidents,
    passQualityPct: profile.qualityPct,
    passOeePct: profile.oeePct,
  };
}

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((mission) => mission.id === id);
}
