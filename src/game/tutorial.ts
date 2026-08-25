import type { I18nText, Locale, PlcSnapshot } from "../simulator/types";

export type GuideId =
  | "power"
  | "connect"
  | "field-estop"
  | "field-door"
  | "field-drive"
  | "reset"
  | "auto"
  | "start"
  | "stop-recipe"
  | "write-recipe"
  | "run"
  | "done";

export interface StartStep {
  id: "power" | "connect" | "reset" | "auto" | "start";
  title: I18nText;
}

const CHAIN: StartStep[] = [
  { id: "power", title: { zh: "1 主电源", ja: "1 主電源", en: "1 Power" } },
  { id: "connect", title: { zh: "2 NET 连接", ja: "2 NET接続", en: "2 NET connect" } },
  { id: "reset", title: { zh: "3 复位 M0", ja: "3 M0リセット", en: "3 Latch M0" } },
  { id: "auto", title: { zh: "4 AUTO", ja: "4 AUTO", en: "4 AUTO" } },
  { id: "start", title: { zh: "5 START", ja: "5 START", en: "5 START" } },
];

export const START_CHAIN_STEPS: readonly StartStep[] = CHAIN;

const HOW: Record<Exclude<GuideId, "done">, I18nText[]> = {
  power: [
    {
      zh: "开局 CPU 是断电的。先找操作台（B）左上「主电源」，按到 ON。",
      ja: "開始時CPUはOFF。操作盤(B)左上の「主電源」をON。",
      en: "CPU starts off. Press Main power (panel B, top-left) until it reads ON.",
    },
    {
      zh: "没上电时，连接、复位、改配方都会失败。",
      ja: "電源OFFでは接続・リセット・レシピ書込みは失敗する。",
      en: "Connect, reset, and recipe writes all fail while unpowered.",
    },
  ],
  connect: [
    {
      zh: "点左侧栏「03 通信链路 / NET」。",
      ja: "左レール「03 通信リンク / NET」を開く。",
      en: "Open left rail 03 Communication / NET.",
    },
    {
      zh: "确认 IP/端口后按「连接」。状态变成 SESSION OPEN / 通信在线。",
      ja: "IP/ポート確認後「接続」。SESSION OPEN / 通信オンラインになる。",
      en: "Confirm IP/port, press Connect, wait for SESSION OPEN / link up.",
    },
    {
      zh: "回到「01 运行监控」。没心跳禁止 START。",
      ja: "「01 運転監視」に戻る。ハートビートなしではSTART不可。",
      en: "Return to 01 HMI. START is blocked without heartbeat.",
    },
  ],
  "field-estop": [
    {
      zh: "X0 急停是 NG。先看右下黄按钮：若写着 RELEASE / 解除，点它释放。",
      ja: "X0非常停止がNG。右下の黄ボタンがRELEASEなら押して解除。",
      en: "X0 E-stop is NG. If the yellow button says RELEASE, press it.",
    },
    {
      zh: "释放急停不等于安全许可。X0 变 OK 后，再点 M0 或「安全复位」。",
      ja: "解除は許可ではない。X0がOKになってからM0または安全リセット。",
      en: "Release is not a latch. When X0 is OK, click M0 or Safety reset.",
    },
  ],
  "field-door": [
    {
      zh: "X1 安全门 NG。现在不要点 M0：门开着，复位会被拒绝。",
      ja: "X1安全扉がNG。今はM0を押さない。扉開ではリセット拒否。",
      en: "X1 guard is NG. Do not click M0 yet — reset is refused while the door is open.",
    },
    {
      zh: "到本页下方「故障训练」，按「清除条件」。或直接点红色的 X1 卡片。",
      ja: "下の「異常トレーニング」で「条件解除」。または赤いX1カードを押す。",
      en: "In Fault training below, press Clear faults. Or click the red X1 tile.",
    },
    {
      zh: "X1 变 OK 后，再点 M0 锁存，然后 START。开门不会自动再启动。",
      ja: "X1がOKならM0をラッチし、START。扉復帰は自動起動しない。",
      en: "When X1 is OK, latch M0, then START. Closing the door never auto-starts.",
    },
  ],
  "field-drive": [
    {
      zh: "X2 驱动器 NG。先「清除条件」或点红色 X2，不要先点 M0。",
      ja: "X2ドライブがNG。先に「条件解除」または赤いX2。M0は後。",
      en: "X2 drive is NG. Clear faults or click red X2 before M0.",
    },
    {
      zh: "X2 变 OK 后点 M0 复位，再 START。",
      ja: "X2がOKならM0リセット、その後START。",
      en: "When X2 is OK, reset M0, then START.",
    },
  ],
  reset: [
    {
      zh: "X0/X1/X2 已是 OK，但 M0 仍是 NG。这是正常的：M0 = 安全链 AND 复位锁存。",
      ja: "X0/X1/X2はOKでもM0はNG。正常。M0=チェーンANDリセットラッチ。",
      en: "X0/X1/X2 can be OK while M0 stays NG. Normal: M0 is chain AND reset latch.",
    },
    {
      zh: "点橙色的 M0 卡片，或按操作台「安全复位 RESET」。",
      ja: "オレンジのM0カード、または「安全リセット RESET」。",
      en: "Click the amber M0 tile, or press Safety reset RESET.",
    },
    {
      zh: "M0 变成 OK 后，确认底部是 AUTO，再按 START。",
      ja: "M0がOKなら下部がAUTOか確認し、START。",
      en: "When M0 is OK, confirm AUTO at the bottom, then START.",
    },
  ],
  auto: [
    {
      zh: "安全已复位。看操作台底部：左边 MANUAL / AUTO。",
      ja: "安全リセット済み。操作盤下部のMANUAL / AUTO。",
      en: "Safety is latched. Check MANUAL / AUTO at the bottom of the operator panel.",
    },
    {
      zh: "点 AUTO 使它高亮。手动模式不能循环启动。",
      ja: "AUTOを押してハイライト。手動ではサイクル起動できない。",
      en: "Press AUTO until it highlights. Manual mode will not cycle-start.",
    },
  ],
  start: [
    {
      zh: "许可齐了。按操作台「循环启动 START」。",
      ja: "許可が揃った。操作盤「サイクル起動 START」。",
      en: "Permissives are true. Press Cycle START.",
    },
    {
      zh: "之后若配方闪、门开、或网络断：先处理原因，再复位，再 START。不会自动启动。",
      ja: "その後レシピ点滅・扉・通信断は原因処理→リセット→再START。自動起動しない。",
      en: "Later flashes, door trips, or link drops need fix, reset, then START. Never auto-start.",
    },
  ],
  "stop-recipe": [
    {
      zh: "D101/D102 在闪，但配方标题是「运行锁定」。输入是灰的，现在改不了。",
      ja: "D101/D102が点滅しても「運転中ロック」。入力は灰色で今は変えられない。",
      en: "D101/D102 are flashing, but the recipe header says Running lock. Inputs are grey. You cannot edit yet.",
    },
    {
      zh: "先按操作台「正常停止 STOP」。不要用急停，除非要断安全链。",
      ja: "先に「通常停止 STOP」。安全チェーンを切る時以外は非常停止を使わない。",
      en: "Press Normal stop STOP first. Do not use E-stop unless you mean to break the safety chain.",
    },
    {
      zh: "标题变成「可编辑」后，改闪烁的 D101、D102，再按绿色「写入配方」。",
      ja: "「編集可」になってから点滅のD101/D102を変え、緑の「レシピ書込み」。",
      en: "When it says Editable, change flashing D101/D102, then press green Write recipe.",
    },
    {
      zh: "写入后若安全链 NG，先清条件再点 M0，再 START。",
      ja: "書込み後に安全NGなら条件解除→M0→START。",
      en: "If the chain is NG after the write: clear faults, latch M0, then START.",
    },
  ],
  "write-recipe": [
    {
      zh: "已停止。配方应显示「可编辑」。点闪烁的 D101（力/目标）和 D102（偏差）改数字。",
      ja: "停止済み。「編集可」のはず。点滅のD101（力/目標）とD102（公差）を変更。",
      en: "Stopped. Header should say Editable. Change flashing D101 (force/target) and D102 (tolerance).",
    },
    {
      zh: "必须按「写入配方 WRITE + VERIFY」。只改框不写入，PLC 仍用旧值，不良会继续。",
      ja: "「レシピ書込み WRITE + VERIFY」が必要。枠だけ変えてもPLCは旧値のまま。",
      en: "You must press Write recipe WRITE + VERIFY. Typing without write leaves the old PLC values.",
    },
    {
      zh: "写入会清漂移。然后检查 X0/X1/X2，再点 M0，再 START。",
      ja: "書込みでドリフト解除。X0/X1/X2確認→M0→START。",
      en: "Write clears the drift. Then check X0/X1/X2, latch M0, START.",
    },
  ],
  run: [
    {
      zh: "批次在跑。看良品/剔除。配方「运行锁定」时不要硬改数字。",
      ja: "バッチ運転中。良品/排出を見る。運転中ロックでは数字を変えない。",
      en: "Batch is running. Watch good/reject. Do not force-edit numbers while Running lock is on.",
    },
    {
      zh: "D101/D102 闪橙框 = 质量漂移。步骤：STOP → 改闪烁项 → 写入配方 → 复位（如需）→ START。",
      ja: "D101/D102の橙点滅=品質ドリフト。STOP→点滅を変更→書込み→必要ならリセット→START。",
      en: "Orange flash on D101/D102 = weight drift. STOP, edit flashing rows, Write recipe, reset if needed, START.",
    },
    {
      zh: "X1 变红 = 安全门。先「清除条件」或点 X1，再点 M0，再 START。",
      ja: "X1が赤=安全扉。条件解除またはX1 → M0 → START。",
      en: "Red X1 = guard. Clear faults or click X1, then M0, then START.",
    },
  ],
};

