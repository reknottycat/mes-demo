import { applyMesCommand, MesRuleError } from "./mes.ts";
import type { MesState } from "./mes.ts";

export type MachineSignalKind = "MACHINE_RUNNING" | "CYCLE_COMPLETED" | "MACHINE_ALARM";

export type MachineSignal = {
  eventId: string;
  machineId: string;
  kind: MachineSignalKind;
  source: string;
  programNo: string;
  spindleRpm: number;
  feedRate: number;
  cycleTimeSec: number;
  alarmCode?: string;
  occurredAt?: string;
};

export type MachineTelemetry = {
  source: string;
  programNo: string;
  spindleRpm: number;
  feedRate: number;
  cycleTimeSec: number;
  lastSignalAt: string;
  signalSequence: number;
};

function telemetryFrom(signal: MachineSignal, state: MesState, at: string): MachineTelemetry {
  return {
    source: signal.source,
    programNo: signal.programNo,
    spindleRpm: signal.spindleRpm,
    feedRate: signal.feedRate,
    cycleTimeSec: signal.cycleTimeSec,
    lastSignalAt: at,
    signalSequence: state.telemetry.signalSequence + 1,
  };
}

export function applyMachineSignal(state: MesState, signal: MachineSignal, receivedAt = new Date().toISOString()): MesState {
  if (!signal.eventId.trim()) throw new MesRuleError("设备信号缺少 eventId，无法保证去重。");
  if (signal.machineId !== state.machineId) throw new MesRuleError("信号设备与当前 JobExecution 不匹配。");
  if (!signal.source.trim()) throw new MesRuleError("设备信号缺少来源。");

  const at = signal.occurredAt || receivedAt;
  const hydrated = { ...state, telemetry: telemetryFrom(signal, state, at) };

  if (signal.kind === "MACHINE_RUNNING") {
    return applyMesCommand(hydrated, { type: "START_JOB", commandId: signal.eventId }, at);
  }

  if (signal.kind === "CYCLE_COMPLETED") {
    return applyMesCommand(hydrated, { type: "MACHINE_CYCLE_COMPLETED", commandId: signal.eventId }, at);
  }

  if (signal.kind === "MACHINE_ALARM") {
    return applyMesCommand(hydrated, {
      type: "RAISE_ANDON",
      code: signal.alarmCode || "UNCLASSIFIED_ALARM",
      commandId: signal.eventId,
    }, at);
  }

  const neverSignal: never = signal.kind;
  throw new MesRuleError("不支持的设备信号：" + neverSignal);
}
