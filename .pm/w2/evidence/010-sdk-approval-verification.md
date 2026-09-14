# SDK approval bypass verification — 2026-09-14

Investigated for [w2/010](../done/m4/sources.md) and [w1/m25](../done/m4/sources.md).
No production mode or approval policy was changed by this investigation.

## Result

Native support is host-version dependent. Muse 1.2.1-R2847.1 with SDK 0.1.1
honors allowAll for the tested shell writes; Muse 1.1.1-R2514.1 still requests a
decision. The previous blanket statement that SDK bypass is unsupported was too
broad. Public client-side approval decisions also work on both hosts.

| Host / configuration                                                     | Observed requests or decisions                               | Tool effects                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------- |
| 1.1.1, allowAll at session/start and setApprovalMode                     | 1 request; client sends offered allow_once                   | Workspace marker written only after decision         |
| 1.2.1, allowAll at session/start                                         | 0 requests                                                   | Workspace marker written                             |
| 1.2.1, onRequest then setApprovalMode allowAll                           | completed reconfiguration; 0 requests                        | Workspace marker written                             |
| 1.2.1, onRequest control, client selects reject                          | 1 request                                                    | Marker absent                                        |
| 1.2.1, allowAll, two writes separated by ls                              | 0 decisions                                                  | Both workspace markers written                       |
| Both hosts, onRequest, automatic offered allow_once per stage            | 2 decisions at sourceIndex 0 and 2; terminal false then true | Both workspace markers written                       |
| 1.2.1, native allowAll, outside-workspace write                          | 0 decisions                                                  | Marker absent; shell exit 1, Operation not permitted |
| Both hosts, onRequest plus automatic allow_once, outside-workspace write | 1 automatic decision                                         | Marker absent; shell exit 1, Operation not permitted |

## Method and evidence boundary

Fresh local probes used the actual versioned binaries and the repository's
loopback provider with dummy credentials and isolated session HOME/config/data.
The host was launched with args exactly `["serve"]`: no disable-sandbox, yolo,
disable-approval or trust-workspace flags. The outside target was a fresh
probe-owned directory outside the session workspace; the normal parent process
successfully wrote a control file there, establishing it was otherwise writable.
All session workspaces and outside targets were removed after each run.

Single command: `printf allowed > policy-marker.txt`. Multi-stage command:
`printf one > <workspace>/a.txt; ls <workspace>; printf two > <workspace>/b.txt`.
The outside command used `printf outside > <outside-target>/marker`.
Approval observations came from public Connection notifications, actual decide
responses and filesystem effects, rather than effectiveMode metadata alone.

Automatic decision handling retained the requested view, merged host updates,
deduplicated approvalId/sourceIndex, selected only a host-offered choice with
`decision: approved` and `scope: once`, and sent public approval/decide with the
current host-issued requirementId. No ACP dialog was involved in these standalone
probes. This establishes feasibility, not completed adapter implementation.

SDK 0.1.1 is still the latest npm SDK at verification time. Its
[public README](https://github.com/meta-models/muse-code-sdk/blob/main/clients/sdk-ts/README.md)
documents onApproval handlers returning server-minted choice IDs. Local serve help
states that approval mode is selected on the wire, while sandbox posture is fixed
at host creation. No private API or TUI access was used.

Local runnable probes/logs are retained under `artifacts/w2-010/` (gitignored):
`native.mjs` tests startup/reconfiguration and allow/reject controls; `auto.mjs`
tests multi-stage completion and sandbox denial. They use the built repository
loopback fixture. Select the binary with MUSE_CODE_EXECUTABLE; native arguments
are policy and optional reject, START_POLICY changes the initial mode; auto takes
multi/outside and PROBE_POLICY defaults to onRequest. These are diagnostic probes,
not committed regression coverage.

The sandbox result proves the tested filesystem restriction on macOS ARM64, not
every network, protected-file or tool policy. Native denyUnmatched, host hard-deny
rules, persistence/resume, live mode transitions during approvals, root guards,
cancellation and Linux parity remain integration acceptance work in m25.

## Implementation direction

Keep native approval policy and adapter decision policy distinct. Native allowAll
is a viable 1.2.1 path. An explicitly selected adapter automatic-approval mode can
work across both hosts by resolving host-offered once choices through the existing
fold reconciler. It must be described as automatic client decisions, not as disabling
host enforcement. It cannot override a host denial or grant a choice absent from
the host request. Missing eligible choices must fail closed or request client input.

Preserve sandbox launch settings, safe defaults, session isolation and the existing
stale-requirement/cancellation guards. Do not route automatic decisions through a
synthetic ACP user response; record that the selected adapter policy made them.
Do not auto-answer unrelated user-input questions or URL elicitation. Do not
persist rules by choosing localPersistent/session grants. Preserve plan/readOnly
restrictions and define next-action mode-change semantics before advertising it.
