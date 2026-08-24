import { describe, expect, it } from "vitest";
import { PlcLineSimulator } from "../src/simulator/plc";

function armAndStart(plc: PlcLineSimulator): void {
  expect(plc.togglePower().ok).toBe(true);
  expect(plc.setConnection(true).ok).toBe(true);
  expect(plc.resetSafety().ok).toBe(true);
  expect(plc.start().ok).toBe(true);
}

describe("PlcLineSimulator", () => {
  it("enforces the power, connection and safety start chain", () => {
    const plc = new PlcLineSimulator(1);
    expect(plc.start().ok).toBe(false);
    plc.togglePower();
    expect(plc.start().ok).toBe(false);
    plc.setConnection(true);
    expect(plc.start().ok).toBe(false);
    plc.resetSafety();
    expect(plc.start().ok).toBe(true);
  });

  it("produces a deterministic batch with valid counters", () => {
    const plc = new PlcLineSimulator(42);
    armAndStart(plc);
    for (let i = 0; i < 500; i += 1) plc.tick(100);
    const snapshot = plc.getSnapshot();
    expect(snapshot.metrics.total).toBeGreaterThan(25);
    expect(snapshot.metrics.good + snapshot.metrics.rejected).toBe(snapshot.metrics.total);
    expect(snapshot.devices.D.D20).toBe(snapshot.metrics.total);
    expect(snapshot.scanCount).toBeGreaterThan(10_000);
  });

  it("drops all motion outputs immediately on emergency stop", () => {
    const plc = new PlcLineSimulator(7);
    armAndStart(plc);
    plc.tick(200);
    plc.emergencyStop();
    const snapshot = plc.getSnapshot();
    expect(snapshot.running).toBe(false);
    expect(snapshot.outputs.feedDrive).toBe(false);
    expect(snapshot.outputs.processServo).toBe(false);
    expect(snapshot.outputs.towerRed).toBe(true);
    expect(snapshot.activeAlarm?.code).toBe(1001);
  });

  it("performs a controlled stop after a three-second HMI timeout", () => {
    const plc = new PlcLineSimulator(9);
    armAndStart(plc);
    plc.setConnection(false);
    plc.tick(1000);
    plc.tick(1000);
    plc.tick(999);
    expect(plc.getSnapshot().running).toBe(true);
    plc.tick(2);
    expect(plc.getSnapshot().running).toBe(false);
    expect(plc.getSnapshot().activeAlarm?.code).toBe(3001);
  });

  it("rejects recipe changes while running and invalid ranges while stopped", () => {
    const plc = new PlcLineSimulator(11);
    armAndStart(plc);
    expect(plc.updateRecipe({ speedPpm: 55 }).ok).toBe(false);
    plc.stop();
    expect(plc.updateRecipe({ speedPpm: 200 }).ok).toBe(false);
    expect(plc.updateRecipe({ speedPpm: 55, batchTarget: 100 }).ok).toBe(true);
    expect(plc.getSnapshot().recipe.speedPpm).toBe(55);
  });

  it("does not count a scan for a zero-duration UI refresh", () => {
    const plc = new PlcLineSimulator(13);
    plc.togglePower();
    const before = plc.getSnapshot().scanCount;
    plc.tick(0);
    expect(plc.getSnapshot().scanCount).toBe(before);
  });

  it("starts the mission clock only after START and keeps counting downtime", () => {
    const plc = new PlcLineSimulator(14);
    plc.tick(5_000);
    expect(plc.getSnapshot().missionElapsedMs).toBe(0);

    armAndStart(plc);
    plc.tick(1_000);
    expect(plc.getSnapshot().missionElapsedMs).toBe(1_000);
    plc.stop();
    plc.tick(1_000);
    expect(plc.getSnapshot().missionElapsedMs).toBe(2_000);
  });

  it("cannot energize a tower output without electrical power", () => {
    const plc = new PlcLineSimulator(15);
    armAndStart(plc);
    plc.emergencyStop();
    expect(plc.getSnapshot().outputs.towerRed).toBe(true);
    plc.togglePower();
    const snapshot = plc.getSnapshot();
    expect(snapshot.powered).toBe(false);
    expect(Object.values(snapshot.outputs).some(Boolean)).toBe(false);
  });
});
