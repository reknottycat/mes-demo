import { applyMachineSignal, MachineSignal } from "./machine-signal";
import { applyMesCommand, createDemoState, MesCommand, MesState } from "./mes";

type DemoStore = {
  snapshot: MesState;
  processed: Map<string, MesState>;
};

const globalStore = globalThis as typeof globalThis & { __gmmsDemoStore?: DemoStore };
const store = globalStore.__gmmsDemoStore ?? {
  snapshot: createDemoState(),
  processed: new Map<string, MesState>(),
};
globalStore.__gmmsDemoStore = store;

function remember(id: string, next: MesState): MesState {
  store.processed.set(id, next);
  if (store.processed.size > 300) {
    const first = store.processed.keys().next().value;
    if (first) store.processed.delete(first);
  }
  return next;
}

export function getDemoSnapshot(): MesState {
  return store.snapshot;
}

export function executeDemoCommand(command: MesCommand): MesState {
  const prior = store.processed.get(command.commandId);
  if (prior) return prior;

  store.snapshot = applyMesCommand(store.snapshot, command);
  return remember(command.commandId, store.snapshot);
}

export function executeMachineSignal(signal: MachineSignal): MesState {
  const prior = store.processed.get(signal.eventId);
  if (prior) return prior;

  store.snapshot = applyMachineSignal(store.snapshot, signal);
  return remember(signal.eventId, store.snapshot);
}
