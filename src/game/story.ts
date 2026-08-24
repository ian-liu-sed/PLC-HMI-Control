import type { I18nText, Locale } from "../simulator/types";
import type { DifficultyTier } from "./types";

export function tx(text: I18nText, locale: Locale): string {
  return text[locale];
}

export const DIFFICULTY_LABEL: Record<DifficultyTier, I18nText> = {
  1: { zh: "助理", ja: "アシスタント", en: "Assistant" },
  2: { zh: "专家", ja: "エキスパート", en: "Expert" },
  3: { zh: "传奇", ja: "レジェンド", en: "Legend" },
};

export const DIFFICULTY_DETAIL: Record<DifficultyTier, I18nText> = {
  1: {
    zh: "一次过程扰动。通过窗口较宽。适合第一次走通上电—通信—复位—启动。",
    ja: "工程外乱は1回。合格窓は広め。電源—通信—リセット—起動の習得向け。",
    en: "One process disturbance and a wider pass window. Learn power, link, reset, start.",
  },
  2: {
    zh: "多重扰动，含安全门或 CC-Link 远程站。配方与复位必须分开做对。",
    ja: "複合外乱。安全扉またはCC-Link遠隔局を含む。レシピとリセットを分けて実施。",
    en: "Stacked disturbances, including a guard or CC-Link remote. Recipe and reset stay separate.",
  },
  3: {
    zh: "更紧的质量/OEE 窗，外加网络中断。通信恢复后必须人工再启动。",
    ja: "品質/OEE窓が狭い。通信断あり。復帰後は手動再起動が必要。",
    en: "Tighter quality/OEE windows plus a network drop. A restored link is not a restart.",
  },
};

export const HOLD_ACTIONS: Array<{ title: I18nText; body: I18nText }> = [
  {
    title: { zh: "隔离能量", ja: "エネルギー隔離", en: "Isolate energy" },
    body: {
      zh: "确认急停硬件回路断开危险能量，不依赖 HMI 位。",
      ja: "非常停止のハード回路で危険エネルギーを遮断。HMIビットに依存しない。",
      en: "Confirm the hardware e-stop removes hazardous energy. Do not trust an HMI bit.",
    },
  },
  {
    title: { zh: "核对 I/O 映像", ja: "I/Oイメージ照合", en: "Prove the I/O image" },
    body: {
      zh: "现场传感器与 X 映像、执行器与 Y 映像逐点对照。",
      ja: "フィールドセンサとX、アクチュエータとYを1点ずつ照合。",
      en: "Walk field sensors against the X image and actuators against Y, point by point.",
    },
  },
  {
    title: { zh: "配方写后回读", ja: "レシピ照合", en: "Write and verify recipe" },
    body: {
      zh: "停机写入 D100–D104，确认回读一致后再允许启动。",
      ja: "停止中にD100–D104を書き、照合一致後にのみ起動を許可。",
      en: "Write D100–D104 while stopped and prove the read-back matches before start is legal.",
    },
  },
  {
    title: { zh: "通信与远程站", ja: "通信・遠隔局", en: "Link and remotes" },
    body: {
      zh: "检查 HMI 心跳翻转；Q 任务核对 CC-Link 各站。恢复不等于启动。",
      ja: "HMIハートビート変化を確認。Q任務ではCC-Link各局を確認。復帰≠起動。",
      en: "Prove the HMI heartbeat toggles. On Q missions, poll every CC-Link station. Restore ≠ start.",
    },
  },
  {
    title: { zh: "CAPA 记录", ja: "CAPA記録", en: "CAPA record" },
    body: {
      zh: "记录根因、纠正措施和客户通知，再申请解除线体锁定。",
      ja: "原因、是正、顧客通知を記録し、ラインロック解除を申請。",
      en: "Record root cause, correction, and customer notice before asking to lift the line hold.",
    },
  },
];

export interface NegotiationChoice {
  label: I18nText;
  feedback: I18nText;
  trust: number;
}

export interface NegotiationRound {
  prompt: I18nText;
  choices: NegotiationChoice[];
}

