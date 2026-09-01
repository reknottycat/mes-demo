# PRODUCT.md — GMMS MES Demo

## Goal
In five minutes, demonstrate a credible CNC factory execution loop: a supervisor sees the current order, process, machines, and unresolved ANDON; an operator binds a task to a fixed CNC by QR, starts, receives progress signals, handles an interruption, resumes, and completes.

## Canonical demo
- Order: MES-DEMO-001, DN100 manual ball valve, 20 units.
- Route: 备料 → CNC 精加工 → 装配 → 压力测试.
- Active operation: TASK-CNC-017 / CNC-01 / operator 王工.
- First integration: manual QR bind and a ProtoForge-compatible virtual CNC gateway. It exposes one normalized `MachineSignal` HTTP contract; no program download or production OPC UA session in P0.

## Domain invariants
1. A task must be bound before it starts.
2. One active ANDON blocks resume and completion until it is resolved.
3. Only the state machine can update completion quantities and release the next operation.
4. External signals are idempotent by source command/event id and may only enter through `MachineSignal`; they never write task state directly.
5. Finishing CNC processing releases assembly; it does not falsely mark the entire order complete.

## Out of scope
Scheduling, MRP, DNC, full OEE, inventory/finance suites, multi-site support, and production OPC UA sessions.
