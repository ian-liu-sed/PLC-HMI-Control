# HMI—PLC 通信参数 / HMI—PLC 通信パラメータ

## 推荐的实验室网络 / 推奨ラボネットワーク

| 项目 | HMI | PLC | 说明 |
|---|---:|---:|---|
| IPv4 | `192.168.10.20/24` | `192.168.10.10/24` | 不设默认网关的隔离设备 VLAN |
| 物理层 | 100BASE-TX | 100BASE-TX / 10BASE-T | 100M 使用 Cat5 以上 STP |
| 首选协议 | SLMP / MC 3E binary over TCP | Passive/open server | 端口 `5007` 是本项目示例值，必须在两端一致配置 |
| 通用协议 | Modbus TCP | Server | 默认端口 `502` |
| HMI 轮询 | 500 ms | — | D0 起批量读取 24 words；M0 起批量读取 16 bits |
| 心跳 | 500 ms 翻转 M100 | 3 s 变化检测 | 冻结在 ON 或 OFF 都会超时 |
| 写入 | 按需 | — | 配方停机写入并回读；启停请求使用脉冲 |

> 日本語: ポート `5007` は本サンプルのユーザー設定値です。CPUの既定値として扱わず、PLC側とHMI側を必ず同じ設定にしてください。Modbus TCP の既定ポートは `502` です。

## SLMP / MC 3E 二进制帧策略

- 用批量读代替每个标签单独读取，减少扫描通信负载。
- 请求设备区分 X/Y/M/D；字数据按 16 bit 处理，32 bit 计数器占两个连续 D。
- 写入完成后检查结束码；配方再执行回读一致性校验。
- HMI 断线后 PLC 不执行新的写请求。若自动运行中 3 秒没有观察到心跳翻转，执行受控停止并锁存 `A3001`。
- 网络恢复不应自动重启；需要人工确认、报警复位和新的启动沿。

## Modbus TCP 映射建议

Modbus 地址显示方式因 HMI 而异（0-based / 1-based）。以下给出协议 PDU 的 0-based 偏移；导入 HMI 前确认它是否显示为 `40001` 风格。

| PDU offset | PLC 数据 | 数量 | 方向 |
|---:|---|---:|---|
| 0 | D0 sequence step | 1 holding register | PLC → HMI |
| 20 | D20 production block | 12 holding registers | PLC → HMI |
| 100 | D100 recipe block | 6 holding registers | HMI ↔ PLC |
| 200 | M0 status/request block | 16 coils | HMI ↔ PLC |

## 网络和安全边界

- PLC/HMI 放入独立 OT VLAN，不直接暴露到互联网。
- 在交换机或工业防火墙上只允许工程站/HMI 到 PLC 的必要源地址与端口。
- 禁止使用 HMI 位代替急停、安全门、驱动安全停止或其他安全功能。
- 远程访问通过经过批准的跳板/VPN，并保留工程变更记录。
- 投产前测试：拔网线、交换机重启、PLC 重启、重复写请求、延迟/丢包、HMI 冻结、IP 冲突。

## FX 类硬件差异

- FX5 类 CPU 常见内置以太网；根据具体 CPU/固件选择 SLMP、Modbus TCP 或扩展模块功能。
- FX3 类通常需要匹配的以太网块/适配器，或采用 RS-422/RS-485。连接数、端口范围和可访问软元件以该模块手册为准。
- 继电器输出适合低频开关；晶体管输出更适合高速脉冲和高频电动执行器控制，但必须匹配 sink/source 极性与负载电流。
