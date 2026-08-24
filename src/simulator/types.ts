export type Locale = "zh" | "ja" | "en";
export type PlcMode = "manual" | "auto";
export type Protocol = "SLMP_3E" | "MODBUS_TCP";
export type ViewId = "hmi" | "plc" | "network" | "guide";
export type FaultKind = "door" | "overload" | "quality" | "link" | "remote";
export type CpuFamily = "FX" | "Q";
export type SequenceStep = 0 | 10 | 20 | 30 | 40 | 50 | 60 | 90;

export interface I18nText {
  zh: string;
  ja: string;
  en: string;
}

/** @deprecated use I18nText */
export type BilingualText = I18nText;

export interface CpuProfile {
  family: CpuFamily;
  model: string;
  seriesLabel: string;
  addressing: "octal" | "hex";
  defaultIp: string;
  defaultPort: number;
  defaultProtocol: Protocol;
  scanBaseMs: number;
  watchdogMs: number;
  engineeringTool: string;
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
  linkHealthy: boolean;
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
  text: I18nText;
}

export interface AlarmRecord {
  code: number;
  raisedAtMs: number;
  active: boolean;
  text: I18nText;
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
  SM: Record<string, boolean>;
  SD: Record<string, number>;
}

export interface RemoteStationState {
  id: number;
  equipmentId: string;
  name: I18nText;
  healthy: boolean;
}

export interface MissionScore {
  aborted: boolean;
  completed: boolean;
  passed: boolean;
  qualityPct: number;
  oeePct: number;
  total: number;
  good: number;
  rejected: number;
  incidentsHandled: number;
  score: number;
}

export interface PlcSnapshot {
  nowMs: number;
  missionElapsedMs: number;
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
  cpu: CpuProfile;
  missionId: string;
  remotes: RemoteStationState[];
  incidentsHandled: number;
  attentionDevices: string[];
  result: MissionScore | null;
}

export interface ActionResult {
  ok: boolean;
  reason?: I18nText;
}

export interface MissionIncidentConfig {
  id: string;
  atMs: number;
  kind: FaultKind;
  message: I18nText;
}

export interface RemoteStationConfig {
  id: number;
  equipmentId: string;
  name: I18nText;
}

export interface SimConfig {
  seed?: number;
  family?: CpuFamily;
  cpuModel?: string;
  missionId?: string;
  recipe?: Partial<Recipe>;
  protocol?: Protocol;
  ipAddress?: string;
  port?: number;
  incidents?: MissionIncidentConfig[];
  remotes?: RemoteStationConfig[];
  passQualityPct?: number;
  passOeePct?: number;
}
