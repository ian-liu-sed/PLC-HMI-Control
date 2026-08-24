# Goal: SED Control Pilot

Turn `FX Line Control Lab` into a long-running **serious game** in the same family as [SED Line Pilot](https://github.com/ian-liu-sed/a-simple-game): a player commissions and operates **FX and Q series PLCs** that control **SED Machines** pharmaceutical equipment.

GitHub `ian-liu-sed/PLC-HMI-Control` is private or not visible to this session (404). Local source of truth: `Desktop/code/plc-hmi`. Reference game: `Desktop/code/sed-game` / `ian-liu-sed/a-simple-game`.

This is **not** a real machine controller. Training simulation only.

## Player fantasy

You are a controls engineer on an SED solid-dose line. You do not drag sliders on a cartoon line. You power a CPU, open an Ethernet session, prove the safety chain, write a recipe, start AUTO, and recover from field faults the way a real HMI/PLC loop works.

## Non-negotiable design

1. Keep the PLC scan model: power → input image → interlock → sequence → output refresh → HMI heartbeat.
2. Support **two CPU families** in one campaign:
   - **FX** (compact, machine-mounted): octal X/Y, X/Y/M/D, SLMP 3E, example port 5007.
   - **Q** (modular, cell/line): hex X/Y, SM/SD, MC 3E, example port 5000, I/O modules, CC-Link remote stations for downstream SED machines.
3. Every mission maps to real SED equipment roles from Line Pilot (press, capsule, bottle pack, blister, full line).
4. Campaign layer from Line Pilot: difficulty, incidents, batch report, 3-fail / 1-hour hold, CAPA checklist, client call, badges, cookie persistence.
5. Physical safety never rides on HMI/Ethernet. Communication restore never auto-restarts motion.
6. Languages: 中文 / 日本語.
7. Independent of vendor logos and proprietary project files. Series names are technical compatibility only.

## Mission map

| ID | CPU | SED equipment | Teaching point |
|---|---|---|---|
| M1-press | FX5U | SED-GY-D tablet press | Compact FX on a single machine |
| M2-capsule | FX5U | SED-J filler + polisher | Recipe lock, fill-weight drift |
| M3-bottle | Q03UDE | MD → counter → cap → induction seal | Q as line PLC + CC-Link remotes |
| M4-blister | FX5U | SED-P-A blister + MD | Form/seal window as recipe |
| M5-line | Q13UDV + FX5U | Full solid-dose cell | Q cell controller supervising an FX machine PLC |

## Success criteria (do not mark complete until all are true)

- [x] Hub, briefing, live HMI/PLC/network play, batch report, hold/CAPA, client recovery, badges.
- [x] FX and Q device maps, default ports, scan times, and topology differ and are covered by tests.
- [x] Q missions expose SM/SD and at least one CC-Link remote-station fault that stops motion without auto-restart.
- [x] Existing PLC safety tests still pass (start chain, E-stop, 3 s heartbeat, recipe lock, unpowered outputs).
- [x] New tests cover Q addressing, remote-station trip, mission pass/fail, campaign hold.
- [x] `npm test` and `npm run build` succeed (2026-08-24: 18 tests, production build ok).
- [x] README states FX + Q, SED machines, and the training-only disclaimer.

Foundation shipped locally. Remaining depth is still in phases 2–3 below — this goal stays open until process physics, GX Works notes, and incident polish land.

## Implementation phases

1. **Foundation (this round):** CPU families, mission configs, campaign persistence, hub/brief/play/result/hold/client, Q SM/SD/CC-Link, tests.
2. **Depth:** mission-specific process physics (force, vacuum, torque, forming temp), GX Works2/3 notes, richer Q rack/I/O assignment.
3. **Polish:** equipment art, incident “ADJUST NOW” on drifted D registers, difficulty copy without spoiling incident counts, deploy config.

## Evidence required

Commands from `Desktop/code/plc-hmi`:

```
npm test
npm run build
```

Plus a playable loop: pick M1 (FX) and M3 (Q), complete the start chain, inject a fault, prove no auto-restart, finish or fail a batch, persist campaign state.
