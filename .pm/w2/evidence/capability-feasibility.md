# Capability feasibility and corrective handoff — 2026-09-14

## Scope and decision

The user requested research, then PM tasks in w2, for all four categories raised
by the approval investigation: approval policies, sandbox controls, session
settings, and other capabilities currently rejected or described as unsupported.
This is a research/planning handoff; it does not enable production controls or
authorize a new release.

Create [m4](../done/m4/README.md) (11 tasks), [m5](../m5/README.md) (8 tasks) and
[m6](../m6/README.md) (9 tasks). m4 consumes 010 and supersedes all eight still-open
w1/m25 tasks, preserving their full content and explicit replacement mapping.
No external task frontmatter depended on a w1/m25 task. Historical links are
repaired, and w1's index records supersession rather than completion.

## Evidence standard

Keep five independent facts: public API availability, native host enforcement,
faithful adapter implementation, host-version/platform coverage, and shipped ACP
availability. Classify missing evidence as unverified, not unsupported. A native
API accepting a setting is not proof of its effect. A host emitting a request is
not proof that the client must resolve it: policy may settle it immediately.

Research inspected adapter source at e870a2f, installed SDK 0.1.1 (also current
npm latest when checked), public SDK declarations/docs and upstream issues, and
existing real-host board evidence. Fresh loopback probes used Muse
1.1.1-R2514.1 and 1.2.1-R2847.1 on macOS ARM64, isolated HOME/config/data and dummy
credentials. No paid providers, production settings or private APIs were used.

## Feasibility matrix and execution ownership

| Area                                      | Finding / faithful implementation path                                                                                                                                          | Remaining boundary                                                                                                                                          | Corrective owner                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Automatic approval                        | Native 1.2.1 allowAll and client-issued host-offered once decisions on both hosts have real tool-effect evidence                                                                | Production mode integration, root guards, cancellation, restore, hard-deny races and Linux checks remain                                                    | m4/t001–t004, t007                                          |
| Automatic rejection and prompted policies | Fresh 1.2.1 denyUnmatched emitted approval/requested followed by denied, resolvedBy policy; without any client decision the write stayed absent                                 | Full matched/unmatched matrix; adapter automatic rejection must not be called native-policy equivalence                                                     | m4/t001, t004                                               |
| Sandbox controls                          | Public serve help exposes disable-write, disable-shell, sandbox-network, disable-sandbox and trust-workspace; retained filesystem denial verified with both approval approaches | Network values/enforcement and host replacement still need tests; posture is fixed per host, not per wire command                                           | m4/t005–t007                                                |
| Model/provider selection                  | Fresh 1.2.1 main request used the explicitly selected fake-model-alternate rather than configured fake-model                                                                    | Public catalog identity, providerId, failure rollback, two endpoints, resume and cross-provider behavior                                                    | m5/t001, t002, t004                                         |
| Reasoning effort                          | Fresh main-request capture: 1.1.1 omitted reasoning for requested ultra; 1.2.1 forwarded ultra as provider max                                                                  | Native effort control differs by version; don't infer effective effort from session metadata or reminder requests                                           | m5/t001, t003, t004                                         |
| Settings restoration/observation          | Existing preferences, setModel and observed-state extension provide usable public/adapter paths                                                                                 | Define requested versus observed values and apply/rollback boundaries; no automatic broad privilege change                                                  | m5/t004                                                     |
| Turn and user-input controls              | Public registry includes turn/steer, interrupt, cancel, unqueue, session/userShell and userInput/answer, cancel, clarify                                                        | Public shape is feasibility, not evidence that every ACP alias or idle/active behavior is equivalent                                                        | m6/t001–t004; existing w1/m15 and m23 acceptance references |
| Usage, plans and progress                 | Public token/context/todo events and existing positive token evidence permit independent adapter translation                                                                    | Durable compaction was rejected on 1.1.1; do not block ordinary telemetry solely on compaction, or substitute a local summary for native history compaction | m6/t002, t003, t005; existing w1/m9                         |
| Failures/authentication/retries           | Existing real 401/authRequired and retryable modelError observations support truthful error/auth reporting                                                                      | Transport retries do not establish turn/retryScheduled; don't fabricate timing or silently replay turns                                                     | m6/t002–t005; existing w1/m14                               |
| Workers/background lifecycle              | Public subagent controls exist; existing 1.1.1 launcher/child-read failures are concrete native blockers                                                                        | Recheck 1.2.1 and independent progress rendering; a newly spawned root session is not a native child with equivalent permission/history routing             | m6/t002, t003, t005; existing w1/m11 and m15                |
| Rich output                               | Existing text fallback can be improved where public structured payloads exist                                                                                                   | Previous mixed-MCP probe lost media/structured output; item/readOutput is absent from pinned public method map. Do not fetch invented references            | m6/t002, t003; existing w1/m17                              |
| Roots and URL elicitation                 | Ordinary forms and embedded prompt content have public paths                                                                                                                    | Public session/start still has one workspaceRoot; no URL settlement contract found. Widening sandbox root or inventing URL events is not equivalent         | m6/t001–t003; existing w1/m20                               |
| Provider/tier/quota                       | Provider configuration can be tested with separate local endpoints; catalog identity is public                                                                                  | No account/quota or service-tier method in pinned registry. Model cost is not account quota; no hidden relay to rewrite host traffic                        | m5/t002 and m6/t001–t003; existing w1/m21                   |
| Session commands, titles, deletion, goals | Existing skills/logout operations and adapter-owned titles are candidate client-side implementations; native list/read/fork and goal observation already exist                  | Native root deletion and goal mutation absent from public registry. Local hiding/renaming must not claim native cross-client deletion/persistence           | m6/t001–t005; existing w1/m23 and inbox w1/002              |