export const NEGOTIATION_ROUNDS: NegotiationRound[] = [
  {
    prompt: {
      zh: "客户问：批次为什么停？你们有没有隐瞒？",
      ja: "顧客：なぜバッチが止まったのか。隠していないか。",
      en: "The client asks why the batch stopped — and whether anything was hidden.",
    },
    choices: [
      {
        label: {
          zh: "公开扫描日志、报警码和安全链状态。",
          ja: "スキャンログ、アラーム、安全チェーンを開示する。",
          en: "Share scan logs, alarm codes, and the safety-chain state.",
        },
        feedback: {
          zh: "透明让质量部门愿意继续谈。",
          ja: "透明性が品質部門の信頼を戻す。",
          en: "Transparency keeps QA in the conversation.",
        },
        trust: 18,
      },
      {
        label: {
          zh: "只说“小故障，马上好”。",
          ja: "「軽い不具合ですぐ直る」とだけ言う。",
          en: "Call it a small glitch that will be fine in a minute.",
        },
        feedback: {
          zh: "客户认为你们在淡化偏差。",
          ja: "逸脱を過小評価していると思われる。",
          en: "They hear a deviation being minimised.",
        },
        trust: -14,
      },
      {
        label: {
          zh: "把责任推给操作员手误。",
          ja: "オペレータミスに責任を転嫁する。",
          en: "Blame the operator and stop there.",
        },
        feedback: {
          zh: "没有系统原因，合作关系降温。",
          ja: "システムの原因がなく、関係が冷える。",
          en: "No system cause, no trust.",
        },
        trust: -20,
      },
    ],
  },
  {
    prompt: {
      zh: "他们要一份可验证的恢复计划。",
      ja: "検証可能な復旧計画を求めている。",
      en: "They want a verifiable recovery plan.",
    },
    choices: [
      {
        label: {
          zh: "I/O 点检、配方回读、心跳/远程站测试、再空载步进。",
          ja: "I/O点検、レシピ照合、ハートビート/遠隔局、無負荷ステップ。",
          en: "I/O prove-out, recipe verify, heartbeat/remote test, then an unloaded sequence.",
        },
        feedback: {
          zh: "这是工程语言，客户点头。",
          ja: "エンジニアリングの言葉として通る。",
          en: "That is engineering language. They nod.",
        },
        trust: 22,
      },
      {
        label: {
          zh: "承诺今晚加班把参数放宽。",
          ja: "今夜パラメータを緩めると約束する。",
          en: "Promise to loosen the process window overnight.",
        },
        feedback: {
          zh: "放宽容差不是纠正措施。",
          ja: "公差緩和は是正措置ではない。",
          en: "Widening tolerance is not a corrective action.",
        },
        trust: -12,
      },
      {
        label: {
          zh: "先发货，偏差明年再关。",
          ja: "まず出荷し、逸脱は来年閉じる。",
          en: "Ship now and close the deviation next year.",
        },
        feedback: {
          zh: "这会直接失去客户。",
          ja: "これでは顧客を失う。",
          en: "That loses the account.",
        },
        trust: -24,
      },
    ],
  },
  {
    prompt: {
      zh: "最后一轮：下次如何证明不会再发？",
      ja: "最終：再発防止をどう証明するか。",
      en: "Last round: how will you prove this will not repeat?",
    },
    choices: [
      {
        label: {
          zh: "锁定配方版本、通信验收记录、安全回路与远程站健康进批记录。",
          ja: "レシピ版固定、通信受入記録、安全回路と遠隔局の健全性をバッチ記録へ。",
          en: "Lock the recipe revision, keep comms FAT records, and log safety plus remote health with the batch.",
        },
        feedback: {
          zh: "可审计。信任回升。",
          ja: "監査可能。信頼が戻る。",
          en: "Auditable. Trust returns.",
        },
        trust: 20,
      },
      {
        label: {
          zh: "加一张 HMI 提示就算培训。",
          ja: "HMIメッセージを1枚足して教育完了とする。",
          en: "Add one HMI popup and call it training.",
        },
        feedback: {
          zh: "提示不能代替联锁。",
          ja: "メッセージはインターロックの代わりにならない。",
          en: "A message is not an interlock.",
        },
        trust: -10,
      },
      {
        label: {
          zh: "保证“我们下次小心一点”。",
          ja: "「次回気をつけます」とだけ約束。",
          en: "Promise to be more careful next time.",
        },
        feedback: {
          zh: "没有系统控制。",
          ja: "システム管理がない。",
          en: "No system control.",
        },
        trust: -16,
      },
    ],
  },
];

export const NEGOTIATION_PASS = 75;
