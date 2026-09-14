# Changelog

## Unreleased

- Complete multi-stage shell approvals on the SDK backend. Muse splits a compound command into stages; on 1.2.1 the host advances the approval with `approval/updated` and never re-issues `approval/requested`, which the pinned SDK does not route, so the turn hung with no error. Approvals are now decided from the session fold, asking once per unresolved stage and submitting only host-offered choices.
- Bound every wait on a pending host request: an approval or user input with no outstanding client call and no host progress for `MUSE_CODE_ACP_STALL_MS` (default 10s) now fails the prompt with the requirement and stage evidence instead of waiting indefinitely.
- Stop re-asking a user input that was already answered but never settled by the host.
- Publish `muse/hostCompatibility` on `session_info_update` once per host, with pinned and served schema fingerprints and the detected host version. A mismatch stays advisory.

- Expose session modes through ACP config options, using the same validation and persistence as `set_mode`; synchronize config updates after mode, model, effort and `/plan` changes.
- Centralize backend mode availability so SDK clients cannot select exec-only approval bypass modes through either interface. Native automatic approval remains unverified; this does not resolve unattended execution.

- Recognize SDK slash commands across top-level prompt text blocks and preserve attached text, resources and images through planning and review.
- Execute `/goal <task>` once with an explicit persistence limitation; keep status queries and unavailable goal controls local.
- Add review focus instructions and default Git targets; bare `/plan` enables planning without starting a model turn. Mixed requests containing planning remain planning-only.
- Add conversational command guidance, argument hints and regression coverage for context, mode enforcement, cancellation and real-host denied writes.

## [0.4.1](https://github.com/bex-co/muse-code-acp/compare/v0.4.0...v0.4.1) (2026-09-13)

### Documentation

- Correct the README's host lifecycle, public session discovery and unsupported-worker claims; describe current session, prompt, workflow and negotiated capabilities.
- Add Node.js requirements, pinned-host login and Zed environment examples, explicit host compatibility limits, and accurate standalone distribution scope.
- Group user documentation before development details and use absolute repository links that work from npm.

Documentation-only patch; runtime behavior and dependencies are unchanged. Use Muse Code 1.1.1-R2514.1 with SDK 0.1.1; Muse 1.2.1-R2847.1 remains unsupported.

## [0.4.0](https://github.com/bex-co/muse-code-acp/compare/v0.3.0...v0.4.0) (2026-09-13)

### Features

- Fork native Muse sessions with isolated branch history, preserved model selection and verified restart continuity. Negotiated clients can select a completed-turn boundary.
- Show bounded, observed before/after file diffs and negotiated per-turn file-change reports. Reports explicitly mark partial coverage and concurrent-edit uncertainty; unknown preimages are no longer presented as file creation.
- Discover sessions through public, lease-free pagination, with scoped cursors, title/recency updates and optional fork provenance. Complete chronological load still uses validated export replay.
- Add guarded plan mode and Git review workflows. Planning disables workspace writes and shell execution; implementation requires an explicit mode change.
- Observe native goal state and progress, including autonomous work after the foreground prompt ends. Goal controls remain unadvertised where no verified public API exists.
- Add a reproducible standalone macOS ARM64 build and real-host smoke profile. The npm package remains the Node.js distribution; the standalone adapter still requires an external Muse host.

### Fixes

- Preserve fail-closed behavior when Muse encounters approval-settlement failures, with a safe numeric MSP error code for diagnosis.
- Bound file evidence and session discovery resources, close discovery hosts during disposal, and retire timed-out metadata hosts without replaying completed prompts.
- Publish through explicit GitHub Actions dispatch with OIDC authentication, after validating the exact release commit.

### Upgrading from npm 0.1.x

The previous GitHub 0.2.0/0.3.0 releases did not reach the public npm registry. This release also delivers their SDK-default execution backend, interactive ACP approvals, session close/resume, host reuse, negotiated mid-turn steering, embedded editor context, runtime model discovery, and HTTP MCP support with truthful local diagnostics.

