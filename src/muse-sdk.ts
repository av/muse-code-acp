import { PromptResponse, RequestError, SessionNotification } from "@agentclientprotocol/sdk";
import {
  Connection,
  MuseClient,
  MspError,
  spawnMspConnection,
  readSessionDurability,
  isLaunchFailure,
  type TurnOutcome,
  type FoldedItem,
} from "@muse-code/sdk";
import packageJson from "../package.json" with { type: "json" };
import { realpathSync } from "node:fs";
import { Logger } from "./logger.js";
import { museCliPath } from "./muse-cli.js";
import { assertSdkHostSupport, sdkHostExitMessage } from "./muse-host.js";
import { MuseSdkTranslator } from "./muse-sdk-events.js";
import type { MuseTextInputPart } from "./prompt-content.js";
import { Pushable } from "./utils.js";

export interface MuseSdkOptions {
  sessionId: string;
  cwd: string;
  /** Ordered Muse turn input parts (text encodings of ACP content). */
  input: MuseTextInputPart[];
  model: string;
  reasoningEffort: string;
  readOnly: boolean;
  museBinary?: string;
  env: Record<string, string | undefined>;
  logger: Logger;
  /** When false, skip the serve --help probe (tests with fake-msp). */
  checkHost?: boolean;
}

export interface MuseSdkHandle {
  updates: AsyncIterable<SessionNotification>;
  done: Promise<PromptResponse>;
  kill(): void;
}

/**
 * One durable `muse serve` host per turn. MuseClient/Session own MSP framing,
 * fold routing, and turn waits; this adapter translates folded items into ACP
 * updates and maps terminals/errors to PromptResponse / RequestError.
 */
