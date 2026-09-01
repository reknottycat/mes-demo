import { NextResponse } from "next/server";
import { executeDemoCommand, getDemoSnapshot } from "../../../lib/demo-store";
import { MesCommand, MesRuleError } from "../../../lib/mes";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ state: getDemoSnapshot() });
}

export async function POST(request: Request) {
  try {
    const command = (await request.json()) as MesCommand;
    if (!command || typeof command.type !== "string" || typeof command.commandId !== "string") {
      return NextResponse.json({ error: "命令格式无效。" }, { status: 400 });
    }
    const state = executeDemoCommand(command);
    return NextResponse.json({ state });
  } catch (error) {
    if (error instanceof MesRuleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "服务暂时无法处理该命令。" }, { status: 500 });
  }
}