const NOW: Record<Exclude<GuideId, "done">, I18nText> = {
  power: { zh: "当前：开主电源", ja: "現在：主電源ON", en: "Now: main power ON" },
  connect: { zh: "当前：去 NET 按连接", ja: "現在：NETで接続", en: "Now: connect on NET" },
  "field-estop": { zh: "当前：释放急停，再复位 M0", ja: "現在：非常停止解除→M0", en: "Now: release E-stop, then M0" },
  "field-door": { zh: "当前：先关/清安全门，不要点 M0", ja: "現在：扉を先に解除。M0は後", en: "Now: clear the guard first, not M0" },
  "field-drive": { zh: "当前：先清驱动故障", ja: "現在：ドライブ異常を解除", en: "Now: clear the drive fault" },
  reset: { zh: "当前：点 M0 做安全复位", ja: "現在：M0をリセット", en: "Now: click M0 to latch reset" },
  auto: { zh: "当前：切到 AUTO", ja: "現在：AUTOへ", en: "Now: switch to AUTO" },
  start: { zh: "当前：按 START", ja: "現在：START", en: "Now: press START" },
  "stop-recipe": { zh: "当前：先 STOP，才能改闪烁配方", ja: "現在：先にSTOP。点滅レシピは止めないと変えられない", en: "Now: STOP before editing flashing recipe" },
  "write-recipe": { zh: "当前：改 D101/D102 并写入配方", ja: "現在：D101/D102を書いて書込み", en: "Now: edit D101/D102 and Write recipe" },
  run: { zh: "当前：监视运行。闪烁或 NG 时看下面步骤", ja: "現在：監視。点滅/NGなら下の手順", en: "Now: monitor. If flash or NG, follow the steps" },
};

