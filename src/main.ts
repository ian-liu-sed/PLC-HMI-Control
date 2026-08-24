import "./style.css";
import { localized, PlcLineSimulator } from "./simulator/plc";
import type {
  ActionResult,
  FaultKind,
  Locale,
  SequenceStep,
  ViewId,
} from "./simulator/types";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("#app is required");
const app: HTMLDivElement = appRoot;

const plc = new PlcLineSimulator();
let snapshot = plc.getSnapshot();
let locale: Locale = loadLocale();
let view: ViewId = "hmi";
let toast: { text: string; kind: "error" | "success"; until: number } | null = null;

const STEP_LABELS: Record<SequenceStep, { zh: string; ja: string }> = {
  0: { zh: "待机", ja: "待機" },
  10: { zh: "进料", ja: "供給" },
  20: { zh: "定位", ja: "位置決め" },
  30: { zh: "主工艺", ja: "主工程" },
  40: { zh: "检测", ja: "検査" },
  50: { zh: "分拣", ja: "選別" },
  60: { zh: "计数", ja: "カウント" },
  90: { zh: "批次完成", ja: "バッチ完了" },
};

const ST_CODE = `// FX-style IEC structured text / 参考实现
SafetyOK := X0 AND X1 AND X2;
M0 := SafetyOK AND SafetyReset;

IF NOT M0 THEN
    M20 := FALSE;
    Y0 := FALSE;  // feed drive
    Y1 := FALSE;  // process servo
    D0 := 0;
ELSIF M10 AND StartReq THEN
    M20 := TRUE;
END_IF;

CASE D0 OF
    10: Y0 := TRUE;  IF X3 THEN D0 := 20; END_IF;
    20: Y1 := TRUE;  IF X4 THEN D0 := 30; END_IF;
    30: (* electric process axis *) D0 := 40;
    40: Y2 := TRUE;  IF X5 THEN D0 := 50; END_IF;
    50: Y3 := NOT X6; D0 := 60;
    60: D20 := D20 + 1; D0 := 10;
END_CASE;`;

function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem("fx-line-locale");
    if (stored === "zh" || stored === "ja") return stored;
  } catch {
    // Storage may be disabled; the simulator still works.
  }
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "zh";
}

function t(zh: string, ja: string): string {
  return locale === "zh" ? zh : ja;
}