export function spawnMuseSdkTurn(options: MuseSdkOptions): MuseSdkHandle {
  if (options.checkHost !== false) {
    assertSdkHostSupport(options.env, options.museBinary);
  }
  const updates = new Pushable<SessionNotification>();
  const translator = new MuseSdkTranslator(options.sessionId, options.logger);
  const args = ["serve", ...(options.readOnly ? ["--disable-write", "--disable-shell"] : [])];
  const binary = options.museBinary ?? museCliPath(options.env);
  options.logger.log(`muse-sdk spawn: ${binary} ${args.join(" ")}`);

  let client: MuseClient | undefined;
  let connection: Connection | undefined;
  let turnId: string | undefined;
  let cancelled = false;
  let finished = false;
  let cancelTimer: ReturnType<typeof setTimeout> | undefined;
  let failTurn!: (error: unknown) => void;
  const turnFailure = new Promise<never>((_, reject) => {
    failTurn = reject;
  });
  void turnFailure.catch(() => {});

  const handshake = spawnMspConnection({
    command: binary,
    args,
    cwd: options.cwd,
    env: options.env as Record<string, string>,
    shutdownTimeoutMs: 1_000,
    onStderr: (chunk) => options.logger.log(`muse-sdk stderr: ${chunk.trimEnd()}`),
  });

  const close = async () => {
    if (client) {
      await client.close().catch(() => {});
      return;
    }
    await handshake.close().catch(() => {});
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
      const host = await handshake.initialize({
        clientInfo: { name: "muse_code_acp", version: packageJson.version },
      });
      if (host.fingerprintWarning) {
        options.logger.log(`muse-sdk: ${host.fingerprintWarning.message}`);
      }
      connection = host.connection;
      client = new MuseClient(host.connection, {
        durability: readSessionDurability(host.initializeResult),
        host,
      });

      void host.child.exit.then((exit) => {
        if (finished || cancelled) {
          return;
        }
        if (exit.kind === "sdkSurfaceUnavailable") {
          failTurn(
            new Error(
              sdkHostExitMessage(exit.stderrTail.join("\n")) ??
                "the experimental SDK tier is disabled",
            ),
          );
        }
      });

      let session;
      try {
        session = await client.resumeSession({
          sessionId: options.sessionId,
          excludeItems: true,
        });
      } catch (error) {
        if (!(error instanceof MspError) || error.code !== -32020) {
          throw error;
        }
        session = await client.startSession({
          sessionId: options.sessionId,
          workspaceRoot: options.cwd,
          modelId: options.model,
        });
      }

      const opening = session.opening;
      const openedSession =
        opening?.verb === "session/resume"
          ? opening.result.session
          : opening?.verb === "session/start"
            ? opening.result.session
            : undefined;
      if (!openedSession || openedSession.sessionId !== options.sessionId) {
        throw new Error("Muse SDK returned a different session ID");
      }
      if (
        openedSession.workspaceRoot &&
        realpathSync(openedSession.workspaceRoot) !== realpathSync(options.cwd)
      ) {
        throw new Error("Muse SDK cannot switch a saved session to a different workspace");
      }
      const pending =
        opening?.verb === "session/resume" ? (opening.result.pendingRequests ?? []) : [];
      if (openedSession.activeTurnId || pending.length > 0) {
        throw new Error(
          "The saved Muse session has an unfinished turn or pending input; resolve it in Muse before continuing",
        );
      }
      if (openedSession.modelId !== options.model) {
        await connection.command("session/setModel", {
          sessionId: options.sessionId,
          model: { modelId: options.model },
        });
      }

      session.onApproval((request) => {
        throw new Error(
          `Muse requested approval for ${request.toolName}; interactive approvals ` +
            "are not implemented in the minimal SDK backend",
        );
      });
      session.onApprovalError((failure) => {
        failTurn(
          failure.kind === "handlerThrew"
            ? failure.error
            : new Error(`Muse approval round-trip failed (${failure.kind})`),
        );
      });
      session.onGapError(() => {
        failTurn(new Error("Muse SDK reported a gap in the turn stream; reload the session"));
      });

      if (cancelled) {
        return { stopReason: "cancelled" };
      }

      const turn = await session.sendUserTurn({
        input: options.input,
        // Session config stores muse CLI effort strings; MSP accepts the subset it knows.
        ...(options.reasoningEffort
          ? { reasoningEffort: options.reasoningEffort as "low" | "medium" | "high" }
          : {}),
      });
      turnId = turn.turnId;
      clearTimeout(startupTimer);

      const emitItem = (item: FoldedItem) => {
        if (session.fold.pendingUserInputs.length > 0) {
          failTurn(
            new Error("Muse requested user input; the minimal SDK backend cannot answer it"),
          );
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

      // deltas() is live-only; catch up anything folded before the turn ack.
      for (const item of session.fold.items.list()) {
        if (item.turnId !== turn.turnId) {
          continue;
        }
        emitCaughtUp(item, session.fold.items.accumulated(item.itemId) ?? "");
      }

      const pumpItems = (async () => {
        for await (const item of turn.items()) {
          emitItem(item);
        }
      })();
      const pumpDeltas = (async () => {
        for await (const delta of turn.deltas()) {
          for (const update of translator.fromDelta(delta)) {
            updates.push(update);
          }
        }
      })();

      const outcome = await Promise.race([turn.completed, turnFailure]);
      await Promise.all([pumpItems.catch(() => {}), pumpDeltas.catch(() => {})]);
      return terminalResponse(outcome);
    } catch (error) {
      if (cancelled) {
        return { stopReason: "cancelled" };
      }
      if (error instanceof RequestError) {
        throw error;
      }
      const stderr = handshake.child.stderrTail.join("\n").trim();
      const mapped = sdkHostExitMessage(stderr);
      throw RequestError.internalError(
        undefined,
        `Muse SDK turn failed: ${mapped ?? (error instanceof Error ? error.message : String(error))}` +
          (stderr && !mapped ? `\n${stderr}` : ""),
      );
    } finally {
      finished = true;
      clearTimeout(startupTimer);
      clearTimeout(cancelTimer);
      await close();
      updates.end();
    }
  })();
  void done.catch(() => {});
  return { updates, done, kill };
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
