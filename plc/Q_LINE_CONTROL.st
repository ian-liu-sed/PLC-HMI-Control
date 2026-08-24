(*
    Q-style cell / line control reference
    Q 风格单元/线体控制参考 / Qスタイルセル・ライン制御参考

    IMPORTANT / 重要:
    - Training example only. Not a validated safety program.
    - Map symbols to GX Works2 device assignment for the purchased QnU CPU,
      I/O modules, and CC-Link master/remote stations.
    - SM/SD numbers below follow common QnU practice and must be confirmed
      against the CPU programming manual for the exact model.
*)

VAR_GLOBAL
    (* Local input image on the Q base / Q 基板本地输入 *)
    inEStopHealthy      : BOOL;   (* X0 *)
    inGuardClosed       : BOOL;   (* X1 *)
    inDriveHealthy      : BOOL;   (* X2 *)
    inAtInfeed          : BOOL;   (* X3 *)
    inAtProcess         : BOOL;   (* X4 *)
    inAtInspection      : BOOL;   (* X5 *)
    inQualityPass       : BOOL;   (* X6 *)

    (* CC-Link remote station health, station 1..4 / 远程站 *)
    st1Healthy          : BOOL;   (* X100 *)
    st2Healthy          : BOOL;   (* X110 *)
    st3Healthy          : BOOL;   (* X120 *)
    st4Healthy          : BOOL;   (* X130 *)

    reqSafetyReset      : BOOL;   (* M1 *)
    reqAutoMode         : BOOL;   (* M10 *)
    reqCycleStart       : BOOL;   (* M11 *)
    reqCycleStop        : BOOL;   (* M12 *)
    hmiHeartbeat        : BOOL;   (* M100 *)

    safetyPermissive    : BOOL;   (* M0 *)
    cycleRunning        : BOOL;   (* M20 *)
    sequenceStep        : INT;    (* D0 *)
    alarmCode           : INT;    (* D30 *)
END_VAR

(* SM400 = always ON while CPU is RUN. SM0 latches a diagnostic error. *)
safetyPermissive :=
    inEStopHealthy AND inGuardClosed AND inDriveHealthy
    AND st1Healthy AND st2Healthy AND st3Healthy AND st4Healthy
    AND SM400 AND NOT SM0;

IF NOT safetyPermissive THEN
    cycleRunning := FALSE;
    Y0 := FALSE;
    Y1 := FALSE;
    Y2 := FALSE;
    Y3 := FALSE;
    D0 := 0;
    IF NOT st1Healthy OR NOT st2Healthy OR NOT st3Healthy OR NOT st4Healthy THEN
        alarmCode := 4001; (* CC-Link remote drop *)
    END_IF;
END_IF;

(* A restored CC-Link station does not restart motion. Need reset + start edge. *)
