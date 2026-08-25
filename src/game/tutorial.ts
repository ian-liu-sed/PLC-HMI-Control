import type { I18nText, Locale, PlcSnapshot } from "../simulator/types";

export type StartStepId =
  | "power"
  | "connect"
  | "field"
  | "reset"
  | "auto"
  | "start"
  | "run";

export interface StartStep {
  id: Exclude<StartStepId, "field" | "run">;
  title: I18nText;
}

const CHAIN: StartStep[] = [
  { id: "power", title: { zh: "主电源 ON", ja: "主電源 ON", en: "Main power ON" } },
  { id: "connect", title: { zh: "NET 连接", ja: "NET接続", en: "Open NET session" } },
  { id: "reset", title: { zh: "安全复位 → M0", ja: "安全リセット → M0", en: "Safety reset → M0" } },
  { id: "auto", title: { zh: "切到 AUTO", ja: "AUTOへ", en: "Switch AUTO" } },
  { id: "start", title: { zh: "循环启动 START", ja: "サイクル起動 START", en: "Cycle START" } },
];

export const START_CHAIN_STEPS: readonly StartStep[] = CHAIN;

const HINTS: Record<StartStepId, I18nText> = {
  power: {
    zh: "开局 CPU 断电。先按操作台「主电源」，24 V 起来后才能写位。",
    ja: "開始時はCPU電源OFF。操作盤の「主電源」を入れてからビットを書けます。",
    en: "CPU starts unpowered. Press Main power on the operator panel before any writes.",
  },
  connect: {
    zh: "上电还不够。打开左侧「通信链路 / NET」，按「连接」。HMI 心跳未建立时禁止启动。",
    ja: "電源だけでは不足。左の「通信リンク / NET」で「接続」。ハートビートなしでは起動不可。",
    en: "Power is not a session. Open NET on the left rail and press Connect. No start without heartbeat.",
  },
  field: {
    zh: "X0/X1/X2 有 NG。先释放急停，或在事件区按「清除条件」。硬件不健康时复位会被拒绝。",
    ja: "X0/X1/X2がNG。非常停止を解除するか、イベント区の「条件解除」。ハード不良ではリセット拒否。",
    en: "X0/X1/X2 is NG. Release E-stop or Clear faults. Reset is refused while hardware is unhealthy.",
  },
  reset: {
    zh: "提醒：X0/X1/X2 已 OK 时 M0 仍是 NG。M0 = 安全链 AND 复位锁存。点 M0 卡片或按「安全复位」。",
    ja: "注意：X0/X1/X2がOKでもM0はNGのまま。M0=安全チェーンANDリセットラッチ。M0カードか「安全リセット」。",
    en: "Reminder: X0/X1/X2 can be OK while M0 stays NG. M0 is chain AND reset latch. Click the M0 tile or Safety reset.",
  },
  auto: {
    zh: "复位完成。确认底部是 AUTO（不是 MANUAL），再启动。",
    ja: "リセット完了。下部がAUTO（MANUALでない）ことを確認して起動。",
    en: "Reset is latched. Confirm AUTO at the bottom, not MANUAL, then start.",
  },
  start: {
    zh: "许可齐了。按「循环启动 START」。通信恢复不会自动启动。",
    ja: "許可が揃った。「サイクル起動 START」。通信復帰は自動起動しない。",
    en: "Permissives are true. Press Cycle START. A restored link never auto-starts.",
  },
  run: {
    zh: "批次运行中。故障后必须再复位、再 START。",
    ja: "バッチ運転中。異常後は再リセットして再START。",
    en: "Batch is running. After a trip, reset again, then START.",
  },
};

export function nextStartStep(
  snapshot: Pick<
    PlcSnapshot,
    "powered" | "connected" | "safetyReset" | "mode" | "running" | "completed" | "inputs"
  >,
): StartStepId {
  if (snapshot.running || snapshot.completed) return "run";
  if (!snapshot.powered) return "power";
  if (!snapshot.connected) return "connect";
  if (!snapshot.inputs.eStopHealthy || !snapshot.inputs.safetyDoorClosed || !snapshot.inputs.driveHealthy) {
    return "field";
  }
  if (!snapshot.safetyReset) return "reset";
  if (snapshot.mode !== "auto") return "auto";
  return "start";
}

export function startStepHint(step: StartStepId): I18nText {
  return HINTS[step];
}

export function chainStatus(step: StartStepId, id: StartStep["id"]): "done" | "current" | "todo" {
  const order: StartStep["id"][] = ["power", "connect", "reset", "auto", "start"];
  const current = step === "field" ? "reset" : step === "run" ? "start" : step;
  const here = order.indexOf(id);
  const now = order.indexOf(current);
  if (step === "run") return "done";
  if (here < now) return "done";
  if (here === now) return "current";
  return "todo";
}

export function tutorialPulseSelector(step: StartStepId): string | null {
  switch (step) {
    case "power":
      return '[data-action="power"]';
    case "connect":
      return '[data-view="network"], [data-action="connect"]';
    case "field":
      return '[data-cond="X0"], [data-cond="X1"], [data-cond="X2"]';
    case "reset":
      return '[data-action="reset-safety"], [data-cond="M0"]';
    case "auto":
      return '[data-action="mode-auto"]';
    case "start":
      return '[data-action="start"]';
    default:
      return null;
  }
}

function pick(text: I18nText, locale: Locale): string {
  return text[locale];
}

export function renderAssistantCoach(locale: Locale, snapshot: PlcSnapshot): string {
  const step = nextStartStep(snapshot);
  const hint = pick(startStepHint(step), locale);
  const items = CHAIN.map((item) => {
    const status = chainStatus(step, item.id);
    return `<li class="${status}"><span>${pick(item.title, locale)}</span></li>`;
  }).join("");
  return `
    <section class="live-coach tutorial" id="live-coach">
      <div class="tutorial-head">
        <b>${pick({ zh: "助理教程 · 启动链", ja: "アシスタント教程 · 起動チェーン", en: "Assistant tutorial · start chain" }, locale)}</b>
        <small>${pick({ zh: "专家/传奇不显示逐步提示", ja: "エキスパート/レジェンドは手順を出さない", en: "Expert/Legend hide this walkthrough" }, locale)}</small>
      </div>
      <ol class="tutorial-steps">${items}</ol>
      <p class="tutorial-hint">${hint}</p>
    </section>
  `;
}
