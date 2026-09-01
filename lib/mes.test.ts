import assert from "node:assert/strict";
import test from "node:test";
import { applyMachineSignal } from "./machine-signal.ts";
import { applyMesCommand, createDemoState, MesRuleError } from "./mes.ts";

function commandId(value: string) {
  return "test-" + value;
}

test("the CNC happy path binds, starts, collects a cycle, and releases assembly", () => {
  let state = createDemoState();
  state = applyMesCommand(state, { type: "BIND_TASK", taskCode: "TASK-CNC-017", commandId: commandId("bind") });
  state = applyMesCommand(state, { type: "START_JOB", commandId: commandId("start") });
  state = applyMesCommand(state, { type: "MACHINE_CYCLE_COMPLETED", commandId: commandId("cycle") });
  state = applyMesCommand(state, { type: "COMPLETE_JOB", commandId: commandId("complete") });

  assert.equal(state.completed, 20);
  assert.equal(state.jobState, "FINISHED");
  assert.equal(state.assemblyReleased, true);
});

test("an ANDON must be resolved before the job resumes", () => {
  let state = createDemoState();
  state = applyMesCommand(state, { type: "BIND_TASK", taskCode: "TASK-CNC-017", commandId: commandId("bind") });
  state = applyMesCommand(state, { type: "START_JOB", commandId: commandId("start") });
  state = applyMesCommand(state, { type: "RAISE_ANDON", code: "SPINDLE_OVERLOAD", commandId: commandId("alarm") });

  assert.throws(() => applyMesCommand(state, { type: "RESUME_JOB", commandId: commandId("resume-too-soon") }), MesRuleError);
  state = applyMesCommand(state, { type: "ACKNOWLEDGE_ANDON", commandId: commandId("ack") });
  state = applyMesCommand(state, { type: "RESOLVE_ANDON", resolution: "检查刀具并复位", commandId: commandId("resolve") });
  state = applyMesCommand(state, { type: "RESUME_JOB", commandId: commandId("resume") });

  assert.equal(state.jobState, "RUNNING");
  assert.equal(state.andonState, null);
});

test("a cycle cannot be accepted before binding and starting", () => {
  const state = createDemoState();
  assert.throws(() => applyMesCommand(state, { type: "MACHINE_CYCLE_COMPLETED", commandId: commandId("bad-cycle") }), MesRuleError);
});

test("a ProtoForge-compatible machine signal updates telemetry and obeys JobExecution rules", () => {
  let state = createDemoState();
  state = applyMesCommand(state, { type: "BIND_TASK", taskCode: "TASK-CNC-017", commandId: commandId("bind") });
  state = applyMachineSignal(state, {
    eventId: commandId("signal-running"),
    machineId: "CNC-01",
    kind: "MACHINE_RUNNING",
    source: "PROTOFORGE SIM-01",
    programNo: "O1208",
    spindleRpm: 4200,
    feedRate: 680,
    cycleTimeSec: 96,
  });
  state = applyMachineSignal(state, {
    eventId: commandId("signal-cycle"),
    machineId: "CNC-01",
    kind: "CYCLE_COMPLETED",
    source: "PROTOFORGE SIM-01",
    programNo: "O1208",
    spindleRpm: 4200,
    feedRate: 680,
    cycleTimeSec: 96,
  });

  assert.equal(state.jobState, "RUNNING");
  assert.equal(state.completed, 7);
  assert.equal(state.telemetry.source, "PROTOFORGE SIM-01");
  assert.equal(state.telemetry.signalSequence, 2);
});
