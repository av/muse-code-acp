# File-change evidence and reports

SDK tool diffs compare **observed file states**. They do not claim exclusive
attribution to an agent when another process can edit the same workspace.

Before a native turn, the adapter snapshots at most 128 tracked Git paths,
64 KiB per text file and 1 MiB of retained content. Git enumeration has a one-second
budget and 256 KiB output limit. It reads the working tree, so existing user edits
are preserved in the preimage instead of being replaced with index/HEAD content.
There is no mandatory full-workspace snapshot. A host-offered file approval can
refresh that path immediately before the selected approval is submitted.

Successful recognized `write_file` results can render an observed diff when the
preimage is known and bounded post-write content matches the requested text.
Known absence uses `oldText: null`; overwrites use the observed old text. Later
writes can use the previously observed postimage. A visible explanation identifies
these observation points and warns that concurrent edits may contribute.

Uncaptured paths, binary/invalid UTF-8 content, large or changing files, failed
tools, and mismatched postimages retain result text with unavailable evidence.
Content reads stay inside the canonical workspace and reject leaf symlinks.
Missing post-write content is not presented as a precise deletion; shell moves,
deletes, generators and child changes have no precise file-diff claim without
native evidence. No filesystem proxy, mandatory approval, or extra model turn
is introduced for reporting.

The exec backend has no verified preimage mechanism and retains tool result text
and recognized locations. Both backends stop treating a post-write readback alone
as proof that a file was newly created. SDK baseline clients receive observed
diffs without negotiating the optional report extension.

## Optional turn report

The SDK backend implements the version-1 `agentFileChangeReport` wire contract
used by the reference adapter. Initialize with:

```json
{
  "_meta": {
    "jetbrains": {
      "air": { "version": 1, "capabilities": ["agentFileChangeReport"] }
    }
  }
}
```

The agent acknowledges that capability in its initialize metadata. To request a
report for a native SDK prompt, add:

```json
{
  "_meta": {
    "jetbrains": {
      "air": {
        "agentFileChangeReportRequest": { "version": 1, "requestId": "unique-turn-1" }
      }
    }
  }
}
```

IDs contain 1–128 ASCII letters, digits, `.`, `_`, `:` or `-`. Unnegotiated or
malformed requests are ignored. Local inspection commands and requests rejected
before SDK execution do not create a native turn/report.

One `session_info_update` arrives before the prompt response:

```json
{
  "sessionUpdate": "session_info_update",
  "_meta": {
    "jetbrains": {
      "air": {
        "version": 1,
        "agentFileChangeReport": {
          "version": 1,
          "requestId": "unique-turn-1",
          "status": "reported",
          "paths": ["/workspace/changed.txt"],
          "declaredComplete": false,
          "truncated": false,
          "uncertainty": "Only successful native file-tool declarations are included. Shell, generated and child changes may be missing. Observed snapshots may include concurrent user edits."
        }
      }
    }
  }
}
```

Paths are normalized, deduplicated recognized successful file-tool declarations,
not a repository-wide dirty-file list or a guarantee that final content differs.
Pre-existing unrelated edits are excluded. Reports are always partial:
`declaredComplete` remains false because no public Muse evidence establishes
complete shell/generated/child coverage. At most 1,024 paths, 4,096 characters
per path and 256 KiB serialized metadata are retained; reaching a bound sets
`truncated`. Reports contain no file contents.

Cancellation/close returns `status: "unavailable", reason: "cancelled"`. A timed-out
snapshot with no reported paths returns reason `timeout`. Other evidence failures
leave partial observations available. Failed turns retain their original error
and can report already observed file declarations with explicit failure uncertainty.
The client must use unique request IDs and ignore stale or duplicate reports.
There is no automatic audit model turn, commit, rollback or undo operation.
