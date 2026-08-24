# FX Line Control Lab

一个聚焦 PLC 原理、HMI 操作与数据通信的中日双语生产线训练项目。它把参考游戏里的“参数—扰动—产量—质量—结果”闭环，重新实现为 PLC 扫描、软元件、顺序步进和 HMI 通信闭环。

FX系PLCの原理、HMI操作、データ通信に焦点を当てた中国語・日本語対応の生産ライン学習プロジェクトです。「パラメータ―異常―生産数―品質―結果」のループを、PLCスキャン、デバイス、シーケンス、HMI通信として再構成しています。

## 已实现 / 実装済み

- 中文 / 日本語 HMI，桌面、平板和窄屏自适应
- 主电源 → Ethernet 连接 → 安全复位 → 自动启动的真实操作链
- 输入映像、互锁、顺序程序、输出刷新四阶段扫描可视化
- FX 风格 `X / Y / M / D` 软元件与在线监视
- 全电动进料、主工艺轴、在线检测、电动分拣的批次仿真
- 配方写入、范围验证、回读校验、批次锁定
- 产量、良品、剔除、重量、Availability / Performance / Quality / OEE
- 安全门、驱动过载、质量漂移和网络中断训练
- HMI 500 ms 心跳；3 s 无变化时 PLC 受控停止，且不会自动重启
- SLMP / MC 3E TCP 与 Modbus TCP 参数说明、帧追踪和标签表
- ST 参考程序和梯形图网络说明

## 运行 / 実行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:4173`。

```bash
npm run test
npm run build
```

## 推荐演练 / 推奨トレーニング

1. 打开“主电源”。
2. 在“通信链路”页面保存 IP / 协议并连接。
3. 返回“运行监控”，确认 X0、X1、X2 后执行“安全复位”。
4. 选择 AUTO，启动循环并观察 D0、Y0–Y3、重量和 OEE。
5. 注入“安全门”或“网络中断”，验证输出和报警。
6. 清除故障条件、释放急停、复位报警后重新启动；系统不会自行恢复运动。

日本語: 主電源投入 → 通信接続 → X0/X1/X2確認 → 安全リセット → AUTO → START の順で操作します。安全扉または通信断を模擬し、出力・アラーム・手動復旧を確認してください。

## 工程文件 / エンジニアリング資料

- [`plc/FX5_LINE_CONTROL.st`](plc/FX5_LINE_CONTROL.st) — ST 参考程序
- [`plc/FX5_LINE_LADDER.md`](plc/FX5_LINE_LADDER.md) — 梯形图网络说明
- [`config/hmi-tags.csv`](config/hmi-tags.csv) — HMI 标签导入基础表
- [`config/communication.md`](config/communication.md) — Ethernet、SLMP / MC、Modbus TCP 与安全边界
- [`src/simulator/plc.ts`](src/simulator/plc.ts) — 可测试的浏览器 PLC 状态机

## PLC 原则 / PLC原則

```text
电源 → 输入映像 X → 安全互锁 M → 顺序步 D0 → 输出映像 Y
                        ↑                 ↓
                  HMI 请求 M/D ← Ethernet 批量读写
```

- 物理安全条件优先于 HMI 命令。
- 每一扫描先给动作输出安全默认值，再由当前步有条件地置位。
- 配方停机写入并验证范围；启停使用边沿请求，避免按钮卡住。
- HMI 心跳检测“翻转”，不是只检测某个位等于 1。
- 通信恢复不等于运动恢复；报警清除、安全复位和启动必须分开。

## 重要安全说明 / 重要な安全上の注意

本仓库只用于教育、界面原型和离线逻辑讨论，不能直接控制真实机器，也不是经过验证的安全程序。真实生产必须由合格的电气/自动化/机械安全工程师完成风险评估、选型、接线图、保护计算、安全回路、程序审查、测试记录和现场验收。急停、安全门与驱动安全停止不得依赖普通 PLC、HMI、浏览器或 Ethernet。

本リポジトリは教育、UIプロトタイプ、オフラインロジック検討専用です。実機制御や検証済み安全プログラムではありません。実稼働では有資格の担当者によるリスク評価、選定、配線、保護計算、安全回路、レビュー、試験記録、現地受入が必要です。非常停止、安全扉、ドライブ安全停止を通常PLC、HMI、ブラウザ、Ethernetに依存させないでください。

## 独立性说明 / 独立性について

本项目不包含任何厂商标志、专有 HMI 画面、工程软件文件或复制的示例项目。`FX` 仅作为系列兼容习惯和软元件表示的技术说明。实际型号、I/O 极性、可用指令、保持范围、网络连接数和端口必须以所采购硬件的最新正式手册为准。

This independent project is not affiliated with or endorsed by any controller or HMI vendor. Product and protocol names are used only where needed for technical compatibility.

## License

MIT — see [`LICENSE`](LICENSE).
