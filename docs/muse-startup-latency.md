# Muse startup with populated history

Muse 1.3.0-R3057.1 can spend seconds traversing historical session directories
before replying to the public SDK initialize request. This occurs without the
ACP adapter or a model turn. The precise native routine performing traversal
still needs upstream attribution ([upstream #11](https://github.com/meta-models/muse-code-sdk/issues/11)); no private protocol or native storage rewrite
is part of the adapter workaround.

Reproduce with Node 22+, the repository's installed SDK 0.1.1, and a pinned native
Muse executable (not its auto-updating launcher):

```sh
node scripts/reproduce-muse-startup.mjs /absolute/path/to/native/muse 6000 16
```

The script creates temporary dummy credentials and settings pointing at a
loopback endpoint that cannot perform inference. It generates 6,000 session-shaped
directories containing only empty files. It compares empty and populated data at
concurrency 1 and 16, then moves the same synthetic tree outside `muse/sessions`
and repeats initialization. It closes hosts and removes its temporary directory.
It never moves or deletes the user's existing history. JSON lines report phase
and cleanup timings plus HTTP request counts.

A run on macOS ARM64, Muse 1.3.0-R3057.1, SDK 0.1.1 (2026-09-15 UTC):

| Data tree                   | Concurrency |       Initialize | model/list |
| --------------------------- | ----------: | ---------------: | ---------: |
| Empty                       |           1 |            80 ms |       3 ms |
| Empty                       |          16 |       105–131 ms |     0–2 ms |
| 6,000 synthetic sessions    |           1 |           998 ms |      <1 ms |
| 6,000 synthetic sessions    |          16 | 11,831–12,023 ms |     0–4 ms |
| Same files outside sessions |           1 |            57 ms |      <1 ms |

No HTTP requests or inference turns occurred. Timings depend on machine load;
an earlier run of the same tree shape took about 17 seconds at concurrency 16.
The placement control and direct SDK path establish that historical directory
traversal is sufficient to cause slow startup. Increasing adapter discovery's
five-second timeout does not remove that work.

The adapter now creates sessions without automatic catalog-only hosts. It reads
catalogs on already required execution connections and offers `/models` for an
explicit pre-turn refresh. It preserves the requested provider route when a
catalog arrives during a turn. Necessary native host startup can remain slow.

Automation clients should retain ACP processes/sessions where appropriate.
Choosing a separate persistent data home explicitly can isolate unrelated batch
work, but it also changes session visibility and catalog/cache context. The
adapter does not silently change `XDG_DATA_HOME`, lower client concurrency,
share execution sessions across clients, or change credential storage.

A separate experiment with a synthetic HOME and the default macOS credential
backend blocked in Keychain authorization. Reproduction above explicitly uses
file-backed dummy credentials to keep that independent condition out of the
history-size comparison. That is not evidence that changing credential storage
fixes native history traversal.
