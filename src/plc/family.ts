import type { CpuFamily, CpuProfile, Protocol } from "../simulator/types";

export const FX_CPU: CpuProfile = {
  family: "FX",
  model: "FX5U",
  seriesLabel: "FX",
  addressing: "octal",
  defaultIp: "192.168.10.10",
  defaultPort: 5007,
  defaultProtocol: "SLMP_3E",
  scanBaseMs: 2.35,
  watchdogMs: 200,
  engineeringTool: "GX Works3",
};

export const Q03UDE_CPU: CpuProfile = {
  family: "Q",
  model: "Q03UDE",
  seriesLabel: "Q",
  addressing: "hex",
  defaultIp: "192.168.10.11",
  defaultPort: 5000,
  defaultProtocol: "SLMP_3E",
  scanBaseMs: 0.98,
  watchdogMs: 200,
  engineeringTool: "GX Works2",
};

export const Q13UDV_CPU: CpuProfile = {
  ...Q03UDE_CPU,
  model: "Q13UDV",
  scanBaseMs: 0.79,
};

export function cpuProfile(family: CpuFamily, model?: string): CpuProfile {
  if (family === "Q") {
    if (model === "Q13UDV") return { ...Q13UDV_CPU };
    return { ...Q03UDE_CPU, ...(model ? { model } : {}) };
  }
  return { ...FX_CPU, ...(model ? { model } : {}) };
}

export function protocolLabel(protocol: Protocol, family: CpuFamily): string {
  if (protocol === "MODBUS_TCP") return "Modbus TCP";
  return family === "Q" ? "MC 3E Binary" : "SLMP / MC 3E Binary";
}
