(*
    FX-style all-electric line control reference
    FX 风格全电动产线控制参考 / FXスタイル全電動ライン制御参考

    IMPORTANT / 重要:
    - This is an independent training example, not a validated safety program.
    - Emergency stop and guard interlocks must remove hazardous energy through
      a separately designed and validated hardware safety circuit.
    - Map the symbolic labels below to the X/Y/M/D devices in config/hmi-tags.csv.
    - Confirm instructions, timers, retentive ranges, and I/O polarity against
      the exact CPU, expansion module, and engineering-tool version.
*)

VAR_GLOBAL
    (* Physical input image / 物理输入映像 / 物理入力イメージ *)
    inEStopHealthy      : BOOL;   (* X0: NC safety feedback *)
    inGuardClosed       : BOOL;   (* X1: guard feedback *)
    inDriveHealthy      : BOOL;   (* X2: electric drive ready *)
    inAtInfeed          : BOOL;   (* X3 *)
    inAtProcess         : BOOL;   (* X4 *)
    inAtInspection      : BOOL;   (* X5 *)
    inQualityPass       : BOOL;   (* X6 *)

    (* HMI requests / HMI 要求 *)
    reqSafetyReset      : BOOL;   (* M1: momentary request *)
    reqAutoMode         : BOOL;   (* M10 *)
    reqCycleStart       : BOOL;   (* M11: momentary request *)
    reqCycleStop        : BOOL;   (* M12: momentary request *)
    hmiHeartbeat        : BOOL;   (* M100: toggles every 500 ms *)

    (* Internal state / 内部状态 / 内部状態 *)
    safetyPermissive    : BOOL;   (* M0 *)
    autoMode            : BOOL;   (* M10 mirrored after validation *)
    cycleRunning        : BOOL;   (* M20 *)
    batchComplete       : BOOL;   (* M21 *)
    commHealthy         : BOOL;   (* M31 *)
    sequenceStep        : INT;    (* D0 *)
    alarmCode           : INT;    (* D30 *)
    previousHeartbeat   : BOOL;
    previousReset       : BOOL;
    previousStart       : BOOL;
    previousStop        : BOOL;

    (* Recipe / 配方 / レシピ *)
    setSpeedPpm         : INT;    (* D100: 10..90 *)
    setTargetWeightMg   : INT;    (* D101: 100..1200 *)
    setToleranceMg      : INT;    (* D102: 2..80 *)
    setRejectPulseMs    : INT;    (* D103: 40..500 *)
    setBatchTarget      : DINT;   (* D104/D105: 20..9999 *)

    (* Production data / 生产数据 / 生産データ *)
    countTotal          : DINT;   (* D20/D21 in a 16-bit mapping *)
    countGood           : DINT;   (* D22/D23 *)
    countReject         : DINT;   (* D24/D25 *)
    actualWeightX10     : INT;    (* D26: mg x 10 *)

    (* Physical outputs / 物理输出 / 物理出力 *)
    outFeedDrive        : BOOL;   (* Y0 *)
    outProcessServo     : BOOL;   (* Y1 *)
    outInspectTrigger   : BOOL;   (* Y2 *)
    outRejectGate       : BOOL;   (* Y3 *)
    outTowerGreen       : BOOL;   (* Y4 *)
    outTowerAmber       : BOOL;   (* Y5 *)
    outTowerRed         : BOOL;   (* Y6 *)

    tmrHeartbeat        : TON;
    tmrStep             : TON;
    tmrReject           : TON;
END_VAR

VAR
    resetEdge           : BOOL;
    startEdge           : BOOL;
    stopEdge            : BOOL;
    heartbeatChanged    : BOOL;
    safetyInputsOK      : BOOL;
    recipeValid         : BOOL;
END_VAR

(* 1. Edge detection / 上升沿 / 立上りエッジ *)
resetEdge := reqSafetyReset AND NOT previousReset;
startEdge := reqCycleStart AND NOT previousStart;
stopEdge := reqCycleStop AND NOT previousStop;
heartbeatChanged := hmiHeartbeat <> previousHeartbeat;

previousReset := reqSafetyReset;
previousStart := reqCycleStart;
previousStop := reqCycleStop;