export function nextGuideStep(
  snapshot: Pick<
    PlcSnapshot,
    | "powered"
    | "connected"
    | "safetyReset"
    | "mode"
    | "running"
    | "completed"
    | "inputs"
    | "attentionDevices"
  >,
): GuideId {
  if (snapshot.completed) return "done";
  if (!snapshot.powered) return "power";
  if (!snapshot.connected) return "connect";
  if (!snapshot.inputs.eStopHealthy) return "field-estop";
  if (!snapshot.inputs.safetyDoorClosed) return "field-door";
  if (!snapshot.inputs.driveHealthy) return "field-drive";
  if (snapshot.attentionDevices.length > 0) {
    return snapshot.running ? "stop-recipe" : "write-recipe";
  }
  if (!snapshot.safetyReset) return "reset";
  if (snapshot.mode !== "auto") return "auto";
  if (!snapshot.running) return "start";
  return "run";
}

/** @deprecated use nextGuideStep */
export function nextStartStep(
  snapshot: Pick<PlcSnapshot, "powered" | "connected" | "safetyReset" | "mode" | "running" | "completed" | "inputs">,
): GuideId {
  return nextGuideStep({ ...snapshot, attentionDevices: [] });
}

export function chainStatus(step: GuideId, id: StartStep["id"]): "done" | "current" | "todo" {
  const order: StartStep["id"][] = ["power", "connect", "reset", "auto", "start"];
  let current: StartStep["id"] = "start";
  if (step === "power") current = "power";
  else if (step === "connect") current = "connect";
  else if (step === "field-estop" || step === "field-door" || step === "field-drive" || step === "reset") {
    current = "reset";
  } else if (step === "auto") current = "auto";
  else if (step === "done" || step === "run" || step === "stop-recipe") current = "start";
  else current = "start";
  const here = order.indexOf(id);
  const now = order.indexOf(current);
  if (step === "done" || step === "run") return "done";
  if (here < now) return "done";
  if (here === now) return "current";
  return "todo";
}

