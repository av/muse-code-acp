import type { Connection } from "@muse-code/sdk";

/** Public MSP goal fields, kept verbatim rather than normalized to an ACP status. */
export interface ObservedGoal {
  objective: string;
  status: string;
  percentComplete: number;
  currentWork?: string;
  nextWork?: string;
}
export type GoalObservation =
  { status: "known"; goal: ObservedGoal | null } | { status: "unknown"; reason: string };

const unknown = (reason: string): GoalObservation => ({ status: "unknown", reason });
const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export function parseGoalObservation(raw: unknown): GoalObservation {
  if (raw === null) return { status: "known", goal: null };
  const goal = record(raw);
  if (
    !goal ||
    typeof goal.objective !== "string" ||
    typeof goal.status !== "string" ||
    typeof goal.percentComplete !== "number" ||
    !Number.isFinite(goal.percentComplete) ||
    (goal.currentWork !== undefined && typeof goal.currentWork !== "string") ||
    (goal.nextWork !== undefined && typeof goal.nextWork !== "string")
  )
    return unknown("Goal state is unavailable or malformed");
  return {
    status: "known",
    goal: {
      objective: goal.objective,
      status: goal.status,
      percentComplete: goal.percentComplete,
      ...(typeof goal.currentWork === "string" ? { currentWork: goal.currentWork } : {}),
      ...(typeof goal.nextWork === "string" ? { nextWork: goal.nextWork } : {}),
    },
  };
}

/** Read-only recovery: at most 20 pages / 2000 events. Caller owns transport deadline. */
export async function readGoalFromConnection(
  connection: Pick<Connection, "command">,
  sessionId: string,
  initialRead?: unknown,
): Promise<GoalObservation> {
  try {
    const read = record(
      initialRead ??
        (await connection.command(
          "session/read",
          {
            sessionId,
            excludeItems: true,
          },
          { maxAttempts: 1 },
        )),
    );
    if (record(read?.session)?.sessionId !== sessionId)
      return unknown("Goal history belongs to an unavailable or different session");
    const history = record(read?.history);
    if (history?.mode === "snapshot" || history?.mode === "anchoredSnapshot") {
      const snapshot = record(history.snapshot);
      const state = record(snapshot?.state);
      if (snapshot?.schemaVersion === 1 && state && Object.hasOwn(state, "goal")) {
        return parseGoalObservation(state.goal);
      }
    }
    let cursor: string | undefined;
    const cursors = new Set<string>();
    for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
      const page = await connection.command(
        "view/page",
        {
          sessionId,
          direction: "backward",
          limit: 100,
          ...(cursor === undefined ? {} : { cursor }),
        },
        { maxAttempts: 1 },
      );
      if (
        !Array.isArray(page.events) ||
        page.events.length > 100 ||
        (page.nextCursor !== null && (typeof page.nextCursor !== "string" || !page.nextCursor))
      ) {
        return unknown("Goal history returned a malformed page");
      }
      // Pages are ascending even when paging backward. Cursors remain opaque.
      for (let index = page.events.length - 1; index >= 0; index--) {
        const event = record(page.events[index]);
        const params = record(event?.params);
        if (!event || typeof event.method !== "string" || params?.sessionId !== sessionId) {
          return unknown("Goal history returned a malformed or foreign event");
        }
        if (event.method === "session/goalChanged") return parseGoalObservation(params.goal);
      }
      if (page.nextCursor === null) return { status: "known", goal: null };
      if (cursors.has(page.nextCursor)) return unknown("Goal history cursor did not advance");
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
    return unknown("Goal history exceeded the bounded read limit");
  } catch {
    // Provider/host messages may contain secrets; expose only a fixed reason.
    return unknown("Goal history is unavailable, pruned, or could not be read");
  }
}
