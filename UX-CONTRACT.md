# UX-CONTRACT.md — GMMS MES Demo

## Shell
- Desktop uses a persistent navigation rail; the current surface is exposed through an active native button.
- The overview is the supervisor’s visual home. Queue and scan surfaces are operator execution tools.

## Command feedback
- All changing commands show one stable, visible status message.
- A busy/disabled command keeps its dimensions and cannot create a duplicate local request.
- The same action name is used in the command, status message, and audit event.

## Production states
- Task state: READY → BOUND → RUNNING → INTERRUPTED → RUNNING → FINISHED.
- ANDON: OPEN → ACKNOWLEDGED → RESOLVED. RESOLVED is required before resume.
- A machine alarm is shown with a text label and ANDON owner/state, never color alone.

## Scan/report screen
- The operator path is: enter/scan task code → bind CNC-01 → start → signal cycle or raise ANDON → resume → complete.
- Each action is a native button with visible focus and a touch target of at least 48px.
- Invalid task codes preserve entry and show a correction message.

## List/table behavior
- Current demo is a bounded, fixed dataset; no paging is shown.
- When connected to a dynamic dataset, server pagination, URL-persisted filters, loading, empty, and error states are required.
