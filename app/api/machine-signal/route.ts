import { NextResponse } from "next/server";
import { executeMachineSignal } from "../../../lib/demo-store";
import { MachineSignal } from "../../../lib/machine-signal";
import { MesRuleError } from "../../../lib/mes";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const signal = (await request.json()) as MachineSignal;
    if (!signal || typeof signal.eventId !== "string" || typeof signal.kind !== "string" || typeof signal.machineId !== "string") {
      return NextResponse.json({ error: "设备信号格式无效。" }, { status: 400 });
    }
    return NextResponse.json({ state: executeMachineSignal(signal) });
  } catch (error) {
    if (error instanceof MesRuleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "设备信号暂时无法处理。" }, { status: 500 });
  }
}
