# Upstream issue — meta-models/muse-code-sdk

**Filed 2026-09-15 as [meta-models/muse-code-sdk#13](https://github.com/meta-models/muse-code-sdk/issues/13)** (open).
This file is the submitted text, retained verbatim; the internal review header and
the link to our [reassessment evidence](2026-09-15-w1-005-delegated-workers.md)
were stripped from the posted body.

Filing note: the behavior below originates in the native `muse serve` host, not in
the TypeScript client tier that this repository publishes. It is filed here
because this is the public contract's issue tracker and the same route carried
[#11](https://github.com/meta-models/muse-code-sdk/issues/11); the maintainers may
want to move it.

---

**Title:** `Item.childSessionId` is documented as readable but `session/read`, `view/page` and `session/resume` all reject it with `-32020`

### Summary

`msp.d.ts` documents `Item.childSessionId` as the public drill-down handle for a
child transcript:

> `subagent`/`reminderChild`: the child's own session id, readable via `session/read`/`view/page` — child transcript drill-down without a second protocol (tdd §4.5.7)

On Muse Code 1.3.0 every observed `childSessionId` is rejected by all three read
paths with `-32020 sessionNotFound`, while the root session succeeds on the same
connection in the same run. Client-side child history is therefore unimplementable
against the documented contract.

A second, related observation is in the last section: no public item carries a
`subagentId`, which leaves the nine declared `subagent/*` methods without a
reachable target. Happy to split that into its own issue if you prefer.

### Environment

- Muse Code **1.3.0 (1.3.0-R3057.1)**, build `ac7280f2aca67769d1455a8847bb502b617d50f6`
- `@muse-code/sdk` **0.1.1**, schema fingerprint `sha256:ab69549a7ebb423fce94068762da0b5ff3cdec1f8fc263dcc17248eda117f852`
- macOS aarch64, Node 22.17.1, default durable `muse serve`

### Reproduction

Self-contained, no credentials and no paid inference — a loopback HTTP server
impersonates the provider endpoint and scripts exactly two tool calls:

It starts a session, launches a one-child workflow via the `workflow` tool, waits
for the child to reach a terminal result, then probes every observed
`childSessionId`, using the root session as a control. Save it as
`reproduce-delegated-workers.mjs` next to a `@muse-code/sdk` 0.1.1 install and run:

```
node reproduce-delegated-workers.mjs /absolute/path/to/muse
```

<details>
<summary>reproduce-delegated-workers.mjs (321 lines, no dependencies beyond <code>@muse-code/sdk</code>)</summary>

```js
// Public SDK-only reproduction for delegated-worker observability on Muse Code.
// No adapter code, no real credentials, no paid inference: a loopback HTTP server
// impersonates the provider endpoint and scripts exactly two tool calls.
//
//   node scripts/reproduce-delegated-workers.mjs /absolute/path/to/native/muse
//
// It answers two questions about the public MSP contract:
//   1. `Item.childSessionId` is documented "readable via `session/read`/`view/page`".
//      Are observed child session ids actually readable?
//   2. `MspMethod` declares nine `subagent/*` methods. Is any `subagentId`
//      reachable from a public item so those methods can be targeted?
//
// Every line of stdout is one JSON row. Exit code is 0 even when the contract
// fails: the rows are the result.
import { spawnMspConnection, MuseClient, readSessionDurability } from "@muse-code/sdk";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const binary = realpathSync(process.argv[2] ?? "");
const OBSERVE_MS = Number(process.env.OBSERVE_MS ?? 20000);
const MODEL_ID = "fake-model";
const ROOT_MARKER = "delegated-worker-root-probe";
const CHILD_MARKER = "delegated-worker-child-probe";
const WORKFLOW_SCRIPT = `export default async function workflow(host) {
  const r = await host.agent({ input: "${CHILD_MARKER}: reply hello" });
  return { status: "ok", ref: r.ref, text: r.text };
}`;

const emit = (row) => console.log(JSON.stringify(row));

// Command ids must be UUIDv7 (MSP SS3.1.1); randomUUID is v4.
function uuidv7() {
  const bytes = Buffer.from(randomUUID().replace(/-/g, ""), "hex");
  const ms = BigInt(Date.now());
  for (let i = 0; i < 6; i += 1) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function probe(method, target, fn) {
  try {
    emit({ row: "probe", method, target, ok: true, result: (await fn()) ?? null });
    return true;
  } catch (error) {
    emit({
      row: "probe",
      method,
      target,
      ok: false,
      code: error.code,
      kind: error.kind,
      message: error.message,
    });
    return false;
  }
}

// ---- loopback provider ------------------------------------------------------
const sse = (value) => `data: ${JSON.stringify(value)}\n\n`;
const frame = (id, status, extra = {}) => ({
  id,
  object: "response",
  model: MODEL_ID,
  status,
  output: [],
  ...extra,
});
const created = (id) =>
  sse({ type: "response.created", sequence_number: 1, response: frame(id, "in_progress") });
const textHead = (text) =>
  created("resp_text") +
  sse({
    type: "response.output_text.delta",
    sequence_number: 2,
    output_index: 0,
    item_id: "msg_text",
    content_index: 0,
    delta: text,
  });
const toolHead = (callId, name, args) =>
  created("resp_tool") +
  sse({
    type: "response.function_call_arguments.done",
    sequence_number: 2,
    output_index: 0,
    item_id: `fc_${callId}`,
    name,
    call_id: callId,
    arguments: JSON.stringify(args),
  });
const tail = (id) =>
  sse({
    type: "response.completed",
    sequence_number: 3,
    response: frame(id, "completed", {
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    }),
  });

let rootCalls = 0;
let childCalls = 0;
const holds = new Set();
const catalog = JSON.stringify({
  object: "list",
  data: [
    {
      id: MODEL_ID,
      object: "model",
      metadata: {
        "muse-code": {
          release_date: "2026-01-01",
          is_hidden: false,
          limit: { context: 1_000_000, output: 1024 },
        },
      },
    },
  ],
});
const server = createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("error", () => {});
  response.on("error", () => {});
  request.on("end", () => {
    if (request.method === "GET" && (request.url ?? "").endsWith("/muse-code/models")) {
      response.writeHead(200, { "content-type": "application/json" }).end(catalog);
      return;
    }
    if (request.method !== "POST" || !(request.url ?? "").endsWith("/responses")) {
      response.writeHead(404).end();
      return;
    }
    const body = Buffer.concat(chunks).toString("utf8");
    let head;
    let id = "resp_text";
    if (rootCalls === 0 && body.includes('"name":"workflow"') && body.includes(ROOT_MARKER)) {
      rootCalls += 1;
      id = "resp_tool";
      head = toolHead(`call_${rootCalls}`, "workflow", { script: WORKFLOW_SCRIPT });
    } else if (body.includes('"name":"submit_result"') && body.includes(CHILD_MARKER)) {
      // A workflow child is granted `submit_result` and must call it; a text-only
      // answer terminates the child as `child_result_missing`, which would be a
      // harness artifact rather than a host finding.
      childCalls += 1;
      id = "resp_tool";
      head = toolHead(`child_${childCalls}`, "submit_result", {
        text: "delegated worker child result",
        notes: null,
      });
    } else {
      head = textHead("ok");
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(head);
    const hold = setTimeout(() => {
      holds.delete(hold);
      if (!response.writableEnded) response.end(tail(id));
    }, 10);
    holds.add(hold);
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

// ---- isolated host environment ---------------------------------------------
const root = mkdtempSync(join(tmpdir(), "muse-delegated-repro-"));
const config = join(root, "config", "muse");
mkdirSync(config, { recursive: true });
writeFileSync(
  join(config, "settings.json"),
  JSON.stringify({
    schema_version: 1,
    model: MODEL_ID,
    reasoning_effort: "none",
    endpoint_transport: { base_url: baseUrl, auth: "bearer" },
  }),
);
writeFileSync(
  join(config, "auth.json"),
  JSON.stringify({ schema_version: 1, providers: { meta: { api_key: "test-dummy-key" } } }),
);
const env = {
  PATH: process.env.PATH,
  HOME: root,
  XDG_CONFIG_HOME: join(root, "config"),
  XDG_DATA_HOME: join(root, "data"),
  TBH_CREDENTIAL_BACKEND: "file",
  TBH_DISABLE_TELEMETRY: "1",
};

const connection = spawnMspConnection({
  command: binary,
  args: ["serve"],
  cwd: root,
  env,
  shutdownTimeoutMs: 1000,
  onStderr: () => {},
});
try {
  const host = await connection.initialize({
    clientInfo: { name: "delegated_worker_repro", version: "0.0.0" },
    capabilities: {},
  });
  emit({
    row: "host",
    serverInfo: host.initializeResult.serverInfo,
    userAgent: host.initializeResult.userAgent,
    schema: host.initializeResult.schema,
  });

  const client = new MuseClient(host.connection, {
    durability: readSessionDurability(host.initializeResult),
    host,
  });
  const session = await client.startSession({
    workspaceRoot: root,
    modelId: MODEL_ID,
    approvalMode: "onRequest",
  });
  const turn = await session.sendUserTurn({ input: [{ type: "text", text: ROOT_MARKER }] });
  await turn.completed;
  // Children outlive the root turn; observe before reading.
  await new Promise((resolve) => setTimeout(resolve, OBSERVE_MS));

  const items = [...session.fold.items.list()];
  const workflow = items.find((item) => item.kind === "workflow");
  emit({
    row: "workflow",
    status: workflow?.status,
    workflowRunId: workflow?.workflowRunId,
    children: workflow?.children,
  });
  emit({
    row: "items",
    kinds: items.map((item) => item.kind),
    // Question 2: does any public item carry a targetable subagent identity?
    subagentItems: items.filter((item) => item.subagentId).length,
    childSessionIds: items.filter((item) => item.childSessionId).length,
  });

  // Question 1: documented child transcript drill-down, with the root session as
  // a control on the same connection.
  const childIds = [
    ...new Set(items.filter((item) => item.childSessionId).map((item) => item.childSessionId)),
  ];
  let childReadsOk = 0;
  let childReadsAttempted = 0;
  for (const sessionId of childIds) {
    const results = [
      await probe("session/read", "child", async () => {
        const read = await host.connection.command("session/read", {
          sessionId,
          excludeItems: false,
        });
        return { historyItems: read.history?.items?.length };
      }),
      await probe("view/page", "child", async () => {
        const page = await host.connection.command("view/page", { sessionId, limit: 10 });
        return { events: page.events?.length };
      }),
      await probe("session/resume", "child", async () =>
        Object.keys((await client.resumeSession({ sessionId })).opening ?? {}),
      ),
    ];
    childReadsAttempted += results.length;
    childReadsOk += results.filter(Boolean).length;
  }
  await probe("session/read", "root", async () => {
    const read = await host.connection.command("session/read", {
      sessionId: session.sessionId,
      excludeItems: false,
    });
    return { historyItems: read.history?.items?.length };
  });
  await probe("view/page", "root", async () => {
    const page = await host.connection.command("view/page", {
      sessionId: session.sessionId,
      limit: 10,
    });
    return { events: page.events?.length };
  });

  // Question 2: the declared controls. Real targets first when any exist, then a
  // known-absent id so a rejection can be told apart from an unimplemented method.
  const targets = items.filter((item) => item.subagentId).map((item) => item.subagentId);
  for (const subagentId of [...targets, "subagent_absent_control"]) {
    await probe("subagent/readResult", targets.includes(subagentId) ? "observed" : "absent", () =>
      host.connection.command("subagent/readResult", {
        commandId: uuidv7(),
        sessionId: session.sessionId,
        subagentId,
      }),
    );
  }

  emit({
    row: "summary",
    childSessionIdsObserved: childIds.length,
    childReadsAttempted,
    childReadsOk,
    subagentItemsObserved: targets.length,
    providerRootCalls: rootCalls,
    providerChildCalls: childCalls,
    // The contract holds only if observed child ids are readable and at least one
    // public item carries a targetable subagentId.
    contractHolds:
      childIds.length > 0 && childReadsOk === childReadsAttempted && targets.length > 0,
  });
  await client.close();
} finally {
  for (const hold of holds) clearTimeout(hold);
  await connection.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(() => resolve()));
  rmSync(root, { recursive: true, force: true });
}
```

</details>

### Observed

```json
{"row":"items","kinds":["userMessage","reminderChild","toolCall","workflow","reminderChild","agentMessage","reminderChild"],"subagentItems":0,"childSessionIds":3}
{"row":"probe","method":"session/read","target":"child","ok":false,"code":-32020,"kind":"sessionNotFound","message":"session 8510f761-5e06-4043-ad41-d8bdaf9a39a1 was not found"}
{"row":"probe","method":"view/page","target":"child","ok":false,"code":-32020,"kind":"sessionNotFound","message":"session 8510f761-5e06-4043-ad41-d8bdaf9a39a1 was not found"}
{"row":"probe","method":"session/resume","target":"child","ok":false,"code":-32020,"kind":"sessionNotFound","message":"session 8510f761-5e06-4043-ad41-d8bdaf9a39a1 was not found"}
{"row":"probe","method":"session/read","target":"root","ok":true,"result":{"historyItems":7}}
{"row":"probe","method":"view/page","target":"root","ok":true,"result":{"events":10}}
{"row":"summary","childSessionIdsObserved":3,"childReadsAttempted":9,"childReadsOk":0,"subagentItemsObserved":0,"contractHolds":false}
```

9 child read attempts, 0 successes; both root controls succeed. `session/list`
returns the root session only. Reproduced on every run, and previously observed
on 1.2.1 with 4 child ids (`session/read` / `session/resume`; this run adds
`view/page`).

### Expected

Either `session/read` / `view/page` accept an observed `childSessionId` as
documented, or the doc comment is corrected to state the conditions under which a
child session is readable — for example if readability is scoped to a child kind,
a lifecycle window, or a capability we are not negotiating.

### Impact

We maintain an unofficial ACP adapter. Without a readable child transcript we
cannot restore worker history after reload, so we advertise
`delegatedWorkers: false` and render workers as flat cards instead of inspectable
child sessions.

### Related: no public item exposes a `subagentId`

`MspMethod` declares nine `subagent/*` methods, all of which take a `subagentId`.
Across our runs no item of kind `subagent` was ever emitted, including for a
workflow child that completed successfully. The child surfaces only as a
`WorkflowChild` inside the `workflow` item's `children[]`:

```json
{
  "childId": "01a0a783-a20d-78a1-949c-b7739987f30d",
  "attempt": 1,
  "status": "terminal",
  "durationMs": 146,
  "terminal": "completed",
  "resultRef": "subagent-result://01a0a783-a20d-78a1-949c-b7739987f30d/task/5211bce6-3166-5c8f-aef7-60f9b3b23b7a#5"
}
```

`WorkflowChild` carries neither `subagentId` nor `childSessionId`, though
`resultRef` uses a `subagent-result://` scheme. The methods are implemented rather
than missing — a fabricated id is rejected with `-32030 commandRejected …
invalid_target`, i.e. after dispatch — but we can find no public route to a valid
target.

Question rather than a defect claim: is the `subagent` item kind expected to be
emitted for workflow children, or does it belong to a delegation route that is not
reachable through the `workflow` tool? If the latter, which public call spawns one?
