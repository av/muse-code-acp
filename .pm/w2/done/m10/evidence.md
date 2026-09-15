# m10 delivery evidence — 2026-09-14

Implemented current adapter surfaces, independently of future native features.

- `prompt-content.ts` preserves ordering and attribution for embedded image bytes and explicitly base64-encoded binary resources. The real provider received the PNG as `input_image` with its exact data URI, plus encoded 00ff01 bytes and their source URI. Aggregate bounds, malformed/null input and unsupported document types reject before execution. This is byte transport, not semantic document decoding.
- `/skills` uses the existing public CLI catalog; `/logout` uses public logout, closes all adapter sessions and reports an exported key as still configured/unknown. Real-host and ACP wire checks observe no provider/turn-start call for local commands.
- `/rename` persists adapter preferences and overrides generated titles at the shared notification boundary and list surface. Unicode title survives disposal/reload and a subsequent real turn. No private Muse logs change. Public native `session/rename` separately accepts slug names on 1.2.1 and rejects free-text spaces; 1.1.1 reports method-not-found.
- Compatible `_session/steering` negotiation reuses the existing exact-target queue, snapshots the active handle at admission and never starts an idle turn. Wire tests cover stale explicit targets, cancellation and one-turn identity; both real hosts deliver the correction to the provider during an active tool cycle. The response is admission, not a guarantee of provider consumption; idle compatibility is intentionally not claimed.
- Search cards use public `search.pattern` / `web_search.query`, ACP search kind and bounded titles. Real native file search confirms the rendered query; output/citations are not fabricated.

Simplification reviewed shared content validation, CLI skills/logout ownership,
steering queue reuse and one title-precedence boundary. A regression for null
embedded resources was fixed to preserve ACP invalid-params rather than TypeError.
A native steering test now synchronizes on the provider request and observes the
subsequent tool cycle instead of treating an early acknowledgement as delivery.

Validation: `npm run check`, `npm run build`; full unit suite with one worker;
required loopback suite with two workers on Muse 1.2.1-R2847.1 and
1.1.1-R2514.1. Local logs are under `artifacts/w2-m10/`. No paid providers or
publication. See [user contract](../../../../docs/session-commands.md).

Final results: check/build passed; 457 unit tests in 73 files passed. Full
required native suites passed 56 tests in 16 files on each host; the revised
steering/content suite additionally passed two tests on each host. The 1.1.1
full suite was rerun after the synchronization correction. No required skips.
