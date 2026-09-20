import { RequestError } from "@agentclientprotocol/sdk";
/** Serializes corrections against their captured turn, never a replacement turn. */
export class SteeringQueue {
    options;
    pending = [];
    running = false;
    closed = false;
    constructor(options) {
        this.options = options;
    }
    enqueue(target, expectedTurnId, input) {
        if (this.closed)
            return Promise.reject(this.closedError());
        if (this.pending.length >= 16)
            return Promise.reject(RequestError.invalidRequest(undefined, "steering queue is full; wait for pending corrections"));
        const result = new Promise((resolve, reject) => {
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
    close() {
        this.closed = true;
        for (const request of this.pending.splice(0))
            request.reject(this.closedError());
    }
    closedError() {
        return RequestError.invalidRequest(undefined, "steering queue is closed");
    }
    async drain() {
        if (this.running)
            return;
        this.running = true;
        try {
            while (this.pending.length > 0) {
                const request = this.pending.shift();
                try {
                    if (!this.options.isCurrent(request.target, request.expectedTurnId)) {
                        throw RequestError.invalidRequest(undefined, "steering target is no longer the active turn");
                    }
                    request.resolve(await this.options.dispatch(request.target, request.expectedTurnId, request.input));
                }
                catch (error) {
                    request.reject(error);
                }
            }
        }
        finally {
            this.running = false;
        }
    }
}