The remaining w1 milestones retain their original feature acceptance until a
specific delivery transfer is made. They are reference coverage, not a second
implementation assignment. m6 requires any feasible overlapping correction to be
assigned once to an explicit w2 task before coding, with original requirements
preserved. Larger discoveries become bounded w2 milestones and explicit closeout
dependencies. No positive finding may disappear into an unowned recommendation.
No original blocked feature is declared delivered by this audit.

## Fresh observations that change earlier conclusions

[Approval and sandbox probe details](010-sdk-approval-verification.md) establish
native allowAll and automatic host-offered decision feasibility. The follow-up
denyUnmatched probe also demonstrates a race: a naive immediate allow_once was
rejected with -32051 approvalAlreadyResolved, with resolution denied by policy.
Repeating without any client decision completed the turn and left the marker
absent. An emitted approval/requested alone would have led to the wrong verdict.

Provider probes captured the main request by finding its exact user message,
`Return only OK for settings feasibility`, instead of assuming the first request
belonged to the main turn. Reminder requests can arrive first and use their own
low effort. With requested ultra, the identified 1.1.1 main request contained no
reasoning object; the 1.2.1 main request contained effort max and summary auto.
The 1.2.1 alternate-model main request used fake-model-alternate. These establish
provider-request behavior, not model quality or every setting's end-to-end effect.

Initial no-tool probes timed out waiting for turn completion because the fixture
returned plain text to reminder tool requests. They are not recorded as completed
turns or fresh compaction evidence. Refined bounded probes inspect the main
request and close their own host after capture. Historical compaction/worker/
retry/output blockers remain dated 1.1.1 observations until their explicit m6
rechecks; this report does not generalize them to all host versions.

## Reproduction and sources

Local diagnostics remain in gitignored `artifacts/w2-010/` and
`artifacts/w2-feasibility/`: native/auto approval scripts, deny-no-client-121.log,
settings.mjs and shape-ultra-111/121.log. They import the built repository loopback
fixture. Select the exact binary with MUSE_CODE_EXECUTABLE. The settings probe
accepts PROBE_MODEL and PROBE_EFFORT; inspect the request containing the exact user
message above. Temporary provider roots/targets are removed by the probes.
These are research artifacts; m4/m5 must add durable regression coverage.

Primary sources inspected:

- [SDK source and public reference](https://github.com/meta-models/muse-code-sdk), pinned local `node_modules/@muse-code/sdk/dist/src/msp.d.ts`: command/notification map, session config, model and turn settings.
- [SDK approval handler contract](https://github.com/meta-models/muse-code-sdk/blob/main/clients/sdk-ts/README.md): server-minted choice IDs and public client decisions.
- [Upstream effort issue #6](https://github.com/meta-models/muse-code-sdk/issues/6) and [model issue #7](https://github.com/meta-models/muse-code-sdk/issues/7): still open when checked, but their original reports concern 1.0.3; they do not override fresh 1.2.1 evidence.
- Public `muse serve --help` on installed hosts: sandbox posture fixed for host lifetime, approval selected on the wire.
- Adapter `src/modes.ts`, `src/config-options.ts`, `src/muse-sdk-host.ts`, `src/muse-sdk.ts` and `src/host-configuration.ts`: SDK dangerous-mode exclusion, hard-coded onRequest, fixed effort list, model setters and current host keys.
- Existing w1/m9, m11, m14, m15, m17, m20, m21 and m23 evidence, plus [preserved m25 source](../done/m4/sources.md).

## Handoff validation

All 28 new tasks start todo. Only delivered prerequisites w1/m10/t008 and
w1/m8/t007 are referenced outside the new milestones. No unnecessary dependency
forces approval work to wait for the broader audit, or settings work to wait for
sandbox implementation. Each milestone includes adoption, simplification, CI and
physical closeout. Board validation checks task IDs, dependency existence/cycles,
source links, supersession scope, index counts and Markdown formatting.

## Scheduling supersession — w1 cleanup

The subsequent user request to clean w1 has been executed in the
[exact ownership ledger](../../ownership-2026-09-14.md). Its current/future split
supersedes this report's prospective w1 ownership references and the initial
28-task total: m5 now includes explicit gateway and recommendation tasks, and
m7–m10 own extracted current delivery. Old m9/m11/m14/m15/m17/m20/m21/m23 sources
remain evidence, not active duplicate implementation queues.