export function tutorialPulseSelector(step: GuideId): string | null {
  switch (step) {
    case "power":
      return '[data-action="power"]';
    case "connect":
      return '[data-view="network"], [data-action="connect"]';
    case "field-estop":
      return '[data-cond="X0"], [data-action="release-estop"], .estop';
    case "field-door":
      return '[data-cond="X1"], [data-action="clear-faults"]';
    case "field-drive":
      return '[data-cond="X2"], [data-action="clear-faults"]';
    case "reset":
      return '[data-action="reset-safety"], [data-cond="M0"]';
    case "auto":
      return '[data-action="mode-auto"]';
    case "start":
      return '[data-action="start"]';
    case "stop-recipe":
      return '[data-action="stop"], .recipe-field.attention';
    case "write-recipe":
      return ".recipe-field.attention, .save-recipe";
    default:
      return null;
  }
}

function pick(text: I18nText, locale: Locale): string {
  return text[locale];
}

export function renderAssistantCoach(locale: Locale, snapshot: PlcSnapshot): string {
  const step = nextGuideStep(snapshot);
  if (step === "done") return "";
  const now = pick(NOW[step], locale);
  const how = HOW[step]
    .map((line, index) => `<li><b>${String(index + 1).padStart(2, "0")}</b><span>${pick(line, locale)}</span></li>`)
    .join("");
  const items = CHAIN.map((item) => {
    const status = chainStatus(step, item.id);
    return `<li class="${status}"><span>${pick(item.title, locale)}</span></li>`;
  }).join("");
  return `
    <section class="live-coach tutorial" id="live-coach">
      <div class="tutorial-head">
        <b>${pick({ zh: "助理逐步教程", ja: "アシスタント手順", en: "Assistant step guide" }, locale)}</b>
        <small>${pick({ zh: "专家/传奇不显示这些步骤", ja: "エキスパート/レジェンドは非表示", en: "Hidden on Expert/Legend" }, locale)}</small>
      </div>
      <ol class="tutorial-steps">${items}</ol>
      <p class="tutorial-now">${now}</p>
      <ol class="tutorial-how">${how}</ol>
    </section>
  `;
}
