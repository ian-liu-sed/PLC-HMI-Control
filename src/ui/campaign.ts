import { BADGES, type BadgeId } from "../game/badges";
import type { CampaignState, DifficultyTier, MissionDef, MissionResult } from "../game/types";
import {
  DIFFICULTY_DETAIL,
  DIFFICULTY_LABEL,
  HOLD_ACTIONS,
  NEGOTIATION_ROUNDS,
  tx,
} from "../game/story";
import { MISSIONS } from "../game/missions";
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
    ["en", "EN"],
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

function badgeGrid(locale: Locale, unlocked: Record<string, number>, recent: BadgeId[] = []): string {
  return `<div class="badge-grid">${BADGES.map((badge) => {
    const on = Boolean(unlocked[badge.id]);
    const fresh = recent.includes(badge.id);
    return `<div class="badge-card ${on ? "on" : ""} ${fresh ? "fresh" : ""}"><i>${badge.icon}</i><span>${esc(tx(badge.title, locale))}</span></div>`;
  }).join("")}</div>`;
}

export function renderHub(
  locale: Locale,
  campaign: CampaignState,
  best: Record<string, number>,
  now = Date.now(),
): string {
  const unlocked = BADGES.filter((badge) => campaign.badges[badge.id]).length;
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
        <img class="hero-photo" src="./sed-line-hero.jpg" alt="${t(locale, "SED 固体制剂线", "SED固形剤ライン", "SED solid-dose line")}" />
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

      <h2 class="missions-title">${t(locale, "任务", "ミッション", "Missions")}</h2>
      <section class="mission-grid">
        ${MISSIONS.map((mission, index) => {
          const fails = campaign.failures[mission.id] ?? 0;
          const hold = Math.max(0, (campaign.holds[mission.id] ?? 0) - now);
          const held = fails >= HOLD_THRESHOLD;
          return `
            <button type="button" class="mission-card family-${mission.family.toLowerCase()} ${held ? "held" : ""}" data-open-mission="${index}">
              <img src="${esc(mission.photo)}" alt="" />
              <div>
                <em class="cpu-pill">${mission.family} · ${esc(mission.cpuModel)}</em>
                <h2>${esc(tx(mission.title, locale))}</h2>
                <p>${esc(tx(mission.subtitle, locale))}</p>
                <div class="mission-meta">
                  <span>${t(locale, "最高分", "ベスト", "Best")} ${best[mission.id] ?? "—"}</span>
                  <span>${held ? t(locale, "线体锁定", "ラインロック", "Line hold") : `${fails}/${HOLD_THRESHOLD}`}</span>
                </div>
                ${hold > 0 ? `<small class="hold-flag">${t(locale, "剩余", "残り", "Left")} ${formatHold(hold)}</small>` : ""}
              </div>
            </button>`;
        }).join("")}
      </section>
      <section class="panel campaign-badges">
        <div class="badge-center-heading">
          <h3>${t(locale, "徽章", "バッジ", "Badges")}</h3>
          <strong>${unlocked}/${BADGES.length}</strong>
        </div>
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
        <img class="brief-photo" src="${esc(mission.photo)}" alt="" />
        <div class="panel">
          <p class="cpu-note">${profileNote}</p>
          <h3>${t(locale, "设备", "設備", "Equipment")}</h3>
          <ul>${mission.equipment.map((id) => `<li><code>${esc(id)}</code></li>`).join("")}</ul>
          ${
            mission.remotes.length
              ? `<h3>CC-Link</h3><ol>${mission.remotes
                  .map((remote) => `<li>ST${remote.id} ${esc(tx(remote.name, locale))}</li>`)
                  .join("")}</ol>`
              : ""
          }
          <h3>${t(locale, "操作链", "操作チェーン", "Start chain")}</h3>
          <ol class="start-chain">
            <li>${t(locale, "主电源", "主電源", "Main power")}</li>
            <li>${t(locale, "保存并连接以太网", "Ethernetを保存して接続", "Save and connect Ethernet")}</li>
            <li>${t(locale, "确认 X0/X1/X2，安全复位", "X0/X1/X2確認、安全リセット", "Prove X0/X1/X2, safety reset")}</li>
            <li>${t(locale, "写入配方并回读", "レシピ書込み・照合", "Write and verify recipe")}</li>
            <li>AUTO → START</li>
          </ol>
          ${difficultyPicker(locale, campaign.difficulty, true)}
          <div class="actions">
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
