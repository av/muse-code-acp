import { RequestError } from "@agentclientprotocol/sdk";
import type { MuseInputPart } from "./prompt-content.js";

interface SteeringRequest<Target, Result> {
  target: Target;
  expectedTurnId: string;
  input: MuseInputPart[];
  resolve(value: Result): void;
  reject(reason: unknown): void;
}

/** Serializes corrections against their captured turn, never a replacement turn. */
export class SteeringQueue<Target, Result> {
  private readonly pending: SteeringRequest<Target, Result>[] = [];
  private running = false;
  private closed = false;

  constructor(
    private readonly options: {
      isCurrent(target: Target, expectedTurnId: string): boolean;
      dispatch(target: Target, expectedTurnId: string, input: MuseInputPart[]): Promise<Result>;
    },
  ) {}

  enqueue(
    target: Target,
    expectedTurnId: string,
    input: readonly MuseInputPart[],
  ): Promise<Result> {
    if (this.closed) return Promise.reject(this.closedError());
    if (this.pending.length >= 16)
      return Promise.reject(
        RequestError.invalidRequest(
          undefined,
          "steering queue is full; wait for pending corrections",
        ),
      );
    const result = new Promise<Result>((resolve, reject) => {
      this.pending.push({
        target,
        expectedTurnId,
        input: input.map((part) => ({ ...part })),
        resolve,
        reject,
      });
    });
    void this.drain();
    return result;
  }

  /** Undispatched work fails immediately; the active host request owns its cancellation. */
  close(): void {
    this.closed = true;
    for (const request of this.pending.splice(0)) request.reject(this.closedError());
  }

  private closedError(): RequestError {
    return RequestError.invalidRequest(undefined, "steering queue is closed");
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length > 0) {
        const request = this.pending.shift()!;
        try {
          if (!this.options.isCurrent(request.target, request.expectedTurnId)) {
            throw RequestError.invalidRequest(
              undefined,
              "steering target is no longer the active turn",
            );
          }
          request.resolve(
            await this.options.dispatch(request.target, request.expectedTurnId, request.input),
          );
        } catch (error) {
          request.reject(error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
