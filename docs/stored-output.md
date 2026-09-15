# Stored tool output

Muse 1.2.1 can serve full stored shell output after its visible text has been
truncated. SDK clients opt in with `clientCapabilities._meta["muse/output"] = 1`.
The initialize response advertises version 1, method `_muse/readOutput`, and a
maximum of 1048576 bytes per read only on the verified 1.2.1 host. The current
SDK's TypeScript method union omits this documented native method; the adapter
uses the public MSP request, not an output-store path or URI fetch.

When a public tool item has a stored reference, its original tool card carries
`update._meta["muse/output"]` with `sessionId`, `itemId`, `outputRef` (the native
reference ID), `byteLen`, `availability`, and supplied `mediaType`. Only an
available reference carries a read method. Tool call IDs remain unchanged and
async-task metadata is preserved. Baseline clients keep bounded text and clear
truncation notices. Muse 1.1.1 has no verified read surface and receives no
output-read advertisement or handles.

```json
{
  "method": "_muse/readOutput",
  "params": {
    "sessionId": "…",
    "itemId": "…",
    "outputRef": "…",
    "offsetBytes": 0,
    "lengthBytes": 65536
  }
}
```

The result preserves those three IDs and returns native `content`, `encoding`
(`utf8` or `base64`), `mediaType`, `offsetBytes`, actual `byteLen`, and `eof`.
Decode according to the encoding; advance by the actual returned byte length,
not the requested length. Binary output is not silently reinterpreted as text.
A short final page is normal. Offsets are nonnegative safe integers; lengths are
1–1048576 bytes, defaulting to 65536. Native text reads can reject offsets inside
a UTF-8 character; the adapter does not invent replacement bytes.

The session must be known to this adapter. Each read verifies the workspace and
exact session/item/reference association against bounded public history (at most
20 pages of 100 events), then fetches the requested range using a separate
read-only host with the configurable startup budget followed by a 20-second read budget. It acquires no execution lease,
changes no model/configuration and sends no provider turn. Wrong references,
arbitrary URIs, out-of-range offsets and unavailable references fail. References
outside the history budget are explicitly not found rather than guessed.

Actual 300000-byte shell output was read repeatedly and after adapter/host
restart and session load on Muse 1.2.1. Load restores reference metadata after
history replay. References are native, not adapter-cached bytes: missing, expired,
access-failed or unsupported output can still become unavailable. A closed
adapter session must be loaded again. Read failures never replay the model turn.

This delivers stored output only when the host supplies an actual output
reference. It does not recover rich MCP images/audio/resources that the host has
flattened or omitted. Metadata-only media descriptions remain explicit fallbacks;
no captions, paths or unverified endpoints are treated as binary payloads.
