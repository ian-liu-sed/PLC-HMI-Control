# SED Control Pilot

Serious game: commission **Mitsubishi FX and Q series PLCs** that control [SED Machines](https://sedmachines.com) pharmaceutical equipment. Same campaign family as [SED Line Pilot](https://github.com/ian-liu-sed/a-simple-game), but the loop is a real HMI/PLC scan — power, Ethernet, safety reset, recipe write/verify, AUTO, START, and recovery.

This used to be FX Line Control Lab. It is now a mission-based trainer. Training simulation only. Not a machine control system.

## What you play

You are a controls engineer on an SED solid-dose line.

1. Pick a mission (press, capsule, bottle pack, blister, full cell).
2. Power the CPU. Open SLMP / MC 3E (or Modbus TCP).
3. Prove X0 / X1 / X2, reset the safety chain, write D100–D104, start AUTO.
4. Survive process drift, guard opens, HMI heartbeat loss, and — on Q missions — CC-Link remote-station drops.
5. A restored link never auto-restarts motion.

Three consecutive failed batches hold that line for one hour (first-party cookie) and open a CAPA + client-call recovery, matching Line Pilot.

## CPU families

| Family | Role on SED equipment | Devices | Example port |
|---|---|---|---|
| **FX5U** | Machine-mounted compact PLC (press, filler, blister) | Octal X/Y, M, D | SLMP 3E `5007` |
| **Q03UDE / Q13UDV** | Line or cell PLC | Hex X/Y, M, D, **SM/SD**, CC-Link remotes | MC 3E `5000` |

Q missions show SM400 (RUN always-ON), SD200 scan time, and remote stations X100 / X110 / …. A remote drop latches A4001. Clearing the station is not a start command.

## Missions

| ID | CPU | SED equipment |
|---|---|---|
| M1 | FX5U | SED-GY-D tablet press |
| M2 | FX5U | SED-J capsule filler + polisher |
| M3 | Q03UDE | Metal detect → counter → cap → induction seal (CC-Link) |
| M4 | FX5U | SED-P-A blister + metal detect |
| M5 | Q13UDV + FX5U | Full solid-dose cell |

Languages: 中文 / 日本語 / English. Difficulty: Assistant / Expert / Legend.

## Run

Node.js 20+.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

The HMI patches live values (OEE, step, I/O, alarms) without rebuilding the DOM, so Power / Reset / START stay clickable. Switch to **通信链路 / NET** to connect Ethernet after main power.

```bash
npm test
npm run build
```

## Engineering files

- [`plc/FX5_LINE_CONTROL.st`](plc/FX5_LINE_CONTROL.st) — FX ST reference
- [`plc/Q_LINE_CONTROL.st`](plc/Q_LINE_CONTROL.st) — Q + CC-Link ST reference
- [`plc/FX5_LINE_LADDER.md`](plc/FX5_LINE_LADDER.md) — ladder notes
- [`config/communication.md`](config/communication.md) — Ethernet, SLMP / MC 3E, Modbus TCP, CC-Link
- [`GOAL.md`](GOAL.md) — long-running product goal

## Safety

Physical e-stop, guards and drive safety must be hardware, not HMI, browser, or Ethernet. This repository is independent of any PLC/HMI vendor. Series names are technical compatibility only.

## License

MIT — see [`LICENSE`](LICENSE).