function esc(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function clock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function eventTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `T+${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function stateLabel(): string {
  if (!snapshot.powered) return t("断电", "電源OFF");
  if (snapshot.activeAlarm) return t("报警", "アラーム");
  if (snapshot.completed) return t("完成", "完了");
  if (snapshot.running) return t("自动运行", "自動運転");
  if (snapshot.safetyReset) return t("就绪", "運転準備");
  return t("等待复位", "リセット待ち");
}

function stateTone(): string {
  if (!snapshot.powered) return "off";
  if (snapshot.activeAlarm) return "alarm";
  if (snapshot.running || snapshot.completed) return "run";
  if (snapshot.safetyReset) return "ready";
  return "warn";
}

function stepLabel(step = snapshot.step): string {
  return localized(STEP_LABELS[step], locale);
}

function render(): void {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "ja";
  document.title = t("FX 产线控制实验室", "FX ライン制御ラボ");

  app.innerHTML = `
    <div class="app-frame">
      ${renderTopbar()}
      <div class="workspace">
        ${renderRail()}
        <main class="main-stage" id="main-content">
          ${renderView()}
        </main>
      </div>
      ${renderFooter()}
    </div>
    ${renderToast()}
  `;
}

function renderTopbar(): string {
  return `
    <header class="topbar">
      <div class="brand-block">
        <div class="brand-mark" aria-hidden="true"><span>FX</span><i></i></div>
        <div>
          <p class="eyebrow">PLC × HMI / CONTROL LAB</p>
          <h1>${t("电动生产线控制", "電動生産ライン制御")}</h1>
        </div>
      </div>
      <div class="top-status" aria-label="${t("系统状态", "システム状態")}">
        <div class="status-pill ${snapshot.connected ? "is-on" : ""}">
          <span class="status-dot"></span>
          <span>${snapshot.connected ? t("通信在线", "通信オンライン") : t("通信离线", "通信オフライン")}</span>
          <b>${snapshot.connected ? `${snapshot.commLatencyMs.toFixed(1)} ms` : "—"}</b>
        </div>
        <div class="status-pill state-${stateTone()}">
          <span class="status-dot"></span><span>${stateLabel()}</span>
          <b>${snapshot.powered ? "CPU RUN" : "CPU STOP"}</b>
        </div>
        <div class="locale-switch" role="group" aria-label="Language">
          <button type="button" data-locale="zh" class="${locale === "zh" ? "active" : ""}">中文</button>
          <button type="button" data-locale="ja" class="${locale === "ja" ? "active" : ""}">日本語</button>
        </div>
      </div>
    </header>
  `;
}

function renderRail(): string {
  const items: Array<{ id: ViewId; index: string; zh: string; ja: string; sub: string }> = [
    { id: "hmi", index: "01", zh: "运行监控", ja: "運転監視", sub: "HMI" },
    { id: "plc", index: "02", zh: "PLC 诊断", ja: "PLC診断", sub: "CPU" },
    { id: "network", index: "03", zh: "通信链路", ja: "通信リンク", sub: "NET" },
    { id: "guide", index: "04", zh: "工程指南", ja: "設計ガイド", sub: "DOC" },
  ];
  return `
    <nav class="side-rail" aria-label="${t("主导航", "メインナビゲーション")}">
      <div class="rail-label">SCREENS</div>
      ${items
        .map(
          (item) => `
          <button type="button" class="rail-item ${view === item.id ? "active" : ""}" data-view="${item.id}" aria-current="${view === item.id ? "page" : "false"}">
            <span class="rail-index">${item.index}</span>
            <span class="rail-copy"><b>${t(item.zh, item.ja)}</b><small>${item.sub}</small></span>
          </button>`,
        )
        .join("")}
      <div class="rail-system">
        <span>${t("扫描", "スキャン")}</span>
        <b>${snapshot.powered ? `${snapshot.scanTimeMs.toFixed(2)} ms` : "—"}</b>
        <i class="mini-bar"><em style="width:${snapshot.powered ? Math.min(100, snapshot.scanTimeMs * 18) : 0}%"></em></i>
      </div>
    </nav>
  `;
}

function renderView(): string {
  switch (view) {
    case "hmi":
      return renderHmi();
    case "plc":
      return renderPlc();
    case "network":
      return renderNetwork();
    case "guide":
      return renderGuide();
  }
}

function renderPageHead(kicker: string, titleZh: string, titleJa: string, descZh: string, descJa: string): string {
  return `
    <section class="page-head">
      <div>
        <p class="eyebrow">${kicker}</p>
        <h2>${t(titleZh, titleJa)}</h2>
        <p>${t(descZh, descJa)}</p>
      </div>
      <div class="page-meta">
        <span>${t("批次", "バッチ")} <b>${esc(snapshot.batchId)}</b></span>
        <span>${t("周期", "サイクル")} <b>${clock(snapshot.nowMs)}</b></span>
      </div>
    </section>
  `;
}

function renderHmi(): string {
  return `
    <div class="screen-enter">
      ${renderPageHead(
        "HMI / OVERVIEW",
        "运行总览",
        "運転概要",
        "以电气 I/O 驱动进料、主工艺、检测与分拣的训练产线。",
        "電気I/Oで供給・主工程・検査・選別を駆動するトレーニングラインです。",
      )}
      ${renderAlarmBanner()}
      <section class="hmi-grid">
        <div class="process-panel panel">
          <div class="panel-head">
            <div><span class="section-no">A</span><h3>${t("工艺流程", "工程フロー")}</h3></div>
            <div class="step-display"><small>STEP / D0</small><strong>${String(snapshot.step).padStart(2, "0")}</strong><span>${stepLabel()}</span></div>
          </div>
          <div class="process-track" role="img" aria-label="${t("生产线状态图", "生産ライン状態図")}">
            ${renderStation("feed", "01", t("电动进料", "電動供給"), [10, 20].includes(snapshot.step))}
            ${renderFlow([20].includes(snapshot.step))}
            ${renderStation("process", "02", t("主工艺轴", "主工程軸"), [20, 30].includes(snapshot.step))}
            ${renderFlow([30, 40].includes(snapshot.step))}
            ${renderStation("inspect", "03", t("在线检测", "インライン検査"), [40].includes(snapshot.step))}
            ${renderFlow([50].includes(snapshot.step))}
            ${renderStation("sort", "04", t("电动分拣", "電動選別"), [50, 60].includes(snapshot.step))}
          </div>
          <div class="process-footer">
            <div><span>${t("当前重量", "現在重量")}</span><strong>${snapshot.metrics.currentWeightMg.toFixed(1)} <small>mg</small></strong></div>
            <div><span>${t("设定速度", "設定速度")}</span><strong>${snapshot.recipe.speedPpm} <small>pcs/min</small></strong></div>
            <div><span>${t("当前判定", "現在判定")}</span><strong class="${snapshot.inputs.qualityPass ? "text-ok" : "text-alarm"}">${snapshot.inputs.qualityPass ? "PASS" : "REJECT"}</strong></div>
          </div>
        </div>
        ${renderKpiStack()}
      </section>
      <section class="lower-grid">
        ${renderControlPanel()}
        ${renderRecipePanel()}
        ${renderEventPanel()}
      </section>
    </div>
  `;
}

function renderAlarmBanner(): string {
  if (!snapshot.activeAlarm) return "";
  return `
    <section class="alarm-banner" role="alert">
      <div class="alarm-icon">!</div>
      <div><span>ACTIVE ALARM · A${snapshot.activeAlarm.code}</span><strong>${esc(localized(snapshot.activeAlarm.text, locale))}</strong></div>
      <button type="button" data-action="ack">${t("确认报警", "アラーム確認")}</button>
    </section>
  `;
}

function renderStation(kind: string, number: string, label: string, active: boolean): string {
  return `
    <div class="station ${active ? "active" : ""}">
      <div class="station-top"><span>${number}</span><i></i></div>
      <div class="machine-art ${kind}">${machineSvg(kind)}</div>
      <div class="station-name"><b>${label}</b><span>${active ? t("动作中", "動作中") : t("待机", "待機")}</span></div>
    </div>
  `;
}

function machineSvg(kind: string): string {
  const common = 'viewBox="0 0 160 118" aria-hidden="true" focusable="false"';
  if (kind === "feed") {
    return `<svg ${common}><path class="metal" d="M43 13h74l-12 42H55z"/><rect class="body" x="52" y="55" width="56" height="40" rx="4"/><path class="accent" d="M65 95h30v12H65z"/><circle class="light" cx="80" cy="73" r="8"/><path class="line" d="M30 107h100"/></svg>`;
  }
  if (kind === "process") {
    return `<svg ${common}><rect class="body" x="30" y="22" width="100" height="78" rx="5"/><rect class="screen" x="45" y="35" width="32" height="25" rx="2"/><circle class="accent" cx="102" cy="48" r="16"/><path class="line" d="M102 32v32M86 48h32M42 83h76M52 100v10M108 100v10"/></svg>`;
  }
  if (kind === "inspect") {
    return `<svg ${common}><path class="body" d="M36 105V39h28V23h32v16h28v66z"/><rect class="screen" x="68" y="31" width="24" height="18"/><path class="accent" d="M57 58h46v38H57z"/><path class="beam" d="M66 62l28 30M94 62L66 92"/><path class="line" d="M22 105h116"/></svg>`;
  }
  return `<svg ${common}><rect class="body" x="30" y="34" width="100" height="63" rx="5"/><path class="metal" d="M42 34l15-20h46l15 20"/><path class="accent" d="M80 45v39M58 64h44"/><path class="line" d="M42 97v13M118 97v13M20 110h120"/><circle class="light" cx="115" cy="49" r="5"/></svg>`;
}

function renderFlow(active: boolean): string {
  return `<div class="flow-link ${active ? "active" : ""}"><i></i><span>›</span></div>`;
}

function renderKpiStack(): string {
  const m = snapshot.metrics;
  return `
    <aside class="kpi-stack">
      <div class="kpi-card primary">
        <span>OEE</span><strong>${pct(m.oeePct)}</strong>
        <div class="ring" style="--progress:${m.oeePct * 3.6}deg"><i>${Math.round(m.oeePct)}</i></div>
      </div>
      <div class="kpi-card"><span>${t("总产量", "総生産数")}</span><strong>${m.total.toLocaleString()}</strong><small>/ ${snapshot.recipe.batchTarget.toLocaleString()} pcs</small><em><i style="width:${m.batchProgressPct}%"></i></em></div>
      <div class="kpi-split">
        <div><span>${t("良品", "良品")}</span><b class="text-ok">${m.good}</b></div>
        <div><span>${t("剔除", "排出")}</span><b class="text-alarm">${m.rejected}</b></div>
      </div>
    </aside>
  `;
}

function renderControlPanel(): string {
  const estopReleased = snapshot.inputs.eStopHealthy;
  return `
    <section class="panel controls-panel">
      <div class="panel-head compact"><div><span class="section-no">B</span><h3>${t("操作台", "操作パネル")}</h3></div><span class="mode-badge">${snapshot.mode.toUpperCase()}</span></div>
      <div class="safety-chain">
        ${condition("X0", t("急停回路", "非常停止回路"), snapshot.inputs.eStopHealthy)}
        ${condition("X1", t("安全门", "安全扉"), snapshot.inputs.safetyDoorClosed)}
        ${condition("X2", t("驱动器", "ドライブ"), snapshot.inputs.driveHealthy)}
        ${condition("M0", t("安全许可", "安全許可"), snapshot.safetyReset)}
      </div>
      <div class="operator-buttons">
        <button type="button" class="op-btn power ${snapshot.powered ? "active" : ""}" data-action="power"><i></i><span>${t("主电源", "主電源")}</span><b>${snapshot.powered ? "ON" : "OFF"}</b></button>
        <button type="button" class="op-btn reset" data-action="reset-safety" ${!snapshot.powered ? "disabled" : ""}><i></i><span>${t("安全复位", "安全リセット")}</span><b>RESET</b></button>
        <button type="button" class="op-btn start" data-action="start" ${!snapshot.powered ? "disabled" : ""}><i></i><span>${t("循环启动", "サイクル起動")}</span><b>START</b></button>
        <button type="button" class="op-btn stop" data-action="stop"><i></i><span>${t("正常停止", "通常停止")}</span><b>STOP</b></button>
      </div>
      <div class="control-bottom">
        <div class="mode-select" role="group" aria-label="${t("运行模式", "運転モード")}">
          <button type="button" data-action="mode-manual" class="${snapshot.mode === "manual" ? "active" : ""}">MANUAL</button>
          <button type="button" data-action="mode-auto" class="${snapshot.mode === "auto" ? "active" : ""}">AUTO</button>
        </div>
        <button type="button" class="estop ${!estopReleased ? "pressed" : ""}" data-action="${estopReleased ? "estop" : "release-estop"}"><i></i><span>${estopReleased ? "EMERGENCY STOP" : "RELEASE / 解除"}</span></button>
      </div>
    </section>
  `;
}

function condition(tag: string, label: string, pass: boolean): string {
  return `<div class="condition ${pass ? "pass" : "fail"}"><i></i><span><b>${tag}</b>${label}</span><em>${pass ? "OK" : "NG"}</em></div>`;
}

function renderRecipePanel(): string {
  const r = snapshot.recipe;
  return `
    <section class="panel recipe-panel">
      <div class="panel-head compact"><div><span class="section-no">C</span><h3>${t("配方参数", "レシピ設定")}</h3></div><span class="lock-state">${snapshot.running ? t("运行锁定", "運転中ロック") : t("可编辑", "編集可")}</span></div>
      <form id="recipe-form" class="recipe-form">
        ${recipeField("speedPpm", "D100", t("生产速度", "生産速度"), r.speedPpm, "pcs/min", 10, 90)}
        ${recipeField("targetWeightMg", "D101", t("目标重量", "目標重量"), r.targetWeightMg, "mg", 100, 1200)}
        ${recipeField("toleranceMg", "D102", t("允许偏差", "許容偏差"), r.toleranceMg, "± mg", 2, 80)}
        ${recipeField("rejectPulseMs", "D103", t("剔除脉冲", "排出パルス"), r.rejectPulseMs, "ms", 40, 500)}
        ${recipeField("batchTarget", "D104", t("批次目标", "バッチ目標"), r.batchTarget, "pcs", 20, 9999)}
        <button type="submit" class="save-recipe" ${snapshot.running ? "disabled" : ""}><span>${t("写入配方", "レシピ書込み")}</span><small>WRITE + VERIFY</small></button>
      </form>
    </section>
  `;
}

function recipeField(name: string, tag: string, label: string, value: number, unit: string, min: number, max: number): string {
  return `
    <label class="recipe-field">
      <span><b>${tag}</b>${label}</span>
      <span class="input-unit"><input name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="1" ${snapshot.running ? "disabled" : ""}/><em>${unit}</em></span>
    </label>
  `;
}

function renderEventPanel(): string {
  return `
    <section class="panel event-panel">
      <div class="panel-head compact"><div><span class="section-no">D</span><h3>${t("事件记录", "イベント履歴")}</h3></div><span>${snapshot.events.length} LOGS</span></div>
      <div class="event-list">
        ${snapshot.events
          .slice(0, 7)
          .map(
            (event) => `<div class="event-row ${event.level}"><i></i><time>${eventTime(event.atMs)}</time><p>${esc(localized(event.text, locale))}</p></div>`,
          )
          .join("")}
      </div>
      <div class="fault-lab">
        <div><b>${t("故障训练", "異常トレーニング")}</b><small>${t("仅改变仿真输入", "模擬入力のみ変更")}</small></div>
        <div class="fault-actions">
          <button type="button" data-fault="door">${t("安全门", "安全扉")}</button>
          <button type="button" data-fault="overload">${t("过载", "過負荷")}</button>
          <button type="button" data-fault="quality">${t("质量漂移", "品質ドリフト")}</button>
          <button type="button" data-fault="link">${t("网络中断", "通信断")}</button>
          <button type="button" data-action="clear-faults" class="clear">${t("清除条件", "条件解除")}</button>
        </div>
      </div>
    </section>
  `;
}

function renderPlc(): string {
  return `
    <div class="screen-enter">
      ${renderPageHead(
        "PLC / DIAGNOSTICS",
        "PLC 扫描与软元件",
        "PLCスキャン・デバイス",
        "用输入映像、安全逻辑、顺序程序和输出刷新解释一个完整扫描周期。",
        "入力イメージ、安全ロジック、シーケンス、出力更新で1スキャンを可視化します。",
      )}
      <section class="plc-overview">
        ${renderCpuModule()}
        ${renderScanCycle()}
        ${renderSequence()}
      </section>
      <section class="plc-lower">
        ${renderDeviceMonitor()}
        <section class="panel code-panel">
          <div class="panel-head compact"><div><span class="section-no">F</span><h3>${t("结构化文本示例", "構造化テキスト例")}</h3></div><span>IEC ST / FX STYLE</span></div>
          <div class="code-file"><span>plc/FX5_LINE_CONTROL.st</span><b>READ ONLY</b></div>
          <pre><code>${esc(ST_CODE)}</code></pre>
          <p class="code-note">${t("完整示例包含上电初始化、安全互锁、步进超时、HMI 心跳和报警锁存。", "完全な例には初期化、安全インターロック、ステップタイムアウト、HMIハートビート、アラームラッチを含みます。")}</p>
        </section>
      </section>
    </div>
  `;
}

function renderCpuModule(): string {
  const lights = [
    ["PWR", snapshot.powered, "green"],
    ["RUN", snapshot.running, "green"],
    ["ERR", Boolean(snapshot.activeAlarm), "red"],
    ["SD", snapshot.connected && snapshot.packets[0]?.direction === "TX", "amber"],
    ["RD", snapshot.connected && snapshot.packets[0]?.direction === "RX", "amber"],
  ] as const;
  return `
    <section class="cpu-module panel">
      <div class="cpu-brand"><span>FX</span><small>CPU / 24VDC I/O</small></div>
      <div class="cpu-body">
        <div class="cpu-lights">${lights.map(([name, on, tone]) => `<div><i class="${on ? `on ${tone}` : ""}"></i><span>${name}</span></div>`).join("")}</div>
        <div class="cpu-screen"><span>SCAN TIME</span><strong>${snapshot.powered ? snapshot.scanTimeMs.toFixed(2) : "0.00"}</strong><small>ms</small></div>
        <div class="terminal-strip">${Array.from({ length: 12 }, (_, i) => `<i>${i < 7 ? `X${i}` : `Y${i - 7}`}</i>`).join("")}</div>
        <div class="ethernet-port ${snapshot.connected ? "linked" : ""}"><span>100/10</span><i></i><b>ETHERNET</b></div>
      </div>
      <div class="cpu-stats">
        <div><span>${t("扫描次数", "スキャン回数")}</span><b>${snapshot.scanCount.toLocaleString()}</b></div>
        <div><span>${t("程序状态", "プログラム状態")}</span><b>${snapshot.running ? "RUN" : "STOP"}</b></div>
      </div>
    </section>
  `;
}

function renderScanCycle(): string {
  const phases = [
    ["01", t("输入刷新", "入力更新"), "X0–X6", "18%"],
    ["02", t("安全逻辑", "安全ロジック"), "M0 / M1", "21%"],
    ["03", t("顺序执行", "シーケンス実行"), "D0 / M20", "43%"],
    ["04", t("输出刷新", "出力更新"), "Y0–Y6", "18%"],
  ];
  return `
    <section class="panel scan-panel">
      <div class="panel-head compact"><div><span class="section-no">E</span><h3>${t("扫描周期", "スキャンサイクル")}</h3></div><span>${snapshot.scanTimeMs.toFixed(2)} ms / AVG</span></div>
      <div class="scan-flow">
        ${phases.map(([no, label, tags, width], index) => `<div class="scan-phase ${snapshot.powered ? "live" : ""}" style="--delay:${index * 0.3}s;--phase:${width}"><span>${no}</span><div><b>${label}</b><small>${tags}</small></div><em>${width}</em></div>`).join("")}
      </div>
      <div class="watchdog"><span>${t("看门狗设定", "ウォッチドッグ設定")} <b>200 ms</b></span><em><i style="width:${snapshot.powered ? Math.min(100, snapshot.scanTimeMs / 2) : 0}%"></i></em><strong>${snapshot.powered ? "NORMAL" : "STOP"}</strong></div>
    </section>
  `;
}

function renderSequence(): string {
  const steps: SequenceStep[] = [10, 20, 30, 40, 50, 60];
  return `
    <section class="panel sequence-panel">
      <div class="panel-head compact"><div><span class="section-no">S</span><h3>${t("顺序步进", "シーケンスステップ")}</h3></div><span>D0 = ${snapshot.step}</span></div>
      <div class="sequence-list">
        ${steps.map((step) => `<div class="sequence-row ${snapshot.step === step ? "active" : ""} ${snapshot.step > step || snapshot.step === 90 ? "done" : ""}"><span>${step}</span><i></i><b>${stepLabel(step)}</b><small>${sequenceCondition(step)}</small></div>`).join("")}
      </div>
    </section>
  `;
}

function sequenceCondition(step: SequenceStep): string {
  const conditions: Partial<Record<SequenceStep, string>> = {
    10: "X3 ON",
    20: "X4 ON",
    30: "T200 DONE",
    40: "X5 ON",
    50: "X6 CHECK",
    60: "D20 + 1",
  };
  return conditions[step] ?? "—";
}

function renderDeviceMonitor(): string {
  const groups = [
    ["X", t("输入", "入力"), snapshot.devices.X],
    ["Y", t("输出", "出力"), snapshot.devices.Y],
    ["M", t("内部继电器", "内部リレー"), snapshot.devices.M],
  ] as const;
  return `
    <section class="panel device-panel">
      <div class="panel-head compact"><div><span class="section-no">I/O</span><h3>${t("软元件监视", "デバイスモニタ")}</h3></div><span>LIVE IMAGE</span></div>
      ${groups.map(([prefix, label, devices]) => `<div class="device-group"><div class="device-title"><b>${prefix}</b><span>${label}</span></div><div class="bit-grid">${Object.entries(devices).map(([tag, value]) => `<div class="bit-cell ${value ? "on" : ""}"><i></i><span>${tag}</span><b>${value ? "1" : "0"}</b></div>`).join("")}</div></div>`).join("")}
      <div class="device-group words"><div class="device-title"><b>D</b><span>${t("数据寄存器", "データレジスタ")}</span></div><div class="word-grid">${Object.entries(snapshot.devices.D).map(([tag, value]) => `<div><span>${tag}</span><b>${value}</b></div>`).join("")}</div></div>
    </section>
  `;
}

function renderNetwork(): string {
  return `
    <div class="screen-enter">
      ${renderPageHead(
        "NETWORK / DATA LINK",
        "HMI—PLC 通信",
        "HMI—PLC通信",
        "把操作请求写入 M/D 软元件，并以批量读取刷新状态；安全回路不经过 HMI。",
        "操作要求をM/Dデバイスへ書込み、バッチ読出しで状態を更新します。安全回路はHMIを経由しません。",
      )}
      ${renderTopology()}
      <section class="network-lower">
        ${renderNetworkConfig()}
        ${renderPacketTrace()}
      </section>
      <section class="network-bottom">
        ${renderTagMap()}
        ${renderProtocolNotes()}
      </section>
    </div>
  `;
}

function renderTopology(): string {
  return `
    <section class="panel topology-panel">
      <div class="panel-head compact"><div><span class="section-no">N</span><h3>${t("控制拓扑", "制御トポロジー")}</h3></div><span>${snapshot.protocol.replace("_", " ")}</span></div>
      <div class="topology">
        ${topologyNode("hmi", "HMI", t("操作与可视化", "操作・可視化"), "192.168.10.20", true)}
        ${networkCable("CAT5e STP", snapshot.connected)}
        ${topologyNode("switch", t("工业交换机", "産業用スイッチ"), "100BASE-TX", "VLAN 10", snapshot.connected)}
        ${networkCable(snapshot.protocol === "SLMP_3E" ? "3E / TCP" : "MODBUS / TCP", snapshot.connected)}
        ${topologyNode("plc", "FX PLC", t("逻辑与数据", "ロジック・データ"), snapshot.ipAddress, snapshot.powered)}
        <div class="io-branch"><span>${t("硬接线 24 VDC", "ハード配線 24 VDC")}</span><i></i></div>
        ${topologyNode("machine", t("电动机构", "電動機構"), "DI / DO / PULSE", t("安全 + 工艺", "安全＋工程"), snapshot.safetyReset)}
      </div>
      <div class="topology-note"><i>!</i><p><b>${t("安全边界", "安全境界")}</b>${t("急停、安全门和驱动许可必须由经过验证的硬件安全回路实现；HMI 只显示状态并发送普通控制请求。", "非常停止、安全扉、ドライブ許可は検証済みハードウェア安全回路で実装します。HMIは状態表示と通常操作要求のみを行います。")}</p></div>
    </section>
  `;
}

function topologyNode(kind: string, title: string, role: string, address: string, online: boolean): string {
  return `<div class="topology-node ${kind} ${online ? "online" : ""}"><div class="node-icon">${nodeSvg(kind)}</div><span class="node-led"></span><b>${title}</b><small>${role}</small><code>${address}</code></div>`;
}

function nodeSvg(kind: string): string {
  if (kind === "hmi") return '<svg viewBox="0 0 72 56" aria-hidden="true"><rect x="4" y="4" width="64" height="42" rx="4"/><path d="M24 52h24M36 46v6"/><rect class="fill" x="11" y="11" width="50" height="27"/></svg>';
  if (kind === "switch") return '<svg viewBox="0 0 72 56" aria-hidden="true"><rect x="5" y="15" width="62" height="28" rx="4"/><path d="M14 24h8v8h-8zM26 24h8v8h-8zM38 24h8v8h-8zM50 24h8v8h-8z"/></svg>';
  if (kind === "plc") return '<svg viewBox="0 0 72 56" aria-hidden="true"><rect x="13" y="3" width="46" height="50" rx="3"/><path d="M19 10h23v15H19zM19 32h34M19 39h34M19 46h34"/><circle class="fill" cx="50" cy="13" r="4"/></svg>';
  return '<svg viewBox="0 0 72 56" aria-hidden="true"><rect x="7" y="20" width="58" height="31" rx="4"/><path d="M17 20l9-14h20l9 14M23 31h26v12H23z"/></svg>';
}

function networkCable(label: string, active: boolean): string {
  return `<div class="network-cable ${active ? "active" : ""}"><span>${label}</span><i><em></em></i><b>↔</b></div>`;
}

function renderNetworkConfig(): string {
  return `
    <section class="panel network-config">
      <div class="panel-head compact"><div><span class="section-no">C</span><h3>${t("连接参数", "接続パラメータ")}</h3></div><span>${snapshot.connected ? "SESSION OPEN" : "SESSION CLOSED"}</span></div>
      <form id="network-form">
        <label><span>${t("协议", "プロトコル")}</span><select name="protocol" ${snapshot.connected ? "disabled" : ""}><option value="SLMP_3E" ${snapshot.protocol === "SLMP_3E" ? "selected" : ""}>SLMP / MC 3E Binary</option><option value="MODBUS_TCP" ${snapshot.protocol === "MODBUS_TCP" ? "selected" : ""}>Modbus TCP</option></select></label>
        <label><span>PLC IP</span><input name="ipAddress" value="${esc(snapshot.ipAddress)}" inputmode="decimal" ${snapshot.connected ? "disabled" : ""}/></label>
        <label><span>TCP PORT</span><input name="port" type="number" min="1" max="65535" value="${snapshot.port}" ${snapshot.connected ? "disabled" : ""}/></label>
        <div class="network-buttons">
          <button type="submit" ${snapshot.connected ? "disabled" : ""}>${t("保存参数", "設定保存")}</button>
          <button type="button" class="${snapshot.connected ? "disconnect" : "connect"}" data-action="${snapshot.connected ? "disconnect" : "connect"}">${snapshot.connected ? t("断开", "切断") : t("连接", "接続")}</button>
        </div>
      </form>
      <dl class="network-health">
        <div><dt>LINK</dt><dd class="${snapshot.connected ? "ok" : ""}">${snapshot.connected ? "100 Mbps" : "DOWN"}</dd></div>
        <div><dt>LATENCY</dt><dd>${snapshot.connected ? `${snapshot.commLatencyMs.toFixed(1)} ms` : "—"}</dd></div>
        <div><dt>WATCHDOG</dt><dd class="${snapshot.hmiWatchdogMs < 3000 ? "ok" : "bad"}">${Math.min(snapshot.hmiWatchdogMs, 9999).toFixed(0)} ms</dd></div>
        <div><dt>ERRORS</dt><dd class="${snapshot.commErrors ? "bad" : ""}">${snapshot.commErrors}</dd></div>
      </dl>
    </section>
  `;
}

function renderPacketTrace(): string {
  return `
    <section class="panel packet-panel">
      <div class="panel-head compact"><div><span class="section-no">T</span><h3>${t("实时帧追踪", "リアルタイムフレーム")}</h3></div><span>500 ms POLL</span></div>
      <div class="packet-head"><span>TIME</span><span>DIR</span><span>OPERATION</span><span>PAYLOAD</span><span>RTT</span></div>
      <div class="packet-list">
        ${snapshot.packets.length ? snapshot.packets.slice(0, 9).map((packet) => `<div class="packet-row ${packet.ok ? "" : "error"}"><time>${eventTime(packet.atMs)}</time><b class="${packet.direction.toLowerCase()}">${packet.direction}</b><span>${esc(packet.operation)}</span><code>${esc(packet.payload)}</code><em>${packet.latencyMs.toFixed(1)} ms</em></div>`).join("") : `<div class="packet-empty">${t("连接后显示通信帧", "接続後に通信フレームを表示")}</div>`}
      </div>
    </section>
  `;
}

function renderTagMap(): string {
  const rows = [
    ["M10", t("自动模式", "自動モード"), "HMI → PLC", "BIT"],
    ["M20", t("循环运行", "サイクル運転"), "HMI ↔ PLC", "BIT"],
    ["D0", t("顺序步", "シーケンスステップ"), "PLC → HMI", "WORD"],
    ["D100–104", t("配方区", "レシピ領域"), "HMI → PLC", "5 WORD"],
    ["D20–23", t("产量与重量", "生産数・重量"), "PLC → HMI", "4 WORD"],
    ["D30", t("当前报警码", "現在アラームコード"), "PLC → HMI", "WORD"],
  ];
  return `
    <section class="panel tag-panel">
      <div class="panel-head compact"><div><span class="section-no">M</span><h3>${t("HMI 标签映射", "HMIタグマップ")}</h3></div><span>16-bit WORD / LE</span></div>
      <table><thead><tr><th>DEVICE</th><th>${t("用途", "用途")}</th><th>${t("方向", "方向")}</th><th>TYPE</th></tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${index === 0 ? "tag" : ""}">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>
    </section>
  `;
}

function renderProtocolNotes(): string {
  return `
    <section class="panel protocol-panel">
      <div class="panel-head compact"><div><span class="section-no">P</span><h3>${t("协议选择", "プロトコル選択")}</h3></div><span>REFERENCE</span></div>
      <div class="protocol-card recommended"><div><span>01</span><b>SLMP / MC 3E</b></div><p>${t("适合直接访问 X/Y/M/D 软元件。示例使用 TCP 二进制帧和用户配置端口 5007。", "X/Y/M/Dデバイスの直接アクセスに適します。例ではTCPバイナリフレームとユーザー設定ポート5007を使用します。")}</p><em>${t("首选：FX5 类 CPU", "推奨：FX5クラスCPU")}</em></div>
      <div class="protocol-card"><div><span>02</span><b>Modbus TCP</b></div><p>${t("适合跨厂商设备。默认端口 502；必须单独维护寄存器映射与字节序。", "マルチベンダ機器に適します。既定ポート502。レジスタマップとバイトオーダーを管理します。")}</p><em>${t("通用集成", "汎用連携")}</em></div>
      <div class="protocol-card"><div><span>03</span><b>RS-485</b></div><p>${t("适合较低速或旧型扩展。需要终端电阻、站号、波特率和奇偶校验一致。", "低速・旧型拡張向け。終端抵抗、局番、ボーレート、パリティを一致させます。")}</p><em>${t("备选链路", "代替リンク")}</em></div>
    </section>
  `;
}

function renderGuide(): string {
  return `
    <div class="screen-enter">
      ${renderPageHead(
        "ENGINEERING / GUIDE",
        "一个 PLC 原理，完整闭环",
        "1つのPLC原理、完全な閉ループ",
        "从电源、输入、逻辑、输出到 HMI 数据，每一层都只有一个明确职责。",
        "電源、入力、ロジック、出力、HMIデータまで、各層の責務を明確にします。",
      )}
      ${renderPrincipleFlow()}
      <section class="guide-grid">
        ${renderHardwareTemplate()}
        ${renderCommissioning()}
      </section>
      ${renderTroubleshooting()}
      <section class="legal-note">
        <div>i</div><p>${t("本项目是独立的教育仿真，不使用厂商标志、专有画面或受版权保护的工程文件。FX 仅用于说明兼容的软元件习惯；实际型号、接线、指令和协议选项必须以采购硬件的最新手册为准。", "本プロジェクトは独立した教育用シミュレーションであり、メーカーのロゴ、専用画面、著作物のプロジェクトファイルを使用しません。FXは互換デバイス表記の説明にのみ使用します。実機の型式、配線、命令、通信オプションは購入機器の最新マニュアルで確認してください。")}</p>
      </section>
    </div>
  `;
}

function renderPrincipleFlow(): string {
  const phases = [
    ["01", t("电源", "電源"), "100–240 VAC / 24 VDC", t("隔离与保护", "絶縁・保護")],
    ["02", t("输入映像", "入力イメージ"), "X0–X6", t("传感器与安全状态", "センサ・安全状態")],
    ["03", t("PLC 逻辑", "PLCロジック"), "M / D / T", t("互锁与顺序", "インターロック・順序")],
    ["04", t("输出刷新", "出力更新"), "Y0–Y6", t("电机、伺服、剔除", "モータ・サーボ・排出")],
    ["05", t("HMI 数据", "HMIデータ"), "Ethernet", t("请求、状态、记录", "要求・状態・記録")],
  ];
  return `<section class="principle-flow">${phases.map((phase, i) => `<div class="principle-step"><span>${phase[0]}</span><i>${i < phases.length - 1 ? "→" : "✓"}</i><b>${phase[1]}</b><code>${phase[2]}</code><small>${phase[3]}</small></div>`).join("")}</section>`;
}

function renderHardwareTemplate(): string {
  const rows = [
    [t("CPU 类别", "CPUクラス"), "FX5 / FX3 style", t("按 I/O、运动轴、内存和通信选型", "I/O、軸数、メモリ、通信で選定")],
    [t("控制电源", "制御電源"), "24 VDC", t("独立断路、浪涌保护、可靠接地", "分岐保護、サージ保護、確実な接地")],
    [t("数字输入", "デジタル入力"), "24 VDC sink/source", t("按 CPU 输入公共端统一 PNP/NPN", "CPUコモンに合わせてPNP/NPNを統一")],
    [t("数字输出", "デジタル出力"), "MT transistor", t("高速动作；感性负载加抑制", "高速動作；誘導負荷にサージ抑制")],
    [t("以太网", "Ethernet"), "100BASE-TX / 10BASE-T", t("100M 使用 Cat5 以上屏蔽线", "100MはCat5以上のシールド線")],
    [t("旧型扩展", "旧型拡張"), "Ethernet adapter / RS-485", t("确认模块、固件和连接数", "モジュール、FW、接続数を確認")],
  ];
  return `
    <section class="panel hardware-panel">
      <div class="panel-head compact"><div><span class="section-no">H</span><h3>${t("电气硬件模板", "電気ハードウェア構成")}</h3></div><span>REFERENCE ONLY</span></div>
      <div class="hardware-table">${rows.map((row) => `<div><span>${row[0]}</span><b>${row[1]}</b><p>${row[2]}</p></div>`).join("")}</div>
    </section>
  `;
}

function renderCommissioning(): string {
  const steps = [
    [t("断电检查", "電源OFF確認"), t("核对 PE、短路保护、端子扭矩与绝缘。", "PE、短絡保護、端子トルク、絶縁を確認。")],
    [t("I/O 点动", "I/Oチェック"), t("逐点验证 X 输入；输出先断开负载。", "X入力を1点ずつ確認；出力負荷は切離す。")],
    [t("安全验证", "安全検証"), t("测量急停和门锁响应，不依赖 HMI。", "非常停止・扉の応答を測定；HMIに依存しない。")],
    [t("空载顺序", "無負荷シーケンス"), t("以低速跟踪 D0 步进和超时。", "低速でD0ステップとタイムアウトを追跡。")],
    [t("通信验收", "通信受入"), t("断网、重连、写入权限和心跳超时。", "通信断、再接続、書込権限、ハートビートを検証。")],
    [t("带料确认", "実ワーク確認"), t("锁定配方版本，记录良率与报警。", "レシピ版を固定し、良率・アラームを記録。")],
  ];
  return `
    <section class="panel commissioning-panel">
      <div class="panel-head compact"><div><span class="section-no">Q</span><h3>${t("调试顺序", "立上げ手順")}</h3></div><span>6 GATES</span></div>
      <ol>${steps.map((step, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><div><b>${step[0]}</b><p>${step[1]}</p></div></li>`).join("")}</ol>
    </section>
  `;
}

function renderTroubleshooting(): string {
  const rows = [
    ["HMI: TIMEOUT", t("网线 / IP / 端口 / 会话设置", "ケーブル / IP / ポート / セッション設定"), t("先 Ping，再看 SD/RD，最后抓帧", "Ping→SD/RD→フレーム確認")],
    ["M0 = 0", t("X0 急停、X1 安全门、X2 驱动许可", "X0非常停止、X1安全扉、X2ドライブ許可"), t("先恢复硬件条件，再按复位", "ハード条件復帰後にリセット")],
    ["D0 FIXED", t("当前步的到位输入或定时器", "現在ステップの完了入力・タイマ"), t("监视 X/T，检查超时报警", "X/Tを監視しタイムアウト確認")],
    ["REJECT ↑", t("D101 目标、D102 容差、传感器校准", "D101目標、D102公差、センサ校正"), t("先看趋势，不直接放宽容差", "トレンド確認、公差を安易に緩和しない")],
  ];
  return `
    <section class="panel trouble-panel">
      <div class="panel-head compact"><div><span class="section-no">!</span><h3>${t("故障定位矩阵", "トラブルシュート表")}</h3></div><span>SYMPTOM → CHECK → ACTION</span></div>
      <div class="trouble-grid">${rows.map((row) => `<div><code>${row[0]}</code><p><span>${t("检查", "確認")}</span>${row[1]}</p><p><span>${t("措施", "対応")}</span>${row[2]}</p></div>`).join("")}</div>
    </section>
  `;
}

function renderFooter(): string {
  return `
    <footer class="app-footer">
      <div><span class="footer-mark">SIM</span><p><b>${t("训练仿真，不是真实机器控制器。", "トレーニング用シミュレーションであり、実機コントローラではありません。")}</b><small>${t("真实投产必须完成风险评估、电气图审查、安全验证和现场验收。", "実稼働にはリスク評価、電気図面レビュー、安全検証、現地受入が必要です。")}</small></p></div>
      <span>FX LINE CONTROL LAB · v1.0</span>
    </footer>
  `;
}

function renderToast(): string {
  if (!toast || toast.until < Date.now()) return "";
  return `<div class="toast ${toast.kind}" role="status"><i>${toast.kind === "success" ? "✓" : "!"}</i><span>${esc(toast.text)}</span></div>`;
}

function handleResult(result: ActionResult): void {
  if (!result.ok && result.reason) {
    toast = { text: localized(result.reason, locale), kind: "error", until: Date.now() + 3600 };
  }
  snapshot = plc.tick(0);
  render();
}

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const localeButton = target.closest<HTMLButtonElement>("[data-locale]");
  if (localeButton) {
    locale = localeButton.dataset.locale as Locale;
    try {
      localStorage.setItem("fx-line-locale", locale);
    } catch {
      // Storage is optional.
    }
    render();
    return;
  }

  const viewButton = target.closest<HTMLButtonElement>("[data-view]");
  if (viewButton) {
    view = viewButton.dataset.view as ViewId;
    render();
    return;
  }

  const faultButton = target.closest<HTMLButtonElement>("[data-fault]");
  if (faultButton) {
    handleResult(plc.injectFault(faultButton.dataset.fault as FaultKind));
    return;
  }

  const actionButton = target.closest<HTMLButtonElement>("[data-action]");
  if (!actionButton || actionButton.disabled) return;
  const action = actionButton.dataset.action;
  const actions: Record<string, () => ActionResult> = {
    power: () => plc.togglePower(),
    connect: () => plc.setConnection(true),
    disconnect: () => plc.setConnection(false),
    "reset-safety": () => plc.resetSafety(),
    "mode-manual": () => plc.setMode("manual"),
    "mode-auto": () => plc.setMode("auto"),
    start: () => plc.start(),
    stop: () => plc.stop(),
    estop: () => plc.emergencyStop(),
    "release-estop": () => plc.releaseEmergencyStop(),
    ack: () => plc.acknowledgeAlarm(),
    "clear-faults": () => plc.clearInjectedFaults(),
  };
  if (action && actions[action]) handleResult(actions[action]());
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const data = new FormData(form);
  if (form.id === "recipe-form") {
    handleResult(
      plc.updateRecipe({
        speedPpm: Number(data.get("speedPpm")),
        targetWeightMg: Number(data.get("targetWeightMg")),
        toleranceMg: Number(data.get("toleranceMg")),
        rejectPulseMs: Number(data.get("rejectPulseMs")),
        batchTarget: Number(data.get("batchTarget")),
      }),
    );
  }
  if (form.id === "network-form") {
    handleResult(
      plc.setNetwork(
        data.get("protocol") === "MODBUS_TCP" ? "MODBUS_TCP" : "SLMP_3E",
        String(data.get("ipAddress") ?? ""),
        Number(data.get("port")),
      ),
    );
  }
});

window.setInterval(() => {
  snapshot = plc.tick(500);
  if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement) return;
  render();
}, 500);

render();
