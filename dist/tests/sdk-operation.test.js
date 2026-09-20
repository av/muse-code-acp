import { expect, it, vi } from "vitest";
import { SdkOperation, SdkCancelled, sdkDeadline } from "../sdk-operation.js";
it("gives slow initialization and preparation independent budgets and retains the first cause", async () => {
    vi.useFakeTimers();
    try {
        const stop = vi.fn();
        const op = new SdkOperation(stop);
        op.enter("initializing", sdkDeadline({}, "STARTUP"));
        await vi.advanceTimersByTimeAsync(29012);
        expect(await op.wait(Promise.resolve("ready"))).toBe("ready");
        op.enter("preparing", sdkDeadline({}, "STARTUP"));
        await vi.advanceTimersByTimeAsync(29012);
        expect(await op.wait(Promise.resolve("restored"))).toBe("restored");
        op.enter("submitting", 100);
        const waiting = op.wait(new Promise(() => { }));
        const failed = expect(waiting).rejects.toThrow("submitting timed out");
        await vi.advanceTimersByTimeAsync(100);
        await failed;
        op.fail(new Error("connection reached EOF"));
        op.fail(new SdkCancelled("cancelled later"));
        expect(stop).toHaveBeenCalledTimes(1);
        expect(op.error(new Error("EOF"), {}).data).toMatchObject({
            failure: {
                kind: "deadlineExceeded",
                phase: "submitting",
                execution: "possiblySubmitted",
                outcome: "unknown",
            },
        });
        expect(() => op.enter("running")).toThrow("submitting timed out");
        op.dispose();
    }
    finally {
        vi.useRealTimers();
    }
});
it("rejects late readiness after cancellation and reports no submission", async () => {
    const stop = vi.fn();
    const op = new SdkOperation(stop);
    op.enter("initializing", 1000);
    op.fail(new SdkCancelled("cancelled"));
    await expect(op.wait(Promise.resolve("late host"))).rejects.toThrow("cancelled");
    expect(op.error(new Error("EOF"), {}).data).toMatchObject({
        failure: { execution: "notSubmitted", outcome: "failed" },
    });
    op.dispose();
});
it("validates configured deadlines and redacts pre-submission diagnostics", () => {
    for (const value of ["", "0", "-1", "NaN", "2147483648"])
        expect(() => sdkDeadline({ MUSE_CODE_ACP_STARTUP_TIMEOUT_MS: value }, "STARTUP")).toThrow();
    const op = new SdkOperation(() => { });
    const failure = op.error(new Error("secret-value"), { META_API_KEY: "secret-value" });
    expect(failure.message).not.toContain("secret-value");
    expect(failure.message).toContain("No model turn was submitted");
    op.dispose();
});
it("starts the read budget after initialization and identifies read timeouts as non-executing", async () => {
    vi.useFakeTimers();
    try {
        const op = new SdkOperation(() => { });
        op.enter("initializing", 120000);
        await vi.advanceTimersByTimeAsync(29012);
        op.enter("reading", 20000);
        await vi.advanceTimersByTimeAsync(19999);
        expect(await op.wait(Promise.resolve("page"))).toBe("page");
        await vi.advanceTimersByTimeAsync(1);
        expect(op.error(new Error("EOF"), {}).data).toMatchObject({
            failure: { kind: "deadlineExceeded", phase: "reading", execution: "notSubmitted" },
        });
        op.dispose();
    }
    finally {
        vi.useRealTimers();
    }
});
