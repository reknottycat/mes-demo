import type { MachineTelemetry } from "./machine-signal";

export type MachineState = "IDLE" | "RUNNING" | "ALARM";
export type JobState = "READY" | "BOUND" | "RUNNING" | "INTERRUPTED" | "FINISHED";
export type AndonState = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type EventTone = "green" | "orange" | "red" | "yellow" | "neutral";

export type MesEvent = {
  id: string;
  at: string;
  title: string;
  detail: string;
  tone: EventTone;
};

export type MesState = {
  orderId: string;
  taskCode: string;
  machineId: string;
  workerName: string;
  planned: number;
  completed: number;
  binding: boolean;
  jobState: JobState;
  andonState: AndonState | null;
  assemblyReleased: boolean;
  telemetry: MachineTelemetry;
  events: MesEvent[];
};

export type MesCommand =
  | { type: "BIND_TASK"; taskCode: string; commandId: string }
  | { type: "START_JOB"; commandId: string }
  | { type: "MACHINE_CYCLE_COMPLETED"; commandId: string }
  | { type: "RAISE_ANDON"; code: string; commandId: string }
  | { type: "ACKNOWLEDGE_ANDON"; commandId: string }
  | { type: "RESOLVE_ANDON"; resolution: string; commandId: string }
  | { type: "RESUME_JOB"; commandId: string }
  | { type: "COMPLETE_JOB"; commandId: string }
  | { type: "RESET_DEMO"; commandId: string };

export class MesRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MesRuleError";
  }
}

function event(commandId: string, title: string, detail: string, tone: EventTone, at: string): MesEvent {
  return { id: commandId, at, title, detail, tone };
}

function append(state: MesState, nextEvent: MesEvent): MesState {
  return { ...state, events: [nextEvent, ...state.events].slice(0, 30) };
}

function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new MesRuleError(message);
}

export function createDemoState(at = "2026-08-30T14:08:00.000Z"): MesState {
  return {
    orderId: "MES-DEMO-001",
    taskCode: "TASK-CNC-017",
    machineId: "CNC-01",
    workerName: "王工",
    planned: 20,
    completed: 6,
    binding: false,
    jobState: "READY",
    andonState: null,
    assemblyReleased: false,
    telemetry: {
      source: "PROTOFORGE / HTTP bridge",
      programNo: "O1208",
      spindleRpm: 0,
      feedRate: 0,
      cycleTimeSec: 96,
      lastSignalAt: at,
      signalSequence: 0,
    },
    events: [
      event("seed-material", "备料完成", "前序工序完成 6 / 20，CNC 工位等待绑定。", "green", at),
      event("seed-dispatch", "工单已释放", "WO-240830-017 的 CNC 精加工任务已派至王工。", "neutral", at),
    ],
  };
}

export function machineState(state: MesState): MachineState {
  if (state.andonState) return "ALARM";
  return state.jobState === "RUNNING" ? "RUNNING" : "IDLE";
}

export function stateLabel(state: MesState): string {
  if (state.andonState === "OPEN") return "异常待确认";
  if (state.andonState === "ACKNOWLEDGED") return "异常处理中";
  if (state.andonState === "RESOLVED") return "等待恢复";
  if (state.jobState === "READY") return "待扫码绑定";
  if (state.jobState === "BOUND") return "已绑定，待开始";
  if (state.jobState === "RUNNING") return "加工中";
  if (state.jobState === "INTERRUPTED") return "等待恢复";
  return "已完成";
}

export function applyMesCommand(state: MesState, command: MesCommand, at = new Date().toISOString()): MesState {
  if (command.type === "RESET_DEMO") return createDemoState(at);

  if (command.type === "BIND_TASK") {
    requireRule(state.jobState === "READY" && !state.binding, "当前任务不能重复绑定。");
    requireRule(command.taskCode.trim() === state.taskCode, "未识别的任务码。请扫描 TASK-CNC-017。");
    return append({ ...state, binding: true, jobState: "BOUND" }, event(command.commandId, "任务已绑定", "王工在 CNC-01 绑定 CNC 精加工任务。", "orange", at));
  }

  if (command.type === "START_JOB") {
    requireRule(state.binding && state.jobState === "BOUND", "开始前必须完成任务与设备绑定。");
    requireRule(!state.andonState, "存在未关闭 ANDON，不能开始加工。");
    return append({ ...state, jobState: "RUNNING" }, event(command.commandId, "加工开始", "JobExecution JE-017 进入 RUNNING。", "orange", at));
  }

  if (command.type === "MACHINE_CYCLE_COMPLETED") {
    requireRule(state.jobState === "RUNNING" && !state.andonState, "当前执行不能接收加工周期。");
    requireRule(state.completed < state.planned, "计划数量已完成，不能重复累计产量。");
    const completed = Math.min(state.planned, state.completed + 1);
    return append({ ...state, completed }, event(command.commandId, "设备周期完成", "CNC-01 上报第 " + completed + " 件合格加工记录。", "green", at));
  }

  if (command.type === "RAISE_ANDON") {
    requireRule(state.binding && state.jobState !== "FINISHED", "未执行或已完成任务不能触发 ANDON。");
    requireRule(!state.andonState, "当前任务已有未关闭 ANDON。");
    return append({ ...state, jobState: "INTERRUPTED", andonState: "OPEN" }, event(command.commandId, "ANDON 已触发", "CNC-01 · " + command.code + " · 等待班组长确认。", "red", at));
  }

  if (command.type === "ACKNOWLEDGE_ANDON") {
    requireRule(state.andonState === "OPEN", "只有待确认的 ANDON 可以确认。");
    return append({ ...state, andonState: "ACKNOWLEDGED" }, event(command.commandId, "ANDON 已确认", "李主管负责检查刀具并执行复位。", "red", at));
  }

  if (command.type === "RESOLVE_ANDON") {
    requireRule(state.andonState === "ACKNOWLEDGED", "ANDON 必须先被确认才能登记处理。");
    const resolution = command.resolution.trim() || "检查刀具并完成复位";
    return append({ ...state, andonState: "RESOLVED" }, event(command.commandId, "ANDON 已解决", resolution + "，等待操作员恢复。", "green", at));
  }

  if (command.type === "RESUME_JOB") {
    requireRule(state.andonState === "RESOLVED", "恢复前必须先解决 ANDON。");
    return append({ ...state, andonState: null, jobState: "RUNNING" }, event(command.commandId, "加工已恢复", "王工确认复位结果后恢复执行。", "orange", at));
  }

  if (command.type === "COMPLETE_JOB") {
    requireRule(state.jobState === "RUNNING" && !state.andonState, "完工前任务必须加工中且没有未关闭异常。");
    return append({ ...state, completed: state.planned, jobState: "FINISHED", assemblyReleased: true }, event(command.commandId, "工序完工", "CNC 精加工完成 20 / 20，装配工序已释放。", "green", at));
  }

  const neverCommand: never = command;
  throw new MesRuleError("不支持的命令：" + JSON.stringify(neverCommand));
}
