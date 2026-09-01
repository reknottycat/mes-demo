# Virtual CNC / ProtoForge integration

## Boundary

GMMS owns the manufacturing workflow. A machine simulator, ProtoForge, or an eventual OPC UA gateway only emits a normalized `MachineSignal`. It never writes task progress or ANDON state directly.

```
Machine source → POST /api/machine-signal → MachineSignal adapter → JobExecution state machine
```

The current in-app `SIM-01` sends the same contract used by an external ProtoForge bridge.

## HTTP contract

```json
{
  "eventId": "unique-source-event-id",
  "machineId": "CNC-01",
  "kind": "MACHINE_RUNNING | CYCLE_COMPLETED | MACHINE_ALARM",
  "source": "PROTOFORGE SIM-01",
  "programNo": "O1208",
  "spindleRpm": 4200,
  "feedRate": 680,
  "cycleTimeSec": 96,
  "alarmCode": "SPINDLE_OVERLOAD",
  "occurredAt": "2026-09-01T10:30:00.000Z"
}
```

- `eventId` is the idempotency key. Replaying it returns the prior snapshot.
- `machineId` must match the bound JobExecution resource.
- `MACHINE_RUNNING` starts a bound task.
- `CYCLE_COMPLETED` increments accepted quantity only while the job is running.
- `MACHINE_ALARM` opens ANDON and interrupts the job.

## ProtoForge mapping

Configure a CNC device/scenario in ProtoForge and publish a webhook for only three meaningful business events:

| Simulator event | GMMS `kind` | Required payload |
| --- | --- | --- |
| Cycle begins / machine runs | `MACHINE_RUNNING` | program, spindle, feed |
| Good cycle ends | `CYCLE_COMPLETED` | program, cycle duration |
| Alarm code becomes active | `MACHINE_ALARM` | alarm code, zero/last known telemetry |

Do not publish high-frequency raw tags directly to the demo. Aggregate them in the bridge to one of the events above; this keeps the five-minute demonstration readable and protects the MES state machine from noisy telemetry.