Requires Node.js 22+ and the verified Muse Code **1.1.1-R2514.1** host with `muse serve`, selected with `MUSE_CODE_EXECUTABLE`, and pinned `@muse-code/sdk@0.1.1`. Configure credentials through Muse login or `META_API_KEY`. Explicit legacy execution remains available with `MUSE_CODE_ACP_BACKEND=exec`, with its documented capability differences.

### Known limits

Muse **1.2.1-R2847.1 is not supported**: six of 23 real-host checks failed because legacy exec sessions retained an unavailable `:auto-review` permission profile, and failed HTTP MCP connections no longer failed the prompt. Use the verified 1.1.1 host; do not disable permissions or sandboxing to work around these differences.

This is an unofficial adapter, not a claim of complete ACP/reference parity. Durable compaction, delegated child execution, scheduled retry observations, rich-output retrieval, multiple authorized roots, URL elicitation, account/service-tier APIs, native session deletion and broader approval-policy enforcement remain blocked or unverified on the tested host. File-change reports are partial; session indexes are eventually consistent. Default sandboxing and real host-provided permission gates remain enabled.


## [0.3.0](https://github.com/bex-co/muse-code-acp/compare/v0.2.0...v0.3.0) (2026-09-12)


### Features

* close Muse ACP sessions cleanly ([#4](https://github.com/bex-co/muse-code-acp/issues/4)) ([0aa9979](https://github.com/bex-co/muse-code-acp/commit/0aa99791f07070a623ae541e074a935f7a129dd2))
* discover Muse models and forward embedded editor context ([5188179](https://github.com/bex-co/muse-code-acp/commit/51881796f9b8d07bc82cdeaf9da9911a6a001a55))
* forward ACP prompt content to Muse ([#3](https://github.com/bex-co/muse-code-acp/issues/3)) ([3beeee8](https://github.com/bex-co/muse-code-acp/commit/3beeee88f84c13b5c6ba2947171b148ec0c4156f))
* resume Muse ACP sessions without replay ([#5](https://github.com/bex-co/muse-code-acp/issues/5)) ([dfc1d31](https://github.com/bex-co/muse-code-acp/commit/dfc1d3104f05f7be4b3417454d894885b9e56e44))
* reuse Muse hosts and support negotiated mid-turn steering ([3b26891](https://github.com/bex-co/muse-code-acp/commit/3b268916e294621de845e858ae528aac8373ff28))
* **skills:** add project PM and loop-worker workflows ([d5a2e7d](https://github.com/bex-co/muse-code-acp/commit/d5a2e7db849723fe9fab1e929ec5052fdc9f29c0))
* support HTTP MCP servers and local connection diagnostics ([9b9113e](https://github.com/bex-co/muse-code-acp/commit/9b9113e835dcdc910bda7307a02052759908b6bf))


### Bug Fixes

* harden ACP session lifecycle and prompt metadata ([7b1255f](https://github.com/bex-co/muse-code-acp/commit/7b1255f94fb946a25b80db93682dd2d638d3efa4))

## [0.2.0](https://github.com/bex-co/muse-code-acp/compare/v0.1.1...v0.2.0) (2026-09-12)


### Features

* make SDK the default backend with session continuity (m6) ([bd4f1c3](https://github.com/bex-co/muse-code-acp/commit/bd4f1c3ee2dbc4891236c44995889960ee87f605))
* ship interactive SDK approvals and resilient turns (m5) ([be80f1c](https://github.com/bex-co/muse-code-acp/commit/be80f1ce04a68c57110374a5967b606103ce98a2))
* ship SDK backend ACP wire contracts (m4) ([dcf9081](https://github.com/bex-co/muse-code-acp/commit/dcf90819ec0e8de78210d5140bd5c94efdda055e))


### Bug Fixes

* harden SDK interactions and gate release publishing ([7fe495b](https://github.com/bex-co/muse-code-acp/commit/7fe495b031fb6aec00daebf74ce7237a5120b7ec))

## [0.1.1](https://github.com/bex-co/muse-code-acp/compare/v0.1.0...v0.1.1) (2026-08-28)


### Bug Fixes

* normalize Muse ACP reliability signals ([768f78e](https://github.com/bex-co/muse-code-acp/commit/768f78e4619c0b83934b2179507e0a28024a5b16))