(* 2. Communication watchdog: heartbeat must toggle within 3 s. *)
IF heartbeatChanged THEN
    tmrHeartbeat(IN := FALSE, PT := T#3s);
    previousHeartbeat := hmiHeartbeat;
END_IF;
tmrHeartbeat(IN := NOT heartbeatChanged, PT := T#3s);
commHealthy := NOT tmrHeartbeat.Q;

(* 3. Safety permissive. HMI reset is only a request; physical inputs dominate. *)
safetyInputsOK := inEStopHealthy AND inGuardClosed AND inDriveHealthy;

IF NOT safetyInputsOK THEN
    safetyPermissive := FALSE;
ELSIF resetEdge THEN
    safetyPermissive := TRUE;
END_IF;

(* 4. Alarm priority / 报警优先级 / アラーム優先順位 *)
IF NOT inEStopHealthy THEN
    alarmCode := 1001;
ELSIF NOT inGuardClosed THEN
    alarmCode := 1002;
ELSIF NOT inDriveHealthy THEN
    alarmCode := 2001;
ELSIF NOT commHealthy AND cycleRunning THEN
    alarmCode := 3001;
ELSIF resetEdge AND safetyInputsOK THEN
    alarmCode := 0;
END_IF;

(* 5. Validate HMI recipe before it can affect the sequence. *)
recipeValid :=
    (setSpeedPpm >= 10) AND (setSpeedPpm <= 90) AND
    (setTargetWeightMg >= 100) AND (setTargetWeightMg <= 1200) AND
    (setToleranceMg >= 2) AND (setToleranceMg <= 80) AND
    (setRejectPulseMs >= 40) AND (setRejectPulseMs <= 500) AND
    (setBatchTarget >= 20) AND (setBatchTarget <= 9999);

autoMode := reqAutoMode;

(* 6. Start/stop latch. Loss of safety always wins. Communication loss causes
      a controlled stop; the independent safety circuit still handles hazards. *)
IF stopEdge OR NOT safetyPermissive OR (NOT commHealthy AND cycleRunning) THEN
    cycleRunning := FALSE;
    sequenceStep := 0;
ELSIF startEdge AND autoMode AND safetyPermissive AND recipeValid AND (alarmCode = 0) THEN
    cycleRunning := TRUE;
    batchComplete := FALSE;
    IF sequenceStep = 0 THEN
        sequenceStep := 10;
    END_IF;
END_IF;

(* 7. Safe output defaults at the start of every scan. *)
outFeedDrive := FALSE;
outProcessServo := FALSE;
outInspectTrigger := FALSE;
outRejectGate := FALSE;

(* 8. Main sequence / 主顺序 / メインシーケンス *)
IF cycleRunning AND safetyPermissive THEN
    CASE sequenceStep OF
        10: (* Electric infeed / 电动进料 / 電動供給 *)
            outFeedDrive := TRUE;
            tmrStep(IN := TRUE, PT := T#2s);
            IF inAtInfeed THEN
                tmrStep(IN := FALSE, PT := T#2s);
                sequenceStep := 20;
            ELSIF tmrStep.Q THEN
                alarmCode := 4001;
                cycleRunning := FALSE;
            END_IF;

        20: (* Index to process position / 工位定位 / 工程位置決め *)
            outFeedDrive := TRUE;
            outProcessServo := TRUE;
            tmrStep(IN := TRUE, PT := T#2s);
            IF inAtProcess THEN
                tmrStep(IN := FALSE, PT := T#2s);
                sequenceStep := 30;
            ELSIF tmrStep.Q THEN
                alarmCode := 4002;
                cycleRunning := FALSE;
            END_IF;

        30: (* All-electric main process axis / 全电动主工艺轴 *)
            outProcessServo := TRUE;
            tmrStep(IN := TRUE, PT := T#420ms);
            IF tmrStep.Q THEN
                tmrStep(IN := FALSE, PT := T#420ms);
                sequenceStep := 40;
            END_IF;

        40: (* Inspection trigger / 检测触发 / 検査トリガ *)
            outInspectTrigger := TRUE;
            tmrStep(IN := TRUE, PT := T#1s);
            IF inAtInspection THEN
                tmrStep(IN := FALSE, PT := T#1s);
                sequenceStep := 50;
            ELSIF tmrStep.Q THEN
                alarmCode := 4003;
                cycleRunning := FALSE;
            END_IF;

        50: (* Electric reject gate / 电动剔除 / 電動排出 *)
            IF NOT inQualityPass THEN
                tmrReject(IN := TRUE, PT := INT_TO_TIME(setRejectPulseMs));
                outRejectGate := NOT tmrReject.Q;
                IF tmrReject.Q THEN
                    tmrReject(IN := FALSE, PT := INT_TO_TIME(setRejectPulseMs));
                    countReject := countReject + 1;
                    sequenceStep := 60;
                END_IF;
            ELSE
                countGood := countGood + 1;
                sequenceStep := 60;
            END_IF;

        60: (* Batch counter / 批次计数 / バッチカウント *)
            countTotal := countTotal + 1;
            IF countTotal >= setBatchTarget THEN
                batchComplete := TRUE;
                cycleRunning := FALSE;
                sequenceStep := 90;
            ELSE
                sequenceStep := 10;
            END_IF;

        ELSE
            cycleRunning := FALSE;
            sequenceStep := 0;
    END_CASE;
END_IF;

(* 9. Tower lamp / 三色灯 / 表示灯 *)
outTowerRed := alarmCode <> 0;
outTowerGreen := safetyPermissive AND (alarmCode = 0);
outTowerAmber := NOT safetyPermissive AND (alarmCode = 0);

(* End of cyclic program. Physical output image is refreshed after END. *)
