# Embedded input and session commands

Embedded image resources (`resource.blob` with PNG/JPEG/GIF/WebP MIME type) become
an attributed text header followed by the actual image part. URI, annotations
and supplied metadata remain data; the adapter does not fetch the URI. Mixed
text/resources/images preserve order. Total decoded image input is limited to
6 MiB per prompt. Base64 syntax and supported MIME types are checked before a
turn starts; image codec interpretation remains the host/provider's responsibility.

`application/octet-stream` and `text/plain` blobs can be sent as explicitly
base64-encoded bytes inside attributed text, within the shared 64 KiB serialized
embedded-context budget. This preserves bytes; it does not decode PDF or office
documents, interpret arbitrary binary content, or imply native document support.
Other document/audio MIME types and malformed or oversized input are rejected.

SDK local commands:

| Command         | Effect                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `/models`       | Refreshes the model menu without inference; reuses a ready host or explicitly waits for catalog startup. |
| `/skills`       | Lists Muse's public skills catalog, including activation and scope.                                      |
| `/rename title` | Persists a free-text title in adapter preferences.                                                       |
| `/logout`       | Runs public Muse logout and closes adapter sessions and cached hosts.                                    |

These commands do not submit a model turn. Use one command alone; attached
content and accompanying instructions are not executed. Logout cannot unset an
exported `META_API_KEY`; the result says when credentials remain configured.
A closed session must be loaded again or replaced before prompting.

User titles survive adapter restart and take precedence over generated/fallback
titles in list, load and live metadata. They are adapter-owned, not a claim of
native cross-client title mutation. Muse 1.2.1's separate `session/rename` accepts
allocated slug names (the real probe accepted `user-title-marker` and rejected a
name with spaces); existing native names are displayed when there is no adapter
user title. No private Muse history is edited.

## Compatible steering

The original `muse/steering = 1` / `_muse/steer` contract still requires
`expectedTurnId`. Clients may additionally negotiate
`clientCapabilities._meta.steering = {"supported": true}` and use:

```json
{
  "method": "_session/steering",
  "params": { "sessionId": "…", "prompt": [{ "type": "text", "text": "correction" }] }
}
```

The response is `{"outcome":"injected"}` after host admission. This maps the
reference method's active-turn behavior: the adapter captures the active handle
at request admission, then checks the same handle/turn again when a queued request
runs. An optional `expectedTurnId` retains stronger client-side targeting. Without
it, the request targets the active turn at arrival, not an inferred earlier turn.
Stale queued work fails instead of targeting a successor. Idle requests always
fail; the reference's `startedNewTurn` fallback is intentionally unsupported, so
this is active-turn compatibility, not full behavioral parity. No duplicate model
turn is introduced. Images and embedded content share normal prompt validation.

Search cards use only public structured arguments: native file `search.pattern`
and `web_search.query` supply a bounded title, with ACP's search tool kind. Generic
output remains visible when those fields are absent; the adapter does not invent
citations or parse private provider search payloads. Legacy exec keeps its generic
tool presentation where public arguments are unavailable.
