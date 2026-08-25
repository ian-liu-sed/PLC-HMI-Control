import { BADGES, type BadgeId } from "../game/badges";
import type { CampaignState, DifficultyTier, MissionDef, MissionResult } from "../game/types";
import {
  DIFFICULTY_DETAIL,
  DIFFICULTY_LABEL,
  HOLD_ACTIONS,
  NEGOTIATION_ROUNDS,
  tx,
} from "../game/story";
import { difficultyProfile, MISSIONS } from "../game/missions";
import { HOLD_THRESHOLD } from "../game/campaign";
import type { Locale } from "../simulator/types";

function esc(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function t(locale: Locale, zh: string, ja: string, en: string): string {
  if (locale === "ja") return ja;
  if (locale === "en") return en;
  return zh;
}

function formatHold(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function localeSwitchHtml(locale: Locale): string {
  const opts: Array<[Locale, string]> = [
    ["zh", "中文"],
    ["ja", "日本語"],
  ];
  return `<div class="locale-switch" role="group" aria-label="Language">${opts
    .map(
      ([id, label]) =>
        `<button type="button" data-locale="${id}" class="${locale === id ? "active" : ""}">${label}</button>`,
    )
    .join("")}</div>`;
}

function difficultyPicker(locale: Locale, current: DifficultyTier, compact = false): string {
  const tiers: DifficultyTier[] = [1, 2, 3];
  return `
    <div class="difficulty-picker ${compact ? "compact" : ""}" role="group">
      ${tiers
        .map(
          (tier) => `
          <button type="button" class="diff-btn ${current === tier ? "active" : ""}" data-difficulty="${tier}">
            <b>${esc(tx(DIFFICULTY_LABEL[tier], locale))}</b>
            ${compact ? "" : `<small>${esc(tx(DIFFICULTY_DETAIL[tier], locale))}</small>`}
          </button>`,
        )
        .join("")}
    </div>`;
}

function badgeCriteria(locale: Locale, id: BadgeId): string {
  const criteria: Record<BadgeId, [string, string, string]> = {
    "safety-first": ["处理至少 1 次故障，质量 ≥ 97%", "異常1件以上を復旧、品質 ≥ 97%", "Recover 1+ incident with quality ≥ 97%"],
    "scan-master": ["OEE ≥ 88%，质量 ≥ 98%", "OEE ≥ 88%、品質 ≥ 98%", "OEE ≥ 88% and quality ≥ 98%"],
    "link-keeper": ["专家以上处理 2 次故障，OEE ≥ 80%", "エキスパート以上で異常2件、OEE ≥ 80%", "Expert+: recover 2 incidents with OEE ≥ 80%"],
    "press-commissioner": ["任务 1：质量 ≥ 98%，OEE ≥ 82%", "M1：品質 ≥ 98%、OEE ≥ 82%", "M1: quality ≥ 98%, OEE ≥ 82%"],
    "capsule-specialist": ["任务 2：质量 ≥ 98.5%，OEE ≥ 84%", "M2：品質 ≥ 98.5%、OEE ≥ 84%", "M2: quality ≥ 98.5%, OEE ≥ 84%"],
    "q-line-integrator": ["任务 3：质量 ≥ 98%，OEE ≥ 80%", "M3：品質 ≥ 98%、OEE ≥ 80%", "M3: quality ≥ 98%, OEE ≥ 80%"],
    "blister-specialist": ["任务 4：质量 ≥ 98%，OEE ≥ 83%", "M4：品質 ≥ 98%、OEE ≥ 83%", "M4: quality ≥ 98%, OEE ≥ 83%"],
    "cell-commander": ["任务 5 专家以上：质量 ≥ 98%，OEE ≥ 82%", "M5エキスパート以上：品質 ≥ 98%、OEE ≥ 82%", "M5 Expert+: quality ≥ 98%, OEE ≥ 82%"],
    "campaign-master": ["解锁全部 5 个任务专属徽章", "5つのミッション専用バッジを全解除", "Unlock all 5 mission badges"],
  };
  return t(locale, ...criteria[id]);
}

function missionFocus(locale: Locale, missionId: string): string {
  const focus: Record<string, [string, string, string]> = {
    "M1-press": ["单机安全链与 SLMP 投运", "単機安全チェーンとSLMP立上げ", "Machine safety chain and SLMP startup"],
    "M2-capsule": ["配方锁定与装量漂移恢复", "レシピロックと充填量ドリフト復旧", "Recipe lock and fill-drift recovery"],
    "M3-bottle": ["Q 主站与远程 I/O 链路恢复", "QマスタとリモートI/O復旧", "Q master and remote-I/O recovery"],
    "M4-blister": ["成型—封合顺序与质量窗口", "成形―シール順序と品質ウィンドウ", "Form-seal sequence and quality window"],
    "M5-line": ["单元协同、通信韧性与 OEE", "セル協調、通信耐性、OEE", "Cell coordination, link resilience and OEE"],
  };
  return t(locale, ...(focus[missionId] ?? focus["M1-press"]));
}

function equipmentName(locale: Locale, id: string): string {
  const names: Record<string, [string, string, string]> = {
    "tablet-press": ["旋转压片机", "ロータリー打錠機", "Rotary tablet press"],
    "capsule-filler": ["胶囊充填机", "カプセル充填機", "Capsule filler"],
    "capsule-polisher": ["胶囊抛光机", "カプセルポリッシャ", "Capsule polisher"],
    "metal-detector": ["金属检测", "金属検出", "Metal detector"],
    "pill-counter": ["电子数粒机", "電子計数機", "Pill counter"],
    capping: ["旋盖机", "キャッパー", "Capper"],
    "induction-sealer": ["感应封口机", "誘導シーラ", "Induction sealer"],
    "blister-packer": ["泡罩包装机", "PTP包装機", "Blister packer"],
  };
  const name = names[id];
  return name ? t(locale, ...name) : id;
}

function badgeGrid(locale: Locale, unlocked: Record<string, number>, recent: BadgeId[] = []): string {
  return `<div class="badge-grid">${BADGES.map((badge, index) => {
    const on = Boolean(unlocked[badge.id]);
    const fresh = recent.includes(badge.id);
    return `<article class="badge-card ${on ? "on" : "locked"} ${fresh ? "fresh" : ""}">
      <div class="badge-emblem"><i>${badge.icon}</i><small>${String(index + 1).padStart(2, "0")}</small></div>
      <div class="badge-copy">
        <span>${on ? t(locale, "已解锁", "解除済み", "Unlocked") : t(locale, "未解锁", "未解除", "Locked")}</span>
        <b>${esc(tx(badge.title, locale))}</b>
        <small>${esc(badgeCriteria(locale, badge.id))}</small>
      </div>
      <em aria-hidden="true">${on ? "✓" : "◇"}</em>
    </article>`;
  }).join("")}</div>`;
}

export function renderHub(
  locale: Locale,
  campaign: CampaignState,
  best: Record<string, number>,
  now = Date.now(),
): string {
  const unlocked = BADGES.filter((badge) => campaign.badges[badge.id]).length;
  const cleared = MISSIONS.filter((mission) => (best[mission.id] ?? 0) > 0).length;
  return `
    <div class="campaign-shell">
      <header class="brand-bar">
        <div class="brand">
          <div class="brand-mark">SED</div>
          <div>
            <h1>SED Control Pilot</h1>
            <p>${t(locale, "FX / Q PLC 投运严肃游戏", "FX / Q PLC立上げシリアスゲーム", "Serious game: commission FX & Q PLCs on SED machines")}</p>
          </div>
        </div>
        <div class="brand-actions">
          ${localeSwitchHtml(locale)}
          <a class="ext-link" href="https://sedmachines.com" target="_blank" rel="noreferrer">sedmachines.com</a>
        </div>
      </header>

      <section class="hero">
        <img class="hero-photo" src="/sed-line-hero.jpg" srcset="/sed-line-hero-sm.jpg 720w, /sed-line-hero.jpg 1280w" sizes="(max-width: 800px) 100vw, 1100px" alt="${t(locale, "SED 固体制剂线", "SED固形剤ライン", "SED solid-dose line")}" />
        <div class="hero-copy">
          <p class="eyebrow">FX5U · Q03UDE · Q13UDV</p>
          <h2>${t(locale, "你是控制工程师，不是旁观者", "あなたは制御エンジニアだ", "You are the controls engineer")}</h2>
          <p>${t(
            locale,
            "给 SED 压片机、胶囊机、装瓶线和泡罩机上电、连以太网、复位安全链、写入配方。通信恢复不会自动启动。三次失败会锁线一小时。",
            "SED打錠機、カプセル、ボトル、PTPに電源、Ethernet、安全リセット、レシピ書込み。通信復帰は自動起動しない。3回失敗で1時間ロック。",
            "Power SED presses, capsule fillers, bottle lines and blister packers. Open Ethernet, prove the safety chain, write the recipe. A restored link never auto-starts. Three failures hold the line for an hour.",
          )}</p>
          <div class="actions">
            <button type="button" class="btn-primary" data-open-mission="0">${t(locale, "开始任务 1 · FX 压片", "ミッション1 · FX打錠", "Start Mission 1 · FX press")}</button>
          </div>
        </div>
      </section>

      <section class="campaign-strip panel">
        <div>
          <span class="eyebrow">${t(locale, "战役状态", "キャンペーン", "Campaign")}</span>
          <strong>${esc(tx(DIFFICULTY_LABEL[campaign.difficulty], locale))}</strong>
          <small>${esc(tx(DIFFICULTY_DETAIL[campaign.difficulty], locale))}</small>
        </div>
        ${difficultyPicker(locale, campaign.difficulty, true)}
        <div class="coop-chip">
          <span>${t(locale, "合作", "協力", "Co-ops")}</span>
          <b>${campaign.cooperations}</b>
        </div>
      </section>

      <section class="line-stations panel">
        <h2>${t(locale, "线体设备", "ライン設備", "Line stations")}</h2>
        <p>${t(locale, "点进任务后，这些设备由 FX 机载 PLC 或 Q 线体 PLC 驱动。", "ミッションに入ると、FX機載PLCまたはQラインPLCがこれらの設備を駆動します。", "Inside a mission these stations are driven by an FX machine PLC or a Q line PLC.")}</p>
        <div class="hero-line-track">
          ${MISSIONS.map(
            (mission, index) => `
            <button type="button" class="hero-station family-${mission.family.toLowerCase()}" data-open-mission="${index}">
              <img src="${esc(mission.photo)}" alt="" />
              <span>${mission.family}</span>
              <b>${esc(mission.cpuModel)}</b>
            </button>`,
          ).join("")}
        </div>
      </section>

      <section class="mission-section-head">
        <div>
          <p class="eyebrow">COMMISSIONING ROUTE / 01—05</p>
          <h2 class="missions-title">${t(locale, "任务路线", "ミッションルート", "Mission route")}</h2>
          <p>${t(locale, "从单机 FX 投运到 Q 单元集成；每个任务训练一种可复用的现场能力。", "FX単機立上げからQセル統合へ。各ミッションで再利用できる現場スキルを習得します。", "Progress from an FX machine startup to Q cell integration. Each mission teaches one reusable field skill.")}</p>
        </div>
        <div class="route-summary"><span>${t(locale, "已完成", "完了", "Cleared")}</span><b>${cleared}<small>/05</small></b></div>
      </section>
      <div class="mission-route" aria-label="${t(locale, "任务进度", "ミッション進捗", "Mission progress")}">
        ${MISSIONS.map((mission, index) => `<div class="${best[mission.id] ? "cleared" : ""}"><i>${best[mission.id] ? "✓" : index + 1}</i><span>${mission.family}</span></div>`).join("")}
      </div>
      <section class="mission-grid">
        ${MISSIONS.map((mission, index) => {
          const fails = campaign.failures[mission.id] ?? 0;
          const hold = Math.max(0, (campaign.holds[mission.id] ?? 0) - now);
          const held = fails >= HOLD_THRESHOLD;
          const isCleared = (best[mission.id] ?? 0) > 0;
          const status = held
            ? t(locale, "线体锁定", "ラインロック", "Line hold")
            : isCleared
              ? t(locale, "已通关", "クリア", "Cleared")
              : fails > 0
                ? t(locale, "待重试", "再挑戦", "Retry")
                : t(locale, "可执行", "実行可能", "Ready");
          return `
            <button type="button" class="mission-card family-${mission.family.toLowerCase()} ${held ? "held" : ""} ${isCleared ? "cleared" : ""}" data-open-mission="${index}">
              <div class="mission-card-photo">
                <img src="${esc(mission.photo)}" alt="" />
                <span class="mission-number">${String(index + 1).padStart(2, "0")}</span>
                <em class="mission-status">${status}</em>
              </div>
              <div class="mission-card-body">
                <div class="mission-card-top"><em class="cpu-pill">${mission.family} · ${esc(mission.cpuModel)}</em><code>${mission.id.toUpperCase()}</code></div>
                <h3>${esc(tx(mission.title, locale))}</h3>
                <p>${esc(missionFocus(locale, mission.id))}</p>
                <div class="mission-stats">
                  <span><small>${t(locale, "最高分", "ベスト", "Best")}</small><b>${best[mission.id] ?? "—"}</b></span>
                  <span><small>${t(locale, "设备", "設備", "Stations")}</small><b>${mission.equipment.length}</b></span>
                  <span><small>${t(locale, "失败", "失敗", "Fails")}</small><b>${fails}/${HOLD_THRESHOLD}</b></span>
                </div>
                <div class="mission-enter"><span>${t(locale, "打开任务简报", "ブリーフを開く", "Open mission brief")}</span><b>→</b></div>
                ${hold > 0 ? `<small class="hold-flag">${t(locale, "剩余", "残り", "Left")} ${formatHold(hold)}</small>` : ""}
              </div>
            </button>`;
        }).join("")}
      </section>
      <section class="panel campaign-badges">
        <div class="badge-center-heading">
          <div><p class="eyebrow">ENGINEER QUALIFICATIONS</p><h2>${t(locale, "能力徽章", "スキルバッジ", "Skill badges")}</h2><p>${t(locale, "每枚徽章都有明确的质量、OEE 或故障恢复条件。", "各バッジには品質、OEE、異常復旧の明確な条件があります。", "Every badge has a clear quality, OEE, or recovery condition.")}</p></div>
          <div class="badge-total"><span>${t(locale, "解锁进度", "解除進捗", "Unlocked")}</span><strong>${unlocked}<small>/${BADGES.length}</small></strong></div>
        </div>
        <div class="badge-progress"><i style="width:${(unlocked / BADGES.length) * 100}%"></i></div>
        ${badgeGrid(locale, campaign.badges)}
      </section>
      <p class="campaign-foot">${t(
        locale,
        "训练仿真。急停与安全门不得依赖普通 PLC、HMI 或以太网。",
        "トレーニング用シミュレーション。非常停止と安全扉を通常PLC、HMI、Ethernetに依存させないでください。",
        "Training simulation. Emergency stop and guards must not depend on a standard PLC, HMI, or Ethernet.",
      )}</p>
    </div>`;
}

export function renderBrief(
  locale: Locale,
  mission: MissionDef,
  campaign: CampaignState,
): string {
  const profile = difficultyProfile(mission, campaign.difficulty);
  const estimatedSec = Math.ceil((mission.recipe.batchTarget / mission.recipe.speedPpm) * 60);
  const profileNote = mission.family === "Q"
    ? t(
        locale,
        "Q 系列：十六进制 X/Y，SM/SD 系统软元件，MC 3E 端口 5000，CC-Link 远程站。",
        "Qシリーズ：16進X/Y、SM/SD、MC 3Eポート5000、CC-Link遠隔局。",
        "Q series: hex X/Y, SM/SD system devices, MC 3E port 5000, CC-Link remotes.",
      )
    : t(
        locale,
        "FX 系列：八进制 X/Y，X/Y/M/D，SLMP 3E 端口 5007，机载紧凑型 CPU。",
        "FXシリーズ：8進X/Y、X/Y/M/D、SLMP 3Eポート5007、機械搭載コンパクトCPU。",
        "FX series: octal X/Y, X/Y/M/D, SLMP 3E port 5007, machine-mounted compact CPU.",
      );
  return `
    <div class="campaign-shell">
      <header class="campaign-hero brief">
        <div>
          <p class="eyebrow">${mission.family} · ${esc(mission.cpuModel)}</p>
          <h1>${esc(tx(mission.title, locale))}</h1>
          <p>${esc(tx(mission.briefing, locale))}</p>
        </div>
        ${localeSwitchHtml(locale)}
      </header>
      <section class="brief-layout">
        <div class="brief-visual">
          <img class="brief-photo" src="${esc(mission.photo)}" alt="" />
          <div class="brief-photo-overlay"><span>${t(locale, "任务重点", "ミッション要点", "Mission focus")}</span><strong>${esc(missionFocus(locale, mission.id))}</strong></div>
          <div class="brief-visual-stats">
            <div><span>${t(locale, "批次目标", "バッチ目標", "Batch")}</span><b>${mission.recipe.batchTarget} pcs</b></div>
            <div><span>${t(locale, "预计运行", "予定時間", "Est. run")}</span><b>~${estimatedSec}s</b></div>
            <div><span>${t(locale, "远程站", "遠隔局", "Remotes")}</span><b>${mission.remotes.length}</b></div>
          </div>
        </div>
        <div class="panel brief-console">
          <div class="brief-console-head"><div><span>${mission.family} CPU PROFILE</span><b>${esc(mission.cpuModel)}</b></div><em>${mission.family === "Q" ? "HEX I/O" : "OCTAL I/O"}</em></div>
          <div class="cpu-note"><i>${mission.family}</i><p>${profileNote}</p></div>
          <div class="brief-targets">
            <div><span>${t(locale, "质量门槛", "品質基準", "Quality gate")}</span><b>≥ ${profile.qualityPct}%</b></div>
            <div><span>OEE GATE</span><b>≥ ${profile.oeePct}%</b></div>
            <div><span>${t(locale, "通信端口", "通信ポート", "Port")}</span><b>${mission.family === "Q" ? "5000" : "5007"}</b></div>
          </div>
          <div class="brief-section-head"><span>01</span><div><b>${t(locale, "控制对象", "制御対象", "Controlled equipment")}</b><small>${mission.equipment.length} ${t(locale, "个电动设备", "台の電動設備", "electric stations")}</small></div></div>
          <div class="equipment-chip-grid">${mission.equipment.map((id, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><b>${esc(equipmentName(locale, id))}</b><code>${esc(id)}</code></div>`).join("")}</div>
          ${
            mission.remotes.length
              ? `<div class="brief-section-head"><span>02</span><div><b>CC-Link</b><small>${t(locale, "远程站拓扑", "遠隔局トポロジー", "Remote topology")}</small></div></div><div class="remote-chain">${mission.remotes
                  .map((remote) => `<div><i></i><span>ST${String(remote.id).padStart(2, "0")}</span><b>${esc(tx(remote.name, locale))}</b></div>`)
                  .join("")}</div>`
              : ""
          }
          <div class="brief-section-head"><span>${mission.remotes.length ? "03" : "02"}</span><div><b>${t(locale, "启动许可链", "起動許可チェーン", "Start permissive chain")}</b><small>${t(locale, "必须按顺序完成", "順番に完了", "Complete in order")}</small></div></div>
          <ol class="start-chain">
            <li><span>01</span><b>${t(locale, "主电源", "主電源", "Main power")}</b><small>24 VDC</small></li>
            <li><span>02</span><b>${t(locale, "连接以太网", "Ethernet接続", "Connect Ethernet")}</b><small>${mission.family === "Q" ? "MC 3E" : "SLMP 3E"}</small></li>
            <li><span>03</span><b>${t(locale, "安全复位", "安全リセット", "Safety reset")}</b><small>X0 · X1 · X2 → M0</small></li>
            <li><span>04</span><b>${t(locale, "写入并回读", "書込み・照合", "Write + verify")}</b><small>D100—D104</small></li>
            <li><span>05</span><b>AUTO → START</b><small>M10 · M20</small></li>
          </ol>
          ${
            campaign.difficulty === 1
              ? `<p class="brief-tutorial-note">${t(locale, "助理难度会在 HMI 顶部逐步提示。开局 M0 为 NG 是正常的：先上电、NET 连接，再点 M0 卡片或「安全复位」锁存。专家/传奇不给逐步提示。", "アシスタント難易度はHMI上部で手順を出す。開始時のM0=NGは正常。電源とNET接続の後、M0カードまたは「安全リセット」でラッチ。エキスパート/レジェンドは手順を出さない。", "Assistant mode shows a live start-chain tutorial. M0 starts NG on purpose: power, connect NET, then click the M0 tile or Safety reset. Expert/Legend hide the walkthrough.")}</p>`
              : `<p class="brief-tutorial-note hard">${t(locale, "当前难度不提供逐步教程。安全链锁存、通信恢复后的再启动都要自己完成。", "この難易度では手順教程なし。安全ラッチと通信復帰後の再起動は自分で行う。", "This difficulty has no step tutorial. Latch the safety chain and restart yourself after a restored link.")}</p>`
          }
          <div class="brief-difficulty"><div><span>${t(locale, "时间压力", "時間プレッシャー", "Timed pressure")}</span><b>${t(locale, "任务计时开始后，压力将从 L1 升至 L3；更高难度会缩短升级间隔。", "計時開始後、プレッシャーはL1からL3へ上昇。高難易度ほど間隔が短くなります。", "Once the mission clock starts, pressure rises from L1 to L3. Higher modes shorten each escalation interval.")}</b></div>${difficultyPicker(locale, campaign.difficulty)}</div>
          <div class="actions brief-actions">
            <button type="button" class="btn-primary" data-action="run-mission">${t(locale, "进入 HMI", "HMIへ", "Enter HMI")}</button>
            <button type="button" class="btn-ghost" data-nav="hub">${t(locale, "返回任务", "ミッションへ戻る", "All missions")}</button>
          </div>
        </div>
      </section>
    </div>`;
}

export function renderResult(
  locale: Locale,
  mission: MissionDef,
  result: MissionResult,
  failures: number,
  recent: BadgeId[],
  campaign: CampaignState,
): string {
  const remaining = Math.max(0, HOLD_THRESHOLD - failures);
  return `
    <div class="campaign-shell">
      <header class="campaign-hero ${result.passed ? "pass" : "fail"}">
        <div>
          <p class="eyebrow">${result.passed ? t(locale, "客户满意", "顧客満足", "Client satisfied") : t(locale, "客户失望", "顧客失望", "Client disappointed")}</p>
          <h1>${t(locale, "批次报告", "バッチレポート", "Batch report")}</h1>
          <p>${esc(tx(mission.title, locale))}</p>
        </div>
        ${localeSwitchHtml(locale)}
      </header>
      <section class="result-kpis">
        <div><span>OEE</span><b>${result.oeePct.toFixed(1)}%</b></div>
        <div><span>${t(locale, "质量", "品質", "Quality")}</span><b>${result.qualityPct.toFixed(1)}%</b></div>
        <div><span>${t(locale, "产量", "生産数", "Produced")}</span><b>${result.good}/${result.total}</b></div>
        <div><span>${t(locale, "分数", "スコア", "Score")}</span><b>${result.score}</b></div>
      </section>
      ${
        result.passed
          ? ""
          : `<div class="failure-reminder ${remaining === 0 ? "hold" : ""}">
              <strong>${t(locale, "连续失败", "連続失敗", "Fail streak")} ${failures}/${HOLD_THRESHOLD}</strong>
              <p>${
                remaining === 0
                  ? t(locale, "线体锁定一小时，并进入 CAPA。", "1時間のラインロックとCAPAに入ります。", "The line is held for one hour. Complete CAPA.")
                  : t(locale, `再失败 ${remaining} 次将锁定该线。`, `あと${remaining}回失敗するとロックされます。`, `${remaining} more failure(s) will hold this line.`)
              }</p>
            </div>`
      }
      ${
        recent.length
          ? `<section class="panel"><h3>${t(locale, "新徽章", "新しいバッジ", "New badges")}</h3>${badgeGrid(locale, campaign.badges, recent)}</section>`
          : ""
      }
      <div class="actions">
        <button type="button" class="btn-primary" data-action="retry-mission">${t(locale, "再跑一批", "再バッチ", "Retry batch")}</button>
        <button type="button" class="btn-ghost" data-nav="hub">${t(locale, "返回任务", "ミッションへ戻る", "All missions")}</button>
      </div>
    </div>`;
}

export function renderHold(
  locale: Locale,
  mission: MissionDef,
  remainingMs: number,
  done: Set<number>,
): string {
  const complete = done.size === HOLD_ACTIONS.length;
  const ready = complete && remainingMs <= 0;
  return `
    <div class="campaign-shell">
      <header class="campaign-hero fail">
        <div>
          <p class="eyebrow">${t(locale, "线体锁定", "ラインロック", "Line hold")}</p>
          <h1>${esc(tx(mission.title, locale))}</h1>
          <p>${t(
            locale,
            "三次连续失败触发一小时锁定。先做完 CAPA 清单，等锁定结束再与客户通话。",
            "3回連続失敗で1時間ロック。CAPAを完了し、解除後に顧客通話。",
            "Three consecutive failures trigger a one-hour hold. Finish the CAPA list, wait out the clock, then call the client.",
          )}</p>
        </div>
        ${localeSwitchHtml(locale)}
      </header>
      <section class="hold-clock panel">
        <span>${t(locale, "剩余锁定", "ロック残り", "Hold remaining")}</span>
        <strong id="hold-countdown">${formatHold(remainingMs)}</strong>
      </section>
      <section class="panel recovery-panel">
        <h3>CAPA</h3>
        <div class="recovery-list">
          ${HOLD_ACTIONS.map((action, index) => {
            const on = done.has(index);
            return `<button type="button" class="recovery-action ${on ? "done" : ""}" data-hold-action="${index}" ${on ? "disabled" : ""}>
              <span>${on ? "✓" : index + 1}</span>
              <div><b>${esc(tx(action.title, locale))}</b><small>${esc(tx(action.body, locale))}</small></div>
            </button>`;
          }).join("")}
        </div>
        <div class="actions">
          <button type="button" class="btn-primary" data-action="call-client" ${ready ? "" : "disabled"}>${t(locale, "联系客户", "顧客へ連絡", "Call client")}</button>
          <button type="button" class="btn-ghost" data-nav="hub">${t(locale, "返回任务", "戻る", "All missions")}</button>
        </div>
      </section>
    </div>`;
}

export function renderNegotiate(
  locale: Locale,
  mission: MissionDef,
  step: number,
  trust: number,
  choice: number | null,
  cooperations: number,
): string {
  const round = NEGOTIATION_ROUNDS[step];
  const selected = choice == null ? null : round.choices[choice];
  return `
    <div class="campaign-shell">
      <header class="campaign-hero">
        <div>
          <p class="eyebrow">${step + 1} / ${NEGOTIATION_ROUNDS.length}</p>
          <h1>${t(locale, "客户通话", "顧客通話", "Client call")}</h1>
          <p>${esc(tx(mission.title, locale))}</p>
        </div>
        ${localeSwitchHtml(locale)}
      </header>
      <section class="negotiate-layout">
        <div class="panel">
          <h2>${esc(tx(round.prompt, locale))}</h2>
          <div class="neg-choices">
            ${round.choices
              .map(
                (item, index) => `
              <button type="button" class="negotiation-choice ${choice === index ? "selected" : ""}" data-negotiation-choice="${index}" ${choice == null ? "" : "disabled"}>
                <span>${String.fromCharCode(65 + index)}</span><b>${esc(tx(item.label, locale))}</b>
              </button>`,
              )
              .join("")}
          </div>
          ${
            selected
              ? `<div class="client-feedback ${selected.trust >= 0 ? "positive" : "negative"}"><b>${selected.trust >= 0 ? "+" : ""}${selected.trust}</b><p>${esc(tx(selected.feedback, locale))}</p></div>
                 <button type="button" class="btn-primary" data-action="neg-next">${t(locale, "下一步", "次へ", "Next")}</button>`
              : ""
          }
        </div>
        <aside class="panel trust-card">
          <span>${t(locale, "客户信任", "顧客信頼", "Client trust")}</span>
          <strong>${trust}</strong>
          <div class="trust-meter"><i style="width:${trust}%"></i></div>
          <small>${t(locale, "合作", "協力", "Cooperations")}: ${cooperations}</small>
        </aside>
      </section>
    </div>`;
}

export function renderClient(
  locale: Locale,
  mission: MissionDef,
  ok: boolean,
  trust: number,
  difficulty: DifficultyTier,
): string {
  return `
    <div class="campaign-shell">
      <header class="campaign-hero ${ok ? "pass" : "fail"}">
        <div>
          <p class="eyebrow">${t(locale, "客户信任", "顧客信頼", "Client trust")} ${trust}</p>
          <h1>${ok ? t(locale, "合作继续", "協力継続", "Cooperation continues") : t(locale, "信任不足", "信頼不足", "Not enough trust")}</h1>
          <p>${esc(tx(mission.title, locale))}</p>
        </div>
        ${localeSwitchHtml(locale)}
      </header>
      <section class="panel">
        ${
          ok
            ? `<blockquote>“${t(locale, "按这个 CAPA 走，下一单我们还和你们做。", "このCAPAなら次もお願いします。", "Run that CAPA. We will keep the next order with you.")}”</blockquote>
               <p>${t(locale, "推荐难度", "推奨難易度", "Recommended difficulty")}: <b>${esc(tx(DIFFICULTY_LABEL[difficulty], locale))}</b></p>`
            : `<p>${t(locale, "客户仍不放心。再谈一轮，或回任务板。", "顧客はまだ不安です。再交渉するか、ミッションへ戻ってください。", "The client is not convinced. Negotiate again, or return to the board.")}</p>`
        }
        <div class="actions">
          <button type="button" class="btn-primary" data-action="${ok ? "next-mission" : "retry-neg"}">${
            ok
              ? t(locale, "下一合作", "次の協力", "Next cooperation")
              : t(locale, "再谈", "再交渉", "Negotiate again")
          }</button>
          <button type="button" class="btn-ghost" data-nav="hub">${t(locale, "返回任务", "戻る", "All missions")}</button>
        </div>
      </section>
    </div>`;
}
