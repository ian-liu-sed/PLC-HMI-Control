import { cpuProfile } from "../plc/family";
import type {
  ActionResult,
  AlarmRecord,
  CpuProfile,
  DeviceSnapshot,
  EventRecord,
  FaultKind,
  I18nText,
  Inputs,
  Metrics,
  MissionIncidentConfig,
  MissionScore,
  Outputs,
  PacketTrace,
  PlcMode,
  PlcSnapshot,
  Protocol,
  Recipe,
  RemoteStationState,
  SequenceStep,
  SimConfig,
} from "./types";

const DEFAULT_RECIPE: Recipe = {
  speedPpm: 42,
  targetWeightMg: 500,
  toleranceMg: 15,
  rejectPulseMs: 120,
  batchTarget: 480,
};

const LIMITS = {
  speedPpm: [10, 90],
  targetWeightMg: [100, 1200],
  toleranceMg: [2, 80],
  rejectPulseMs: [40, 500],
  batchTarget: [20, 9999],
} as const;

const ok = (): ActionResult => ({ ok: true });
const fail = (zh: string, ja: string, en = zh): ActionResult => ({
  ok: false,
  reason: { zh, ja, en },
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export class PlcLineSimulator {
  private nowMs = 0;
  private missionElapsedMs = 0;
  private missionStarted = false;
  private powered = false;
  private connected = false;
  private running = false;
  private completed = false;
  private safetyReset = false;
  private mode: PlcMode = "auto";
  private protocol: Protocol = "SLMP_3E";
  private ipAddress = "192.168.10.10";
  private port = 5007;
  private step: SequenceStep = 0;
  private stepElapsedMs = 0;
  private scanCount = 0;
  private recipe: Recipe = { ...DEFAULT_RECIPE };
  private cpu: CpuProfile;
  private missionId = "";
  private incidents: MissionIncidentConfig[] = [];
  private firedIncidents = new Set<string>();
  private remotes: RemoteStationState[] = [];
  private passQualityPct = 0;
  private passOeePct = 0;
  private incidentsHandled = 0;
  private pendingIncidentRecovery = false;
  private result: MissionScore | null = null;
  private inputs: Inputs = {
    powerHealthy: false,
    eStopHealthy: true,
    safetyDoorClosed: true,
    driveHealthy: true,
    infeedSensor: false,
    processSensor: false,
    inspectSensor: false,
    qualityPass: true,
    linkHealthy: true,
  };
  private outputs: Outputs = {
    feedDrive: false,
    processServo: false,
    inspectTrigger: false,
    rejectGate: false,
    towerGreen: false,
    towerAmber: false,
    towerRed: false,
  };
  private total = 0;
  private good = 0;
  private rejected = 0;
  private currentWeightMg = DEFAULT_RECIPE.targetWeightMg;
  private runWindowMs = 0;
  private productiveMs = 0;
  private cycleAccumulatorMs = 0;
  private hmiWatchdogMs = 0;
  private pollAccumulatorMs = 0;
  private commLatencyMs = 3.2;
  private commErrors = 0;
  private packetId = 0;
  private eventId = 0;
  private packets: PacketTrace[] = [];
  private events: EventRecord[] = [];
  private alarmHistory: AlarmRecord[] = [];
  private activeAlarm: AlarmRecord | null = null;
  private qualityDriftMg = 0;
  private randomState: number;
  private batchId = this.makeBatchId();

  constructor(seedOrConfig: number | SimConfig = 0x5ed2026) {
    const config: SimConfig =
      typeof seedOrConfig === "number" ? { seed: seedOrConfig } : seedOrConfig;
    this.randomState = (config.seed ?? 0x5ed2026) >>> 0;
    this.cpu = cpuProfile(config.family ?? "FX", config.cpuModel);
    this.missionId = config.missionId ?? "";
    this.incidents = config.incidents ?? [];
    this.remotes = (config.remotes ?? []).map((remote) => ({
      ...remote,
      healthy: true,
    }));
    this.passQualityPct = config.passQualityPct ?? 0;
    this.passOeePct = config.passOeePct ?? 0;
    this.ipAddress = config.ipAddress ?? this.cpu.defaultIp;
    this.port = config.port ?? this.cpu.defaultPort;
    this.protocol = config.protocol ?? this.cpu.defaultProtocol;
    if (config.recipe) this.recipe = { ...DEFAULT_RECIPE, ...config.recipe };
    this.currentWeightMg = this.recipe.targetWeightMg;
    this.addEvent(
      "info",
      "控制器离线。请接通主电源。",
      "コントローラはオフラインです。主電源を投入してください。",
      "Controller is offline. Apply main power.",
    );
  }

  tick(dtMs: number): PlcSnapshot {
    const dt = clamp(Number.isFinite(dtMs) ? dtMs : 0, 0, 1000);
    this.nowMs += dt;
    if (this.missionStarted && !this.result) this.missionElapsedMs += dt;

    if (this.powered && dt > 0) {
      const scanTime = this.currentScanTime();
      this.scanCount += Math.max(1, Math.floor(dt / scanTime));
    }

    if (this.connected && this.powered) {
      this.hmiWatchdogMs = 0;
      this.pollAccumulatorMs += dt;
      while (this.pollAccumulatorMs >= 500) {
        this.pollAccumulatorMs -= 500;
        this.recordPoll();
      }
    } else {
      this.hmiWatchdogMs += dt;
    }

    if (this.running) {
      this.runWindowMs += dt;
      this.maybeFireIncidents();
      if (this.safetyChainHealthy()) {
        this.productiveMs += dt;
        this.stepElapsedMs += dt;
        this.advanceSequence();
        this.produce(dt);
      } else {
        this.tripForSafety();
      }

      if (!this.connected && this.hmiWatchdogMs >= 3000) {
        this.raiseAlarm(
          3001,
          "HMI 心跳超时，产线受控停止。",
          "HMIハートビートタイムアウト。ラインを制御停止しました。",
          "HMI heartbeat timeout. The line made a controlled stop.",
        );
        this.stopRun();
      }
    }

    this.refreshInputs();
    this.refreshOutputs();
    return this.snapshot();
  }

  togglePower(): ActionResult {
    if (this.powered) {
      this.powered = false;
      this.connected = false;
      this.running = false;
      this.completed = false;
      this.safetyReset = false;
      this.inputs.powerHealthy = false;
      this.step = 0;
      this.stepElapsedMs = 0;
      this.clearOutputs();
      this.addEvent("warning", "主电源已断开。", "主電源を遮断しました。");
      return ok();
    }

    this.powered = true;
    this.inputs.powerHealthy = true;
    this.addEvent("success", "24 V 控制电源正常。", "24 V制御電源は正常です。");
    return ok();
  }

  setConnection(connected: boolean): ActionResult {
    if (connected && !this.powered) {
      return fail("控制器未上电。", "コントローラの電源が入っていません。");
    }
    if (connected === this.connected) return ok();

    this.connected = connected;
    this.hmiWatchdogMs = connected ? 0 : this.hmiWatchdogMs;
    if (connected) {
      this.addPacket("TX", "OPEN", `${this.ipAddress}:${this.port}`, 2.1, true);
      this.addPacket("RX", "ACK", "SESSION READY", 3.4, true);
      this.addEvent(
        "success",
        "HMI 与 PLC 通信已建立。",
        "HMIとPLCの通信を確立しました。",
      );
    } else {
      this.addEvent("warning", "以太网会话已断开。", "Ethernetセッションが切断されました。");
    }
    return ok();
  }

  setNetwork(protocol: Protocol, ipAddress: string, port: number): ActionResult {
    if (this.connected) {
      return fail("请先断开通信再修改参数。", "通信を切断してから設定を変更してください。");
    }
    if (!/^((25[0-5]|2[0-4]\d|1?\d?\d)(\.|$)){4}$/.test(ipAddress)) {
      return fail("IP 地址格式不正确。", "IPアドレスの形式が正しくありません。");
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return fail("端口范围必须为 1–65535。", "ポート番号は1～65535で指定してください。");
    }
    this.protocol = protocol;
    this.ipAddress = ipAddress;
    this.port = port;
    this.addEvent("info", "通信参数已写入配置。", "通信パラメータを設定しました。");
    return ok();
  }

  setMode(mode: PlcMode): ActionResult {
    if (!this.powered || !this.connected) {
      return fail("请先上电并连接 HMI。", "電源投入後、HMIを接続してください。");
    }
    if (this.running) {
      return fail("运行中禁止切换模式。", "運転中はモードを切り替えできません。");
    }
    this.mode = mode;
    this.addPacket("TX", "WRITE", `M10=${mode === "auto" ? 1 : 0}`, 2.8, true);
    this.addPacket("RX", "END", "0000H", 3.1, true);
    this.addEvent(
      "info",
      mode === "auto" ? "已切换到自动模式。" : "已切换到手动模式。",
      mode === "auto" ? "自動モードに切り替えました。" : "手動モードに切り替えました。",
    );
    return ok();
  }

  resetSafety(): ActionResult {
    if (!this.powered) return fail("控制器未上电。", "コントローラの電源が入っていません。");
    if (!this.inputs.eStopHealthy) {
      return fail("请先释放急停按钮。", "非常停止ボタンを解除してください。");
    }
    if (!this.inputs.safetyDoorClosed) {
      return fail("安全门未关闭。", "安全扉が閉じていません。");
    }
    if (!this.inputs.driveHealthy) {
      return fail("驱动器故障仍然存在。", "ドライブ異常が残っています。");
    }
    if (!this.inputs.linkHealthy || !this.remotesHealthy()) {
      return fail(
        "远程站或现场总线仍异常。",
        "遠隔局またはフィールドバス異常が残っています。",
        "A remote station or fieldbus fault is still present.",
      );
    }
    this.safetyReset = true;
    this.clearAlarm();
    this.addPacket("TX", "WRITE", "M0 RESET_REQ", 2.6, true);
    this.addEvent("success", "安全回路复位完成。", "安全回路のリセットが完了しました。");
    return ok();
  }

  start(): ActionResult {
    if (!this.powered) return fail("控制器未上电。", "コントローラの電源が入っていません。");
    if (!this.connected) return fail("HMI 未连接。", "HMIが接続されていません。");
    if (this.mode !== "auto") return fail("请切换到自动模式。", "自動モードに切り替えてください。");
    if (!this.safetyReset || !this.safetyChainHealthy()) {
      return fail("安全条件尚未成立。", "安全条件が成立していません。");
    }
    if (this.activeAlarm) return fail("请先复位当前报警。", "現在のアラームをリセットしてください。");
    if (this.running) return ok();

    if (this.completed) this.resetBatchCounters();
    this.running = true;
    this.missionStarted = true;
    this.completed = false;
    this.result = null;
    this.step = 10;
    this.stepElapsedMs = 0;
    if (this.pendingIncidentRecovery) {
      this.incidentsHandled += 1;
      this.pendingIncidentRecovery = false;
    }
    this.addPacket("TX", "WRITE", "M20=1", 2.7, true);
    this.addPacket("RX", "END", "0000H", 3.0, true);
    this.addEvent("success", "自动循环启动。", "自動サイクルを開始しました。", "Automatic cycle started.");
    return ok();
  }

  stop(): ActionResult {
    if (!this.running) return ok();
    this.addPacket("TX", "WRITE", "M20=0", 2.9, true);
    this.stopRun();
    this.addEvent("warning", "操作员停止了自动循环。", "オペレータが自動サイクルを停止しました。");
    return ok();
  }

  emergencyStop(): ActionResult {
    this.inputs.eStopHealthy = false;
    this.safetyReset = false;
    this.raiseAlarm(
      1001,
      "急停回路断开。所有运动输出立即关闭。",
      "非常停止回路が開放。全モーション出力を停止しました。",
    );
    this.stopRun();
    return ok();
  }

  releaseEmergencyStop(): ActionResult {
    this.inputs.eStopHealthy = true;
    this.addEvent(
      "warning",
      "急停按钮已释放，仍需执行安全复位。",
      "非常停止を解除しました。安全リセットが必要です。",
    );
    return ok();
  }

  acknowledgeAlarm(): ActionResult {
    if (!this.activeAlarm) return ok();
    if (!this.safetyChainHealthy()) {
      return fail("故障条件仍然存在。", "異常条件が解消されていません。");
    }
    this.clearAlarm();
    this.addEvent("info", "报警已确认。", "アラームを確認しました。");
    return ok();
  }

  updateRecipe(patch: Partial<Recipe>): ActionResult {
    if (this.running) {
      return fail("运行中禁止修改配方。", "運転中はレシピを変更できません。");
    }
    const next = { ...this.recipe, ...patch };
    for (const key of Object.keys(LIMITS) as Array<keyof Recipe>) {
      const [min, max] = LIMITS[key];
      if (!Number.isFinite(next[key]) || next[key] < min || next[key] > max) {
        return fail(
          `参数 ${key} 超出允许范围 ${min}–${max}。`,
          `パラメータ ${key} は許容範囲 ${min}～${max} を超えています。`,
        );
      }
    }
    next.speedPpm = Math.round(next.speedPpm);
    next.targetWeightMg = Math.round(next.targetWeightMg);
    next.toleranceMg = Math.round(next.toleranceMg);
    next.rejectPulseMs = Math.round(next.rejectPulseMs);
    next.batchTarget = Math.round(next.batchTarget);
    this.recipe = next;
    this.currentWeightMg = next.targetWeightMg;
    this.qualityDriftMg = 0;
    this.addPacket("TX", "WRITE", "D100..D104 RECIPE", 3.4, true);
    this.addPacket("RX", "VERIFY", "MATCH", 3.8, true);
    this.addEvent("success", "配方写入并回读校验完成。", "レシピの書込み・照合が完了しました。");
    return ok();
  }

  injectFault(kind: FaultKind): ActionResult {
    if (!this.powered) return fail("控制器未上电。", "コントローラの電源が入っていません。");
    this.pendingIncidentRecovery = true;
    switch (kind) {
      case "door":
        this.inputs.safetyDoorClosed = false;
        this.safetyReset = false;
        this.tripForSafety();
        return ok();
      case "overload":
        this.inputs.driveHealthy = false;
        this.safetyReset = false;
        this.tripForSafety();
        return ok();
      case "quality":
        this.qualityDriftMg = this.recipe.toleranceMg * 1.35;
        this.addEvent(
          "warning",
          "模拟称重漂移：不良率将上升。",
          "重量ドリフトを模擬：不良率が上昇します。",
        );
        return ok();
      case "link":
        this.connected = false;
        this.commErrors += 1;
        this.addPacket("RX", "TIMEOUT", "NO RESPONSE", 1000, false);
        this.addEvent("alarm", "模拟网络中断。", "ネットワーク断を模擬しました。", "Simulated network drop.");
        return ok();
      case "remote":
        return this.dropRemoteStation();
    }
  }

  clearInjectedFaults(): ActionResult {
    this.inputs.safetyDoorClosed = true;
    this.inputs.driveHealthy = true;
    this.inputs.linkHealthy = true;
    this.qualityDriftMg = 0;
    this.remotes = this.remotes.map((remote) => ({ ...remote, healthy: true }));
    this.addEvent(
      "info",
      "模拟故障条件已清除；安全故障仍需复位。",
      "模擬異常を解除しました。安全異常はリセットが必要です。",
      "Simulated faults cleared. Safety faults still need reset.",
    );
    return ok();
  }

  abortMission(): ActionResult {
    this.stopRun();
    this.sealResult(true);
    this.addEvent("warning", "任务已中止。", "ミッションを中止しました。", "Mission aborted.");
    return ok();
  }

  getSnapshot(): PlcSnapshot {
    return this.snapshot();
  }

  private currentScanTime(): number {
    return round(this.cpu.scanBaseMs + Math.sin(this.scanCount / 79) * 0.18, 2);
  }

  private remotesHealthy(): boolean {
    return this.remotes.every((remote) => remote.healthy);
  }

  private safetyChainHealthy(): boolean {
    return (
      this.powered &&
      this.inputs.powerHealthy &&
      this.inputs.eStopHealthy &&
      this.inputs.safetyDoorClosed &&
      this.inputs.driveHealthy &&
      this.inputs.linkHealthy &&
      this.remotesHealthy()
    );
  }

  private tripForSafety(): void {
    if (!this.inputs.eStopHealthy) {
      this.raiseAlarm(1001, "急停回路断开。", "非常停止回路が開放しています。", "Emergency-stop circuit open.");
    } else if (!this.inputs.safetyDoorClosed) {
      this.raiseAlarm(1002, "运行中安全门打开。", "運転中に安全扉が開きました。", "Guard opened while running.");
    } else if (!this.inputs.driveHealthy) {
      this.raiseAlarm(2001, "主驱动器过载。", "メインドライブ過負荷です。", "Main drive overload.");
    } else if (!this.inputs.linkHealthy || !this.remotesHealthy()) {
      this.raiseAlarm(
        4001,
        "CC-Link 远程站或现场总线异常。",
        "CC-Link遠隔局またはフィールドバス異常。",
        "CC-Link remote or fieldbus fault.",
      );
    }
    this.safetyReset = false;
    this.stopRun();
  }

  private maybeFireIncidents(): void {
    if (this.activeAlarm || this.pendingIncidentRecovery) return;
    for (const incident of this.incidents) {
      if (this.firedIncidents.has(incident.id)) continue;
      if (this.missionElapsedMs < incident.atMs) continue;
      this.firedIncidents.add(incident.id);
      this.pendingIncidentRecovery = true;
      this.addEvent("warning", incident.message.zh, incident.message.ja, incident.message.en);
      this.injectFault(incident.kind);
      break;
    }
  }

  private dropRemoteStation(): ActionResult {
    if (this.cpu.family !== "Q" || this.remotes.length === 0) {
      this.connected = false;
      this.commErrors += 1;
      this.addEvent(
        "alarm",
        "现场总线中断。",
        "フィールドバスが切断されました。",
        "Fieldbus dropped.",
      );
      this.tripForSafety();
      return ok();
    }
    const live = this.remotes.find((remote) => remote.healthy);
    if (live) live.healthy = false;
    this.inputs.linkHealthy = false;
    this.commErrors += 1;
    this.addPacket("RX", "CC-LINK", `ST${live?.id ?? 1} TIMEOUT`, 800, false);
    this.tripForSafety();
    return ok();
  }

  private sealResult(aborted: boolean): void {
    if (!this.missionId || this.result) return;
    const metrics = this.calculateMetrics();
    const emptyAbort = aborted && this.total === 0;
    const qualityPct = emptyAbort ? 0 : metrics.qualityPct;
    const oeePct = emptyAbort ? 0 : metrics.oeePct;
    const passed =
      !aborted &&
      this.completed &&
      qualityPct >= this.passQualityPct &&
      oeePct >= this.passOeePct;
    const score = Math.max(
      0,
      Math.round(
        oeePct * 8 +
          qualityPct * 4 +
          this.incidentsHandled * 30 -
          (aborted ? 180 : 0),
      ),
    );
    this.result = {
      aborted,
      completed: this.completed,
      passed,
      qualityPct,
      oeePct,
      total: metrics.total,
      good: metrics.good,
      rejected: metrics.rejected,
      incidentsHandled: this.incidentsHandled,
      score,
    };
  }

  private stopRun(): void {
    this.running = false;
    this.step = 0;
    this.stepElapsedMs = 0;
    this.cycleAccumulatorMs = 0;
    this.refreshInputs();
    this.clearOutputs();
  }

  private advanceSequence(): void {
    const phaseMs: Record<Exclude<SequenceStep, 0 | 90>, number> = {
      10: 320,
      20: 260,
      30: 420,
      40: 260,
      50: Math.max(80, this.recipe.rejectPulseMs),
      60: 180,
    };
    if (this.step === 0 || this.step === 90) return;
    const duration = phaseMs[this.step];
    if (this.stepElapsedMs < duration) return;
    this.stepElapsedMs -= duration;
    const next: Record<Exclude<SequenceStep, 0 | 90>, SequenceStep> = {
      10: 20,
      20: 30,
      30: 40,
      40: 50,
      50: 60,
      60: 10,
    };
    this.step = next[this.step];
  }

  private produce(dtMs: number): void {
    const cycleMs = 60_000 / this.recipe.speedPpm;
    this.cycleAccumulatorMs += dtMs;
    while (this.cycleAccumulatorMs >= cycleMs && this.running) {
      this.cycleAccumulatorMs -= cycleMs;
      const noise = (this.nextRandom() + this.nextRandom() + this.nextRandom() - 1.5) * 16;
      this.currentWeightMg = round(this.recipe.targetWeightMg + this.qualityDriftMg + noise, 1);
      const pass = Math.abs(this.currentWeightMg - this.recipe.targetWeightMg) <= this.recipe.toleranceMg;
      this.inputs.qualityPass = pass;
      this.total += 1;
      if (pass) this.good += 1;
      else this.rejected += 1;

      if (this.total >= this.recipe.batchTarget) {
        this.completed = true;
        this.running = false;
        this.step = 90;
        this.stepElapsedMs = 0;
        this.addEvent(
          "success",
          "批次目标完成，产线自动停止。",
          "バッチ目標を完了し、ラインを自動停止しました。",
          "Batch target reached. The line stopped automatically.",
        );
        this.sealResult(false);
      }
    }
  }

  private refreshInputs(): void {
    this.inputs.powerHealthy = this.powered;
    this.inputs.infeedSensor = this.running && (this.step === 10 || this.step === 20);
    this.inputs.processSensor = this.running && (this.step === 30 || this.step === 40);
    this.inputs.inspectSensor = this.running && (this.step === 40 || this.step === 50);
  }

  private refreshOutputs(): void {
    if (!this.running || !this.safetyChainHealthy()) {
      this.clearOutputs();
      this.outputs.towerGreen = this.powered && this.safetyReset && !this.activeAlarm;
      this.outputs.towerAmber = this.powered && !this.safetyReset && !this.activeAlarm;
      this.outputs.towerRed = this.powered && Boolean(this.activeAlarm);
      return;
    }
    this.outputs.feedDrive = this.step === 10 || this.step === 20;
    this.outputs.processServo = this.step === 20 || this.step === 30;
    this.outputs.inspectTrigger = this.step === 40;
    this.outputs.rejectGate = this.step === 50 && !this.inputs.qualityPass;
    this.outputs.towerGreen = true;
    this.outputs.towerAmber = false;
    this.outputs.towerRed = false;
  }

  private clearOutputs(): void {
    this.outputs.feedDrive = false;
    this.outputs.processServo = false;
    this.outputs.inspectTrigger = false;
    this.outputs.rejectGate = false;
    this.outputs.towerGreen = false;
    this.outputs.towerAmber = false;
    this.outputs.towerRed = this.powered && Boolean(this.activeAlarm);
  }

  private recordPoll(): void {
    this.commLatencyMs = round(2.4 + this.nextRandom() * 2.3, 1);
    const map =
      this.cpu.family === "Q" ? "D0 × 24W / M0 × 16B / SM+SD" : "D0 × 24W / M0 × 16B";
    this.addPacket("TX", "BATCH READ", map, this.commLatencyMs, true);
    this.addPacket(
      "RX",
      "DATA",
      `${this.protocol === "SLMP_3E" ? (this.cpu.family === "Q" ? "MC3E" : "3E") : "MB"} / 0000H`,
      this.commLatencyMs,
      true,
    );
  }

  private addPacket(
    direction: PacketTrace["direction"],
    operation: string,
    payload: string,
    latencyMs: number,
    packetOk: boolean,
  ): void {
    this.packets.unshift({
      id: ++this.packetId,
      atMs: this.nowMs,
      direction,
      operation,
      payload,
      latencyMs,
      ok: packetOk,
    });
    if (this.packets.length > 12) this.packets.length = 12;
  }

  private addEvent(
    level: EventRecord["level"],
    zh: string,
    ja: string,
    en = zh,
  ): void {
    this.events.unshift({
      id: ++this.eventId,
      atMs: this.nowMs,
      level,
      text: { zh, ja, en },
    });
    if (this.events.length > 20) this.events.length = 20;
  }

  private raiseAlarm(code: number, zh: string, ja: string, en = zh): void {
    if (this.activeAlarm?.code === code) return;
    if (this.activeAlarm) this.activeAlarm.active = false;
    const alarm: AlarmRecord = {
      code,
      raisedAtMs: this.nowMs,
      active: true,
      text: { zh, ja, en },
    };
    this.activeAlarm = alarm;
    this.alarmHistory.unshift(alarm);
    if (this.alarmHistory.length > 20) this.alarmHistory.length = 20;
    this.addEvent("alarm", `A${code} ${zh}`, `A${code} ${ja}`);
  }

  private clearAlarm(): void {
    if (!this.activeAlarm) return;
    this.activeAlarm.active = false;
    this.activeAlarm = null;
  }

  private calculateMetrics(): Metrics {
    const availability = this.runWindowMs > 0 ? this.productiveMs / this.runWindowMs : 1;
    const expected = (this.productiveMs / 60_000) * this.recipe.speedPpm;
    const performance = expected > 0 ? clamp(this.total / expected, 0, 1) : 1;
    const quality = this.total > 0 ? this.good / this.total : 1;
    return {
      total: this.total,
      good: this.good,
      rejected: this.rejected,
      availabilityPct: round(availability * 100),
      performancePct: round(performance * 100),
      qualityPct: round(quality * 100),
      oeePct: round(availability * performance * quality * 100),
      currentWeightMg: this.currentWeightMg,
      batchProgressPct: round(clamp(this.total / this.recipe.batchTarget, 0, 1) * 100),
    };
  }

  private deviceSnapshot(): DeviceSnapshot {
    const X: Record<string, boolean> = {
      X0: this.inputs.eStopHealthy,
      X1: this.inputs.safetyDoorClosed,
      X2: this.inputs.driveHealthy,
      X3: this.inputs.infeedSensor,
      X4: this.inputs.processSensor,
      X5: this.inputs.inspectSensor,
      X6: this.inputs.qualityPass,
    };
    const Y: Record<string, boolean> = {
      Y0: this.outputs.feedDrive,
      Y1: this.outputs.processServo,
      Y2: this.outputs.inspectTrigger,
      Y3: this.outputs.rejectGate,
      Y4: this.outputs.towerGreen,
      Y5: this.outputs.towerAmber,
      Y6: this.outputs.towerRed,
    };
    const M: Record<string, boolean> = {
      M0: this.safetyReset && this.safetyChainHealthy(),
      M10: this.mode === "auto",
      M20: this.running,
      M21: this.completed,
      M30: this.connected,
      M31: this.hmiWatchdogMs < 3000,
      M100: Math.floor(this.nowMs / 500) % 2 === 0 && this.connected,
    };
    for (const remote of this.remotes) {
      const offset = 0x100 + (remote.id - 1) * 0x10;
      const tag = this.cpu.addressing === "hex" ? offset.toString(16).toUpperCase() : String(offset);
      X[`X${tag}`] = remote.healthy;
      Y[`Y${tag}`] = remote.healthy && this.running;
      M[`M${210 + remote.id}`] = remote.healthy;
    }
    const SM: Record<string, boolean> = {};
    const SD: Record<string, number> = {};
    if (this.cpu.family === "Q") {
      SM.SM0 = Boolean(this.activeAlarm);
      SM.SM203 = this.powered && !this.running;
      SM.SM400 = this.powered;
      SM.SM401 = false;
      SM.SM402 = this.powered && Math.floor(this.nowMs / 100) % 2 === 0;
      SD.SD0 = this.activeAlarm?.code ?? 0;
      SD.SD200 = Math.round(this.currentScanTime() * 10);
      SD.SD201 = Math.round((this.cpu.scanBaseMs - 0.12) * 10);
      SD.SD202 = Math.round((this.cpu.scanBaseMs + 0.35) * 10);
    }
    return {
      X,
      Y,
      M,
      D: {
        D0: this.step,
        D10: this.recipe.speedPpm,
        D11: this.recipe.targetWeightMg,
        D12: this.recipe.toleranceMg,
        D13: this.recipe.rejectPulseMs,
        D20: this.total,
        D21: this.good,
        D22: this.rejected,
        D23: Math.round(this.currentWeightMg * 10),
        D30: this.activeAlarm?.code ?? 0,
        D31: Math.round(this.currentScanTime() * 100),
      },
      SM,
      SD,
    };
  }

  private snapshot(): PlcSnapshot {
    return {
      nowMs: this.nowMs,
      missionElapsedMs: this.missionElapsedMs,
      powered: this.powered,
      connected: this.connected,
      running: this.running,
      completed: this.completed,
      safetyReset: this.safetyReset,
      mode: this.mode,
      protocol: this.protocol,
      ipAddress: this.ipAddress,
      port: this.port,
      step: this.step,
      stepElapsedMs: this.stepElapsedMs,
      scanTimeMs: this.currentScanTime(),
      scanCount: this.scanCount,
      inputs: { ...this.inputs },
      outputs: { ...this.outputs },
      recipe: { ...this.recipe },
      metrics: this.calculateMetrics(),
      devices: this.deviceSnapshot(),
      activeAlarm: this.activeAlarm ? { ...this.activeAlarm } : null,
      alarmHistory: this.alarmHistory.map((alarm) => ({ ...alarm })),
      events: this.events.map((event) => ({ ...event, text: { ...event.text } })),
      packets: this.packets.map((packet) => ({ ...packet })),
      commLatencyMs: this.commLatencyMs,
      commErrors: this.commErrors,
      hmiWatchdogMs: this.hmiWatchdogMs,
      batchId: this.batchId,
      cpu: { ...this.cpu },
      missionId: this.missionId,
      remotes: this.remotes.map((remote) => ({ ...remote, name: { ...remote.name } })),
      incidentsHandled: this.incidentsHandled,
      attentionDevices: this.qualityDriftMg > 0 ? ["D101", "D102"] : [],
      result: this.result ? { ...this.result } : null,
    };
  }

  private resetBatchCounters(): void {
    this.total = 0;
    this.good = 0;
    this.rejected = 0;
    this.runWindowMs = 0;
    this.productiveMs = 0;
    this.currentWeightMg = this.recipe.targetWeightMg;
    this.batchId = this.makeBatchId();
  }

  private makeBatchId(): string {
    const day = new Date().toISOString().slice(2, 10).replaceAll("-", "");
    return `BT-${day}-${String((this.eventId % 99) + 1).padStart(2, "0")}`;
  }

  private nextRandom(): number {
    this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
    return this.randomState / 0x1_0000_0000;
  }
}

export const recipeLimits = LIMITS;
export const defaultRecipe = DEFAULT_RECIPE;

export function localized(text: I18nText, locale: "zh" | "ja" | "en"): string {
  return text[locale] ?? text.en ?? text.zh;
}
