import {
  ClientCapabilities,
  PromptResponse,
  RequestError,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import {
  Connection,
  spawnMspConnection,
  isLaunchFailure,
  type TurnOutcome,
  type FoldedItem,
} from "@muse-code/sdk";
import packageJson from "../package.json" with { type: "json" };
import { realpathSync } from "node:fs";
import type { AcpClient } from "./acp-agent.js";
import { Logger } from "./logger.js";
import { isReasoningEffort, type MuseReasoningEffort } from "./config-options.js";
import { museCliPath } from "./muse-cli.js";
import { assertSdkHostSupport, sdkHostExitMessage } from "./muse-host.js";
import {
  approvalStageMetadata,
  approvalToPermissionRequest,
  MuseApprovalRequest,
  PermissionLifecycle,
  resolvePermissionChoice,
} from "./muse-permissions.js";
import { MuseSdkTranslator } from "./muse-sdk-events.js";
import type { MuseInputPart } from "./prompt-content.js";
import {
  MuseUserInputRequest,
  settleUserInput,
  UserInputLifecycle,
  userInputToElicitation,
} from "./muse-user-input.js";
import { MuseSdkHost } from "./muse-sdk-host.js";
export { MuseSdkHost } from "./muse-sdk-host.js";
import { readGoalFromConnection, type GoalObservation } from "./goal-state.js";
import { Pushable } from "./utils.js";

export interface MuseSdkOptions {
  sessionId: string;
  cwd: string;
  /** Ordered Muse turn input parts (text encodings of ACP content). */
  input: MuseInputPart[];
  model: string;
  reasoningEffort: string;
  readOnly: boolean;
  museBinary?: string;
  env: Record<string, string | undefined>;
  logger: Logger;
  /** When false, skip the serve --help probe (tests with fake-msp). */
  checkHost?: boolean;
  acpClient: AcpClient;
  clientCapabilities?: ClientCapabilities;
  /** Read cancelRequested from the ACP session while the turn runs. */
  isCancelled?: () => boolean;
  hostOwner?: MuseSdkHost;
  /** Negotiated active-turn metadata for the namespaced steering request. */
  steering?: boolean;
}

export interface MuseSdkHandle {
  updates: AsyncIterable<SessionNotification>;
  done: Promise<PromptResponse>;
  kill(): void;
  readonly activeTurnId: string | undefined;
  steer(
    input: MuseInputPart[],
    expectedTurnId: string,
  ): Promise<{ turnId: string; status: string }>;
}

/** Read authoritative saved metadata without acquiring a writer lease. */
export async function readMuseSdkSession(
  options: Pick<
    MuseSdkOptions,
    "sessionId" | "cwd" | "env" | "museBinary" | "logger" | "checkHost"
  > & { readGoal?: boolean; allowActive?: boolean },
): Promise<{ modelId: string | null; goal?: GoalObservation }> {
  if (options.checkHost !== false) assertSdkHostSupport(options.env, options.museBinary);
  const handshake = spawnMspConnection({
    command: options.museBinary ?? museCliPath(options.env),
    args: ["serve"],
    cwd: options.cwd,
    env: options.env as Record<string, string>,
    shutdownTimeoutMs: 1000,
    onStderr: (chunk) => options.logger.log(`muse-sdk read: ${chunk.trimEnd()}`),
  });
  const timer = setTimeout(() => {
    void handshake.close().catch(() => {});
  }, 20_000);
  try {
    const host = await handshake.initialize({
      clientInfo: { name: "muse_code_acp", version: packageJson.version },
    });
    const result = await host.connection.command("session/read", {
      sessionId: options.sessionId,
      excludeItems: true,
    });
    const session = result.session as
      | {
          sessionId: string;
          workspaceRoot: string | null;
          modelId: string | null;
          activeTurnId: string | null;
        }
      | undefined;
    if (
      !session ||
      session.sessionId !== options.sessionId ||
      (session.modelId !== null && typeof session.modelId !== "string")
    ) {
      throw new Error("Muse returned invalid saved session metadata");
    }
    if (
      session.workspaceRoot &&
      realpathSync(session.workspaceRoot) !== realpathSync(options.cwd)
    ) {
      throw new Error("Saved Muse session belongs to a different workspace");
    }
    if (
      !options.allowActive &&
      (session.activeTurnId ||
        (Array.isArray(result.pendingRequests) && result.pendingRequests.length))
    ) {
      throw new Error("Saved Muse session has an unfinished turn or pending input");
    }
    return {
      modelId: session.modelId,
      ...(options.readGoal
        ? { goal: await readGoalFromConnection(host.connection, options.sessionId, result) }
        : {}),
    };
  } finally {
    clearTimeout(timer);
    await handshake.close();
  }
}

/** Preserve the public MSP effort vocabulary verified against Muse 1.1.1. */
export function sdkReasoningEffort(effort: string | undefined): MuseReasoningEffort | undefined {
  return isReasoningEffort(effort) ? effort : undefined;
}

/**
 * One durable `muse serve` host per turn. MuseClient/Session own MSP framing,
 * fold routing, and turn waits; this adapter translates folded items into ACP
 * updates and maps terminals/errors to PromptResponse / RequestError.
 */
export function spawnMuseSdkTurn(options: MuseSdkOptions): MuseSdkHandle {
  const updates = new Pushable<SessionNotification>();
  const translator = new MuseSdkTranslator(options.sessionId, options.logger);
  const permissions = new PermissionLifecycle();
  const approvalIds = new Set<string>();
  const userInputs = new UserInputLifecycle();
  const owner = options.hostOwner ?? new MuseSdkHost(options);
  if (!owner.reusable)
    throw RequestError.invalidRequest(
      undefined,
      "Muse SDK host is closed or already serving a turn",
    );
  let successful = false;
  let acquired = false;
  let acceptedTurn = false;
  let pendingSteers = 0;
  let connection: Connection | undefined;
  let turnId: string | undefined;
  let generation = 0;
  let cancelled = false;
  let finished = false;
  let settled = false;
  let stopInteractions!: () => void;
  const interactionsStopped = new Promise<null>((resolve) => {
    stopInteractions = () => resolve(null);
  });
  let cancelTimer: ReturnType<typeof setTimeout> | undefined;
  let failTurn!: (error: unknown) => void;
  const turnFailure = new Promise<never>((_, reject) => {
    failTurn = reject;
  });
  void turnFailure.catch(() => {});

  const close = async () => {
    permissions.disposeAll();
    userInputs.disposeAll();
    await owner.close();
  };

  const startupTimer = setTimeout(() => {
    failTurn(new Error("Muse SDK startup timed out"));
    void close();
  }, 20_000);

  function kill(): void {
    if (cancelled || finished) {
      return;
    }
    cancelled = true;
    stopInteractions();
    if (turnId) {
      permissions.disposeTurn(turnId);
      userInputs.disposeTurn(turnId);
    }
    if (connection && turnId) {
      void connection
        .command("turn/cancel", { sessionId: options.sessionId, turnId }, { maxAttempts: 1 })
        .catch(() => close());
      cancelTimer = setTimeout(() => void close(), 5_000);
    } else {
      void close();
    }
  }

  const done = (async (): Promise<PromptResponse> => {
    try {
      const lease = await owner.acquire(options, failTurn);
      acquired = true;
      connection = lease.host.connection;
      const session = lease.session;

      const adoptTurn = (nextTurnId: string) => {
        if (turnId === nextTurnId && generation > 0) {
          return;
        }
        turnId = nextTurnId;
        generation = permissions.beginTurn(nextTurnId);
        userInputs.beginTurn(nextTurnId);
      };

      session.onApproval(async (request) => {
        if (cancelled || options.isCancelled?.()) {
          throw new Error("permission request cancelled");
        }
        const approval = request as unknown as MuseApprovalRequest;
        // Approvals can arrive before turn/start acknowledgement.
        if (turnId && approval.turnId !== turnId) {
          throw new Error("stale approval for a different turn");
        }
        adoptTurn(approval.turnId);
        const approvalGeneration = generation;
        approvalIds.add(approval.approvalId);
        if (
          !permissions.track(
            approval.approvalId,
            approval.turnId,
            approval.toolCallId,
            approvalGeneration,
          )
        ) {
          throw new Error("stale approval after turn disposal");
        }
        try {
          const response = await Promise.race([
            options.acpClient.requestPermission(
              approvalToPermissionRequest(
                options.sessionId,
                approval,
                options.clientCapabilities?._meta?.["muse/approval"] === 1,
              ),
            ),
            interactionsStopped,
          ]);
          if (!response) {
            throw new Error("permission request ended with its turn");
          }
          if (!permissions.isLive(approval.approvalId, approval.turnId, approvalGeneration)) {
            throw new Error("stale permission response");
          }
          if (cancelled || options.isCancelled?.()) {
            throw new Error("permission request cancelled");
          }
          return { choiceId: resolvePermissionChoice(approval, response) };
        } finally {
          permissions.resolve(approval.approvalId);
        }
      });
      session.onApprovalError((failure) => {
        if (!approvalIds.has(failure.approvalId) || cancelled || options.isCancelled?.()) {
          return;
        }
        failTurn(
          failure.kind === "handlerThrew"
            ? failure.error
            : new Error(`Muse approval round-trip failed (${failure.kind})`),
        );
      });
      // Gap fill runs automatically on wired Sessions. Only hard fill failures
      // become turn errors; recoverable gaps must not abort the prompt.
      session.onGapError((error) => {
        if (cancelled || options.isCancelled?.()) {
          return;
        }
        failTurn(
          new Error(
            `Muse SDK gap fill failed (${error.reason}); reload the session before continuing`,
          ),
        );
      });

      if (cancelled || options.isCancelled?.()) {
        return { stopReason: "cancelled" };
      }

      const turn = await session.sendUserTurn({
        input: options.input,
        ...(sdkReasoningEffort(options.reasoningEffort)
          ? { reasoningEffort: sdkReasoningEffort(options.reasoningEffort)! }
          : {}),
      });
      adoptTurn(turn.turnId);
      acceptedTurn = true;
      if (options.steering)
        updates.push({
          sessionId: options.sessionId,
          update: {
            sessionUpdate: "session_info_update",
            _meta: { "muse/activeTurnId": turn.turnId },
          },
        });
      clearTimeout(startupTimer);

      const emitItem = (item: FoldedItem) => {
        // Hold publication while a gap fill is reconstituting the fold.
        if (!session.fold.current) {
          return;
        }
        for (const update of translator.fromItem(item)) {
          updates.push(update);
        }
      };

      const emitCaughtUp = (item: FoldedItem, accumulated: string): void => {
        emitItem(item);
        const base = item.text ?? "";
        if (!accumulated || accumulated === base) {
          return;
        }
        const delta =
          accumulated.startsWith(base) && accumulated.length > base.length
            ? accumulated.slice(base.length)
            : !base
              ? accumulated
              : "";
        if (!delta) {
          return;
        }
        for (const update of translator.fromDelta({ itemId: item.itemId, delta })) {
          updates.push(update);
        }
      };

      const flushFold = () => {
        if (!session.fold.current) {
          return;
        }
        for (const held of session.fold.items.list()) {
          if (held.turnId === turn.turnId) {
            emitCaughtUp(held, session.fold.items.accumulated(held.itemId) ?? "");
          }
        }
      };

      const publishedApprovals = new Set<string>();
      const publishApprovalResults = () => {
        if (
          options.clientCapabilities?._meta?.["muse/approval"] !== 1 ||
          !session.fold.current ||
          cancelled ||
          options.isCancelled?.()
        )
          return;
        for (const approval of session.fold.resolvedApprovals()) {
          if (approval.turnId !== turnId || publishedApprovals.has(approval.approvalId)) continue;
          publishedApprovals.add(approval.approvalId);
          updates.push({
            sessionId: options.sessionId,
            update: {
              sessionUpdate: "session_info_update",
              _meta: {
                "muse/approval": {
                  approvalId: approval.approvalId,
                  turnId: approval.turnId,
                  decision: approval.decision,
                  resolvedBy: approval.resolvedBy,
                  stages: approval.stageEvidence?.map(approvalStageMetadata),
                },
              },
            },
          });
        }
      };
      const handlePendingUserInputs = async () => {
        for (const pendingInput of session.fold.pendingUserInputs()) {
          const request = pendingInput as unknown as MuseUserInputRequest & {
            userInputId: string;
            turnId: string;
          };
          if (request.turnId !== turnId) {
            continue;
          }
          if (userInputs.has(request.userInputId)) {
            continue;
          }
          if (!userInputs.track(request.userInputId, turnId!, generation)) {
            continue;
          }
          const support = options.clientCapabilities?.elicitation;
          const formOk = support?.form != null;
          if (!formOk || !connection) {
            // Reject the ACP prompt first so turn/completed from cancel cannot
            // win Promise.race and report a successful end_turn.
            failTurn(
              new Error(
                "Muse requested user input but the ACP client did not advertise form elicitation",
              ),
            );
            await connection
              ?.command(
                "userInput/cancel",
                {
                  sessionId: options.sessionId,
                  userInputId: request.userInputId,
                  reason: "client has no form elicitation support",
                },
                { maxAttempts: 1 },
              )
              .catch(() => {});
            userInputs.resolve(request.userInputId);
            return;
          }
          try {
            if (cancelled || options.isCancelled?.()) {
              await settleUserInput(connection, options.sessionId, request, {
                action: "cancel",
              });
              return;
            }
            const response = await Promise.race([
              options.acpClient.createElicitation(
                userInputToElicitation(options.sessionId, request),
              ),
              interactionsStopped,
            ]);
            if (!response || !userInputs.isLive(request.userInputId, turnId!, generation)) {
              return;
            }
            await settleUserInput(connection, options.sessionId, request, response);
          } catch (error) {
            // Invalid answers and failed client RPCs must fail the prompt, not
            // silently terminate a pump while Muse waits forever for input.
            failTurn(error);
            await connection
              .command(
                "userInput/cancel",
                {
                  sessionId: options.sessionId,
                  userInputId: request.userInputId,
                  reason: "client input failed validation or delivery",
                },
                { maxAttempts: 1 },
              )
              .catch(() => {});
            return;
          } finally {
            userInputs.resolve(request.userInputId);
          }
        }
      };

      // deltas() is live-only; catch up anything folded before the turn ack.
      flushFold();

      let foldWasCurrent = session.fold.current;
      const pumpItems = (async () => {
        for await (const item of turn.items()) {
          await handlePendingUserInputs();
          // Replay held items only when a gap fill restores currency.
          if (!foldWasCurrent && session.fold.current) {
            flushFold();
          }
          foldWasCurrent = session.fold.current;
          emitItem(item);
        }
      })();
      const pumpDeltas = (async () => {
        for await (const delta of turn.deltas()) {
          if (!session.fold.current) {
            continue;
          }
          for (const update of translator.fromDelta(delta)) {
            updates.push(update);
          }
        }
      })();
      const pumpUserInput = (async () => {
        while (!finished && !settled && !cancelled) {
          await handlePendingUserInputs();
          publishApprovalResults();
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      })();
      // Observe pump failures immediately, before waiting for turn completion.
      void pumpItems.catch(failTurn);
      void pumpDeltas.catch(failTurn);
      void pumpUserInput.catch(failTurn);

      const outcome = await Promise.race([turn.completed, turnFailure]);
      settled = true;
      stopInteractions();
      await Promise.all([
        pumpItems.catch(() => {}),
        pumpDeltas.catch(() => {}),
        pumpUserInput.catch(() => {}),
      ]);
      // Flush any items that arrived only through gap fill after the last yield.
      flushFold();
      publishApprovalResults();
      const response = terminalResponse(outcome);
      successful = response.stopReason === "end_turn";
      return response;
    } catch (error) {
      if (cancelled || options.isCancelled?.()) {
        return { stopReason: "cancelled" };
      }
      if (error instanceof RequestError) {
        throw error;
      }
      const stderr = owner.stderr;
      const mapped = sdkHostExitMessage(stderr);
      throw RequestError.internalError(
        undefined,
        `Muse SDK turn failed: ${mapped ?? (error instanceof Error ? error.message : String(error))}` +
          (stderr && !mapped ? `\n${stderr}` : ""),
      );
    } finally {
      finished = true;
      stopInteractions();
      clearTimeout(startupTimer);
      clearTimeout(cancelTimer);
      if (turnId) {
        permissions.disposeTurn(turnId);
        userInputs.disposeTurn(turnId);
      }
      permissions.disposeAll();
      userInputs.disposeAll();
      if (acquired)
        await owner.release(!!options.hostOwner && successful && !cancelled && pendingSteers === 0);
      else await owner.close();
      if (options.steering)
        updates.push({
          sessionId: options.sessionId,
          update: { sessionUpdate: "session_info_update", _meta: { "muse/activeTurnId": null } },
        });
      updates.end();
    }
  })();
  void done.catch(() => {});
  return {
    updates,
    done,
    kill,
    get activeTurnId() {
      return acceptedTurn && !finished && !settled && !cancelled ? turnId : undefined;
    },
    async steer(input, expectedTurnId) {
      if (
        !acceptedTurn ||
        !turnId ||
        expectedTurnId !== turnId ||
        !connection ||
        finished ||
        settled ||
        cancelled ||
        owner.closed
      ) {
        throw RequestError.invalidRequest(
          undefined,
          "No matching active Muse turn accepts steering",
        );
      }
      let steerTimer: ReturnType<typeof setTimeout> | undefined;
      pendingSteers++;
      try {
        const deadline = new Promise<never>((_, reject) => {
          steerTimer = setTimeout(() => {
            const error = new Error("Muse steering acknowledgement timed out; outcome is unknown");
            reject(error);
            failTurn(error);
            void owner.close();
          }, 10_000);
        });
        const result = await Promise.race([
          deadline,
          connection.command(
            "turn/steer",
            {
              sessionId: options.sessionId,
              expectedTurnId,
              input,
              ...(sdkReasoningEffort(options.reasoningEffort)
                ? { reasoningEffort: sdkReasoningEffort(options.reasoningEffort)! }
                : {}),
            },
            { maxAttempts: 1 },
          ),
        ]);
        if (result.status !== "accepted")
          throw RequestError.internalError(
            undefined,
            "Muse returned malformed steering acknowledgement",
          );
        if (result.turnId !== expectedTurnId)
          throw RequestError.internalError(
            undefined,
            "Muse acknowledged steering for a different turn",
          );
        return { turnId: result.turnId, status: result.status };
      } finally {
        pendingSteers--;
        clearTimeout(steerTimer);
      }
    },
  };
}

function terminalResponse(outcome: TurnOutcome): PromptResponse {
  if (outcome.kind === "terminalUnknown") {
    throw RequestError.internalError(
      undefined,
      "Muse SDK host died before the turn completed; reload the session",
    );
  }
  if (outcome.kind === "unqueued") {
    throw RequestError.internalError(undefined, "Muse SDK turn was unqueued before launch");
  }
  if (isLaunchFailure(outcome)) {
    throw RequestError.internalError(undefined, "Muse SDK failed to launch the turn");
  }
  const params = outcome.params;
  if (params.terminal === "completed") {
    return { stopReason: "end_turn" };
  }
  if (params.terminal === "cancelled") {
    return { stopReason: "cancelled" };
  }
  if (params.error?.kind === "stepLimit") {
    return { stopReason: "max_turn_requests" };
  }
  const detail = params.error?.message ?? params.reason ?? params.terminal;
  if (params.error?.kind === "authRequired") {
    throw RequestError.authRequired(undefined, `${detail}. Run muse login or set META_API_KEY.`);
  }
  throw RequestError.internalError(undefined, `Muse SDK turn ${params.terminal}: ${detail}`);
}
