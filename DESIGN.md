# DESIGN.md — GMMS MES Demo

## Subject, audience, job
A Chinese factory production-execution workbench for workshop supervisors and CNC operators. Its first-screen job is to make order flow, machine state, and unresolved exceptions legible within ten seconds.

## Direction
**The production tempo line.** The product should feel like an operational industrial control surface, not a generic SaaS dashboard or a neon “factory big screen.” A process route is a first-class visual object: every operation exposes planned quantity, completed quantity, active execution, and blockage.

## Tokens
- `--ink-950: #10202A` — supervisory header and navigation shell.
- `--surface-0: #F6F5F0` — warm, low-glare work surface.
- `--surface-1: #FFFFFF` — data cards and tables.
- `--signal-orange: #D66B2B` — current production tempo / primary command.
- `--signal-green: #287A57` — normal / complete.
- `--signal-red: #B63B3B` — alarm, blockage, dangerous final action.
- `--signal-yellow: #A86C06` — waiting and attention.
- Radius: 12px for cards, 8px for controls; never pill-heavy.
- Typography: Noto Sans SC fallback system stack; tabular/IDs use ui-monospace.
- Runtime token mapping: `--signal-orange → --orange`, `--signal-green → --green`, `--signal-red → --red`, and `--signal-yellow → --yellow` in `app/globals.css`. The deep/surface tokens keep their documented CSS names.

## Layout and behavior
- Desktop: persistent left navigation; a narrow 72px mode is allowed under 1100px.
- Operator scan screen: one-column task flow and minimum 48px controls for touch.
- All state tones must have text labels; no critical status is color-only.
- Tables retain geometry for loading/empty/error states; filters and active tab are URL-restorable when routes are introduced.
- State-changing commands retain an audit event, prevent duplicate submissions, and use an app-owned visible status message.
- ANDON must show source, owner, state and next action. It cannot be closed by a single ambiguous “OK”.
