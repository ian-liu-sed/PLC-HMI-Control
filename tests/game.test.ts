import { describe, expect, it } from "vitest";
import { evaluateBadges } from "../src/game/badges";
import {
  HOLD_THRESHOLD,
  failureCount,
  recordOutcome,
  type CampaignState,
} from "../src/game/campaign";
import {
  MISSIONS,
  difficultyProfile,
  missionPressure,
  missionSimConfig,
  pressureThresholds,
} from "../src/game/missions";
import { PlcLineSimulator } from "../src/simulator/plc";
import { chainStatus, nextGuideStep } from "../src/game/tutorial";

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

describe("timed mission pressure", () => {
  it("raises pressure from L1 to L3 and accelerates the harder modes", () => {
    expect(missionPressure(1, 0).level).toBe(1);
    expect(missionPressure(1, 18_000).level).toBe(2);
    expect(missionPressure(1, 36_000).level).toBe(3);
    expect(pressureThresholds(3)[0]).toBeLessThan(pressureThresholds(1)[0]);
    expect(pressureThresholds(3)[1]).toBeLessThan(pressureThresholds(1)[1]);
  });

  it("schedules operational incidents at each pressure rise", () => {
    const mission = MISSIONS.find((item) => item.id === "M3-bottle")!;
    const profile = difficultyProfile(mission, 3);
    const [levelTwoAt, levelThreeAt] = pressureThresholds(3);
    expect(profile.incidents).toContainEqual(
      expect.objectContaining({ atMs: levelTwoAt, kind: "quality" }),
    );
    expect(profile.incidents).toContainEqual(
      expect.objectContaining({ atMs: levelThreeAt, kind: "remote" }),
    );
  });

  it("fires the first pressure incident from mission time, not page idle time", () => {
    const mission = MISSIONS.find((item) => item.id === "M3-bottle")!;
    const plc = new PlcLineSimulator(missionSimConfig(mission, 3, 19));
    for (let i = 0; i < 20; i += 1) plc.tick(1_000);
    expect(plc.getSnapshot().attentionDevices).toEqual([]);

    arm(plc);
    for (let i = 0; i < 6; i += 1) plc.tick(1_000);
    plc.tick(999);
    expect(plc.getSnapshot().attentionDevices).toEqual([]);
    plc.tick(1);
    expect(plc.getSnapshot().attentionDevices).toEqual(["D101", "D102"]);
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

describe("assistant start chain", () => {
  it("starts at power, then connect, then reset while M0 is still false", () => {
    const plc = new PlcLineSimulator(1);
    expect(nextGuideStep(plc.getSnapshot())).toBe("power");
    expect(plc.getSnapshot().devices.M.M0).toBe(false);

    expect(plc.togglePower().ok).toBe(true);
    expect(nextGuideStep(plc.getSnapshot())).toBe("connect");

    expect(plc.setConnection(true).ok).toBe(true);
    const afterLink = plc.getSnapshot();
    expect(afterLink.inputs.eStopHealthy).toBe(true);
    expect(afterLink.safetyReset).toBe(false);
    expect(afterLink.devices.M.M0).toBe(false);
    expect(nextGuideStep(afterLink)).toBe("reset");

    expect(plc.resetSafety().ok).toBe(true);
    const afterReset = plc.getSnapshot();
    expect(afterReset.devices.M.M0).toBe(true);
    expect(nextGuideStep(afterReset)).toBe("start");
  });

  it("tells the operator to stop before editing a flashing recipe", () => {
    const plc = new PlcLineSimulator(1);
    plc.togglePower();
    plc.setConnection(true);
    plc.resetSafety();
    plc.start();
    plc.injectFault("quality");
    const snap = plc.getSnapshot();
    expect(snap.running).toBe(true);
    expect(snap.attentionDevices).toEqual(["D101", "D102"]);
    expect(nextGuideStep(snap)).toBe("stop-recipe");
    plc.stop();
    expect(nextGuideStep(plc.getSnapshot())).toBe("write-recipe");
  });

  it("blocks M0 reset guidance while the guard is open", () => {
    const plc = new PlcLineSimulator(1);
    plc.togglePower();
    plc.setConnection(true);
    plc.resetSafety();
    plc.injectFault("door");
    expect(nextGuideStep(plc.getSnapshot())).toBe("field-door");
    plc.clearInjectedFaults();
    expect(nextGuideStep(plc.getSnapshot())).toBe("reset");
  });

  it("marks reset as current while waiting to latch M0", () => {
    expect(chainStatus("reset", "power")).toBe("done");
    expect(chainStatus("reset", "connect")).toBe("done");
    expect(chainStatus("reset", "reset")).toBe("current");
    expect(chainStatus("reset", "start")).toBe("todo");
  });
});
