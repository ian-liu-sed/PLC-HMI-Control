export type Locale = "zh" | "ja";
export type PlcMode = "manual" | "auto";
export type Protocol = "SLMP_3E" | "MODBUS_TCP";
export type ViewId = "hmi" | "plc" | "network" | "guide";
export type FaultKind = "door" | "overload" | "quality" | "link";

export type SequenceStep = 0 | 10 | 20 | 30 | 40 | 50 | 60 | 90;

export interface BilingualText {
  zh: string;
  ja: string;
}

export interface Recipe {
  speedPpm: number;
  targetWeightMg: number;
  toleranceMg: number;
  rejectPulseMs: number;
  batchTarget: number;
}

export interface Inputs {
  powerHealthy: boolean;
  eStopHealthy: boolean;
  safetyDoorClosed: boolean;
  driveHealthy: boolean;
  infeedSensor: boolean;
  processSensor: boolean;
  inspectSensor: boolean;
  qualityPass: boolean;
}

export interface Outputs {
  feedDrive: boolean;
  processServo: boolean;
  inspectTrigger: boolean;
  rejectGate: boolean;
  towerGreen: boolean;
  towerAmber: boolean;
  towerRed: boolean;
}

export interface PacketTrace {
  id: number;
  atMs: number;
  direction: "TX" | "RX";
  operation: string;
  payload: string;
  latencyMs: number;
  ok: boolean;
}

export interface EventRecord {
  id: number;
  atMs: number;
  level: "info" | "warning" | "alarm" | "success";
  text: BilingualText;
}

export interface AlarmRecord {
  code: number;
  raisedAtMs: number;
  active: boolean;
  text: BilingualText;
}

export interface Metrics {
  total: number;
  good: number;
  rejected: number;
  availabilityPct: number;
  performancePct: number;
  qualityPct: number;
  oeePct: number;
  currentWeightMg: number;
  batchProgressPct: number;
}

export interface DeviceSnapshot {
  X: Record<string, boolean>;
  Y: Record<string, boolean>;
  M: Record<string, boolean>;
  D: Record<string, number>;
}

export interface PlcSnapshot {
  nowMs: number;
  powered: boolean;
  connected: boolean;
  running: boolean;
  completed: boolean;
  safetyReset: boolean;
  mode: PlcMode;
  protocol: Protocol;
  ipAddress: string;
  port: number;
  step: SequenceStep;
  stepElapsedMs: number;
  scanTimeMs: number;
  scanCount: number;
  inputs: Inputs;
  outputs: Outputs;
  recipe: Recipe;
  metrics: Metrics;
  devices: DeviceSnapshot;
  activeAlarm: AlarmRecord | null;
  alarmHistory: AlarmRecord[];
  events: EventRecord[];
  packets: PacketTrace[];
  commLatencyMs: number;
  commErrors: number;
  hmiWatchdogMs: number;
  batchId: string;
}

export interface ActionResult {
  ok: boolean;
  reason?: BilingualText;
}
