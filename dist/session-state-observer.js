export const SESSION_STATE_EXTENSION = "muse/sessionState";
/** Reporting only: latest folded state plus durable persistence facts the SDK drops. */
export class SessionStateObserver {
    sessionId;
    publish;
    log;
    last = new Map();
    policies = new Map();
    cursor;
    stopped = false;
    polling = false;
    pagingUnavailable = false;
    nextPageAt = 0;
    constructor(sessionId, publish, log) {
        this.sessionId = sessionId;
        this.publish = publish;
        this.log = log;
    }
    watchPolicy(approvalId, cursor) {
        if (this.stopped || this.policies.has(approvalId))
            return;
        this.policies.set(approvalId, false);
        // A cursor must be host-observed, never constructed from an approval ID.
        this.cursor ??= cursor;
    }
    stop() {
        this.stopped = true;
        this.policies.clear();
    }
    async poll(fold, connection) {
        if (this.stopped || this.polling || !fold.current)
            return;
        this.polling = true;
        try {
            const model = fold.sessionState.get("session/modelChanged");
            const mode = fold.sessionState.get("session/approvalModeChanged");
            const values = {
                ...(model !== undefined
                    ? {
                        model: model === null
                            ? null
                            : {
                                modelId: model.modelId,
                                ...(typeof model.source === "string" ? { source: model.source } : {}),
                                ...(model.providerId == null ? {} : { providerId: model.providerId }),
                            },
                    }
                    : {}),
                ...(mode !== undefined
                    ? {
                        approvalMode: mode === null
                            ? null
                            : {
                                mode: mode.mode,
                                ...(typeof mode.source === "string" ? { source: mode.source } : {}),
                            },
                    }
                    : {}),
            };
            const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => {
                const signature = JSON.stringify(value);
                if (this.last.get(key) === signature)
                    return false;
                this.last.set(key, signature);
                return true;
            }));
            if (Object.keys(changed).length)
                await this.publish(changed);
            for (const [approvalId, announced] of this.policies) {
                if (this.stopped)
                    return;
                if (!announced) {
                    this.policies.set(approvalId, true);
                    await this.publish({ policyPersistence: { approvalId, status: "unverified" } });
                }
            }
            if (this.stopped ||
                !this.policies.size ||
                !this.cursor ||
                this.pagingUnavailable ||
                Date.now() < this.nextPageAt)
                return;
            this.nextPageAt = Date.now() + 1000;
            let timer;
            try {
                const page = await Promise.race([
                    connection.request("view/page", {
                        sessionId: this.sessionId,
                        cursor: this.cursor,
                        direction: "forward",
                        limit: 100,
                    }),
                    new Promise((_, reject) => {
                        timer = setTimeout(() => reject(new Error("observation timeout")), 1000);
                    }),
                ]);
                if (this.stopped)
                    return;
                if (!Array.isArray(page.events))
                    throw new Error("invalid observation page");
                for (const event of page.events) {
                    const params = event?.params;
                    if (params?.sessionId !== this.sessionId || typeof params.viewCursor !== "string")
                        continue;
                    this.cursor = params.viewCursor;
                    if (event.method !== "approval/updated" ||
                        !this.policies.has(params.approvalId) ||
                        params.change?.kind !== "policyPersistence")
                        continue;
                    const status = params.change.status;
                    if (status !== "failed" && status !== "succeeded")
                        continue;
                    this.policies.delete(params.approvalId);
                    await this.publish({ policyPersistence: { approvalId: params.approvalId, status } });
                    if (this.stopped)
                        return;
                }
                // Follow only observed cursors; an empty/head page keeps the last cursor.
                if (typeof page.nextCursor === "string")
                    this.cursor = page.nextCursor;
            }
            catch {
                // Reporting must not fail or replay a turn. The announced result stays
                // unverified; stop extra reads if this host cannot serve the evidence.
                this.pagingUnavailable = true;
                this.log("Muse policy persistence observation unavailable; persistence remains unverified");
            }
            finally {
                clearTimeout(timer);
            }
        }
        catch {
            this.log("Muse session-state observation delivery failed");
        }
        finally {
            this.polling = false;
        }
    }
}
