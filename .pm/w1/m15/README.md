# w1 · m15 — Background command lifecycle and targeted controls

**Worker:** worker1 **Goal:** Keep background commands visible beyond prompt completion and allow safe targeted stopping where the host supports it. **Status:** todo

## Tasks (in order)

| id   | title                                                    | est | depends_on               |
| ---- | -------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify background execution and control support          | 45m | w1/m11/t008              |
| t002 | Track background tasks across prompt boundaries          | 45m | w1/m15/t001              |
| t003 | Expose negotiated async tasks and supported stop actions | 45m | w1/m15/t002              |
| t004 | Verify reload, host replacement and late events          | 45m | w1/m15/t003              |
| t005 | Simplify milestone changes                               | 30m | w1/m15/t004              |
| t006 | CI and behavior coverage                                 | 45m | w1/m15/t004, w1/m15/t005 |
| t007 | Close out the milestone                                  | 15m | w1/m15/t006              |

Estimated total: 4h 30m across 7 tasks. Prerequisite: w1/m11/t008; logical dependency IDs remain valid after archival. Numbering records the queue, not an additional dependency on every earlier milestone.

## Definition of done

- Real-host evidence separates background activity from completed tools and delegated workers.
- Missing inventory or stop APIs are recorded as blockers to those controls; no private process handles or guessed methods are used.
- Prompt completion does not falsely complete a still-running command.
- Interleaved root/child commands remain distinct; completion, failure and unknown lost-host outcomes are honest and deduplicated.
- Baseline clients receive useful lifecycle cards without extension-only updates.
- Where stop is supported, a wire request stops exactly the selected task; unsupported hosts do not advertise stop.
- Host support absent for required stop delivery keeps this task open with a concrete blocker.
- Old host task IDs cannot target processes owned by a new host generation.
- Reload does not duplicate tasks or claim lost processes are still running; lifecycle evidence is recorded.
- /simplify and required affected CI profiles pass with recorded evidence before closeout.
- SDK and exec capability claims match implemented behavior. Negotiated extensions retain a documented baseline-client fallback.
- Required delivery blocked by missing host support stays open with evidence. Explicitly conditional controls may remain unadvertised when unavailable; document the supported subset and upstream dependency rather than inventing an API.

## Source + Goal linkage

- **Source:** User handoff on 2026-09-12 of all findings from the second read-only comparison with `.tmp/codex-acp`, including the additional authentication-state finding. Existing m8–m13 retain the first comparison's scope. Reference paths: `src/muse-sdk-events.ts`, `src/muse-sdk.ts`, `.tmp/codex-acp/docs/async-tasks.md`, `.tmp/codex-acp/src/async-tasks/CodexBackgroundTerminalTasks.ts`. This milestone preserves the requirements even if the temporary reference checkout disappears.
- **Goal linkage:** Keep background commands visible beyond prompt completion and allow safe targeted stopping where the host supports it. Advance faithful, reliable Muse behavior in ACP clients.
- **Expected outcome:** Establish authoritative background item, inventory and termination contracts on the supported host. Retain background task identity, output ownership and terminal state on the session host. Map tracked tasks to an opt-in async-task extension and safely target verified termination operations. Prove task continuity and cleanup at the boundaries introduced by host reuse.
- **Why now:** m9 live output and m11 workers do not represent background commands; reuse m10 ownership and m11 child identity routing.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; a milestone is appropriate.
- **Cross-surface parity:** Omitted because this changes one adapter's protocol/backend, tests and documentation, with no owned editor UI. Protocol translation, SDK/exec differences and client negotiation are covered explicitly.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; use public SDK/MSP interfaces with feature detection and verified minimum host versions, preserve exact SDK pins and real approval gating, keep sandbox defaults, and never replay ambiguous turns automatically. Do not automate the TUI or copy vendor-specific internals.

## Validation evidence

Pending implementation. The originating comparison inspected source and installed SDK declarations; it did not establish host acceptance of the proposed additions.
