import { describe, expect, it } from "vitest";
import { evaluateBadges } from "../src/game/badges";
import {
  HOLD_THRESHOLD,
  failureCount,
  recordOutcome,
  type CampaignState,
} from "../src/game/campaign";
import { MISSIONS, missionSimConfig } from "../src/game/missions";
import { PlcLineSimulator } from "../src/simulator/plc";

function blankCampaign(): CampaignState {
  return { failures: {}, holds: {}, badges: {}, cooperations: 0, difficulty: 1 };
}

function arm(plc: PlcLineSimulator): void {
  expect(plc.togglePower().ok).toBe(true);
  expect(plc.setConnection(true).ok).toBe(true);
  expect(plc.resetSafety().ok).toBe(true);
  expect(plc.start().ok).toBe(true);
}

describe("CPU families", () => {
  it("uses FX defaults for the original lab constructor", () => {
    const plc = new PlcLineSimulator(1);
    const snap = plc.getSnapshot();
    expect(snap.cpu.family).toBe("FX");
    expect(snap.cpu.model).toBe("FX5U");
    expect(snap.port).toBe(5007);
    expect(snap.devices.SM).toEqual({});
    expect(snap.ipAddress).toBe("192.168.10.10");
  });

  it("exposes Q SM/SD, MC port 5000 and CC-Link remotes", () => {
    const mission = MISSIONS.find((item) => item.id === "M3-bottle");
    expect(mission).toBeTruthy();
    const plc = new PlcLineSimulator(missionSimConfig(mission!, 1, 9));
    plc.togglePower();
    const snap = plc.getSnapshot();
    expect(snap.cpu.family).toBe("Q");
    expect(snap.cpu.model).toBe("Q03UDE");
    expect(snap.port).toBe(5000);
    expect(snap.devices.SM.SM400).toBe(true);
    expect(snap.devices.SD.SD200).toBeGreaterThan(0);
    expect(snap.remotes).toHaveLength(4);
    expect(snap.devices.X.X100).toBe(true);
  });
});

describe("Q remote station trip", () => {
  it("drops motion and refuses auto-restart until the station is healthy and reset", () => {
    const mission = MISSIONS.find((item) => item.id === "M3-bottle")!;
    const plc = new PlcLineSimulator(missionSimConfig(mission, 2, 3));
    arm(plc);
    plc.tick(200);
    expect(plc.injectFault("remote").ok).toBe(true);
    let snap = plc.getSnapshot();
    expect(snap.running).toBe(false);
    expect(snap.outputs.feedDrive).toBe(false);
    expect(snap.activeAlarm?.code).toBe(4001);
    expect(plc.start().ok).toBe(false);
    expect(plc.resetSafety().ok).toBe(false);
    plc.clearInjectedFaults();
    expect(plc.resetSafety().ok).toBe(true);
    expect(plc.start().ok).toBe(true);
    snap = plc.getSnapshot();
    expect(snap.running).toBe(true);
    expect(snap.incidentsHandled).toBeGreaterThanOrEqual(1);
  });
});

describe("mission scoring", () => {
  it("passes a quiet FX batch that meets quality and OEE windows", () => {
    const mission = MISSIONS.find((item) => item.id === "M1-press")!;
    const config = missionSimConfig(mission, 1, 42);
    config.incidents = [];
    const plc = new PlcLineSimulator(config);
    arm(plc);
    for (let i = 0; i < 900; i += 1) plc.tick(100);
    const snap = plc.getSnapshot();
    expect(snap.completed).toBe(true);
    expect(snap.result).not.toBeNull();
    expect(snap.result?.passed).toBe(true);
  });

  it("fails an aborted mission", () => {
    const mission = MISSIONS.find((item) => item.id === "M1-press")!;
    const plc = new PlcLineSimulator(missionSimConfig(mission, 1, 5));
    arm(plc);
    plc.tick(200);
    expect(plc.abortMission().ok).toBe(true);
    expect(plc.getSnapshot().result?.passed).toBe(false);
    expect(plc.getSnapshot().result?.aborted).toBe(true);
  });
});

describe("campaign hold", () => {
  it("locks a line after three failures", () => {
    let state = blankCampaign();
    state = recordOutcome(state, "M1-press", false, 1_000);
    state = recordOutcome(state, "M1-press", false, 2_000);
    state = recordOutcome(state, "M1-press", false, 3_000);
    expect(failureCount(state, "M1-press")).toBe(HOLD_THRESHOLD);
    expect(state.holds["M1-press"]).toBe(3_000 + 60 * 60 * 1000);
  });
});

describe("badges", () => {
  it("awards the press badge on a strong M1 pass", () => {
    const earned = evaluateBadges(
      "M1-press",
      {
        aborted: false,
        completed: true,
        passed: true,
        qualityPct: 99.2,
        oeePct: 90,
        total: 40,
        good: 40,
        rejected: 0,
        incidentsHandled: 1,
        score: 900,
      },
      1,
      [],
    );
    expect(earned).toContain("press-commissioner");
    expect(earned).toContain("safety-first");
  });
});
