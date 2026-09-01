import { applyMesCommand, createDemoState, MesCommand, MesState } from "./mes";

let snapshot: MesState = createDemoState();
const processed = new Map<string, MesState>();

export function getDemoSnapshot(): MesState {
  return snapshot;
}

export function executeDemoCommand(command: MesCommand): MesState {
  const prior = processed.get(command.commandId);
  if (prior) return prior;

  snapshot = applyMesCommand(snapshot, command);
  processed.set(command.commandId, snapshot);

  if (processed.size > 300) {
    const first = processed.keys().next().value;
    if (first) processed.delete(first);
  }
  return snapshot;
}
