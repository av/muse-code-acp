import { methods, RequestError } from "@agentclientprotocol/sdk";
import { chmodSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { elicitationToAnswers, isElicitationUnsupported, userInputToChatMessage, userInputToElicitation, } from "../muse-user-input.js";
import { connectTestClient, fixturesDir, newTestSession } from "./helpers.js";
function sdkClient(mode = "userInput") {
    const binary = join(fixturesDir, "fake-msp.cjs");
    chmodSync(binary, 0o755);
    const capture = join(mkdtempSync(join(tmpdir(), "muse-ui-")), "requests.jsonl");
    const testClient = connectTestClient({
        backend: "sdk",
        museBinary: binary,
        skipSdkHostCheck: true,
        env: { ...process.env, FAKE_MSP_MODE: mode, FAKE_MSP_CAPTURE: capture },
    });
    return {
        ...testClient,
        requests: () => readFileSync(capture, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line)),
    };
}
describe("user-input elicitation mapping", () => {
    const request = {
        userInputId: "ui1",
        turnId: "t1",
        itemId: "i1",
        toolCallId: "c1",
        toolName: "ask_user",
        questions: [
            {
                id: "q1",
                header: "Color",
                question: "Pick a color",
                options: [{ label: "red" }, { label: "blue" }],
                selection: { mode: "single" },
            },
        ],
    };
    it("builds a form schema from MSP questions", () => {
        const elicitation = userInputToElicitation("s1", request);
        expect(elicitation.mode).toBe("form");
        expect(elicitation).toMatchObject({
            sessionId: "s1",
            requestedSchema: { required: ["q1"] },
        });
    });
    it("validates answers and treats decline as cancel", () => {
        expect(elicitationToAnswers(request, { action: "decline" })).toBe("cancel");
        expect(elicitationToAnswers(request, { action: "accept", content: { q1: "red" } })).toEqual([
            { questionId: "q1", selectedLabel: "red" },
        ]);
        expect(() => elicitationToAnswers(request, { action: "accept", content: { q1: "green" } })).toThrow(/unknown option/);
    });
    it("preserves multi-select bounds and validates complete unique selections", () => {
        const multiple = {
            ...request,
            questions: [
                {
                    ...request.questions[0],
                    selection: {
                        mode: "multiple",
                        minSelections: 2,
                        maxSelections: 2,
                    },
                },
            ],
        };
        const form = userInputToElicitation("s1", multiple);
        if (form.mode !== "form")
            throw new Error("Expected a form");
        expect(form).toMatchObject({
            requestedSchema: {
                properties: {
                    q1: {
                        type: "array",
                        minItems: 2,
                        maxItems: 2,
                        items: { type: "string", enum: ["red", "blue"] },
                    },
                },
            },
        });
        expect(elicitationToAnswers(multiple, { action: "accept", content: { q1: ["red", "blue"] } })).toEqual([{ questionId: "q1", selectedLabels: ["red", "blue"] }]);
        for (const value of [
            "red",
            ["red"],
            ["red", "red"],
            ["red", "green"],
            ["red", "blue", "green"],
        ]) {
            expect(() => elicitationToAnswers(multiple, { action: "accept", content: { q1: value } })).toThrow(/invalid selections/);
        }
    });
    it("detects a missing elicitation endpoint without swallowing validation errors", () => {
        expect(isElicitationUnsupported({ code: -32601, message: "Method not found" })).toBe(true);
        expect(isElicitationUnsupported(new Error("Method not found"))).toBe(true);
        expect(isElicitationUnsupported({
            code: -32603,
            message: "Internal error",
            data: { details: "Method not found" },
        })).toBe(true);
        expect(isElicitationUnsupported(new Error("elicitation invalid selections for q1"))).toBe(false);
        expect(isElicitationUnsupported(new Error("elicitation selected unknown option"))).toBe(false);
        expect(isElicitationUnsupported(null)).toBe(false);
    });
    it("renders questions as a chat message", () => {
        const text = userInputToChatMessage(request);
        expect(text).toMatch("Pick a color");
        expect(text).toMatch("red");
        expect(text).toMatch("Reply in chat");
    });
    it("rejects overlong free text instead of silently truncating it", () => {
        const free = { ...request, questions: [{ ...request.questions[0], options: [] }] };
        expect(() => elicitationToAnswers(free, { action: "accept", content: { q1: "x".repeat(501) } })).toThrow(/500/);
        expect(elicitationToAnswers(free, { action: "accept", content: { q1: "x".repeat(500) } })[0]).toEqual({ questionId: "q1", freeText: "x".repeat(500) });
    });
});
describe("SDK user input over ACP elicitation", () => {
    it("round-trips multiple selections through the ACP form schema and MSP answer", async () => {
        const client = sdkClient("userInputMultiple");
        client.setElicitationResponder(() => ({ action: "accept", content: { q1: ["red", "blue"] } }));
        const { ctx, sessionId } = await newTestSession(client, { elicitation: { form: {} } });
        try {
            await expect(ctx.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "pick two" }],
            })).resolves.toEqual({ stopReason: "end_turn" });
            expect(client.elicitationRequests[0]).toMatchObject({
                requestedSchema: { properties: { q1: { type: "array", minItems: 2, maxItems: 2 } } },
            });
            expect(client.requests().find((r) => r.method === "userInput/answer").params.answers).toEqual([{ questionId: "q1", selectedLabels: ["red", "blue"] }]);
        }
        finally {
            await client.agent.dispose();
        }
    });
    it("cancels an unanswered dialog and ignores its reply after the next turn", async () => {
        const client = sdkClient();
        let answer;
        client.setElicitationResponder(() => new Promise((resolve) => {
            answer = resolve;
        }));
        const { ctx, sessionId } = await newTestSession(client, { elicitation: { form: {} } });
        try {
            const prompt = ctx.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "ask" }],
            });
            await expect.poll(() => client.elicitationRequests.length).toBe(1);
            await ctx.notify(methods.agent.session.cancel, { sessionId });
            await expect(prompt).resolves.toEqual({ stopReason: "cancelled" });
            expect(client.agent.sessions.get(sessionId)?.activeTurn).toBeNull();
            client.setElicitationResponder(() => ({ action: "accept", content: { q1: "blue" } }));
            await expect(ctx.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "next" }],
            })).resolves.toEqual({ stopReason: "end_turn" });
            answer({ action: "accept", content: { q1: "red" } });
            await Promise.resolve();
            expect(client.requests().filter((r) => r.method === "userInput/answer")).toHaveLength(1);
        }
        finally {
            answer?.({ action: "accept", content: { q1: "red" } });
            await client.agent.dispose();
        }
    }, 5000);
    it("fails and cancels invalid client answers rather than hanging the turn", async () => {
        const client = sdkClient();
        client.setElicitationResponder(() => ({ action: "accept", content: { q1: "invalid" } }));
        const { ctx, sessionId } = await newTestSession(client, { elicitation: { form: {} } });
        try {
            await expect(ctx.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "ask" }],
            })).rejects.toThrow(/unknown option/);
            expect(client.requests().some((r) => r.method === "userInput/answer")).toBe(false);
            expect(client.requests().some((r) => r.method === "userInput/cancel")).toBe(true);
            expect(client.agent.sessions.get(sessionId)?.activeTurn).toBeNull();
        }
        finally {
            await client.agent.dispose();
        }
    });
    it("answers a structured request when the client advertises form support", async () => {
        const client = sdkClient();
        client.setElicitationResponder(() => ({
            action: "accept",
            content: { q1: "blue" },
        }));
        const { ctx, sessionId } = await newTestSession(client, {
            auth: { terminal: true },
            elicitation: { form: {} },
        });
        await expect(ctx.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [{ type: "text", text: "ask" }],
        })).resolves.toEqual({ stopReason: "end_turn" });
        expect(client.elicitationRequests).toHaveLength(1);
        const answer = client.requests().find((r) => r.method === "userInput/answer");
        expect(answer.params.answers).toEqual([{ questionId: "q1", selectedLabel: "blue" }]);
    });
    it("attempts elicitation even when the client did not advertise form support", async () => {
        const client = sdkClient();
        client.setElicitationResponder(() => ({
            action: "accept",
            content: { q1: "blue" },
        }));
        const { ctx, sessionId } = await newTestSession(client, { auth: { terminal: true } });
        try {
            await expect(ctx.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "ask" }],
            })).resolves.toEqual({ stopReason: "end_turn" });
            expect(client.elicitationRequests).toHaveLength(1);
            const answer = client.requests().find((r) => r.method === "userInput/answer");
            expect(answer.params.answers).toEqual([{ questionId: "q1", selectedLabel: "blue" }]);
        }
        finally {
            await client.agent.dispose();
        }
    });
    it("asks in chat and stops the turn when the client has no elicitation endpoint", async () => {
        const client = sdkClient();
        client.setElicitationResponder(() => {
            throw Object.assign(new Error("Method not found"), { code: -32601 });
        });
        client.setPermissionResponder(() => ({
            outcome: { outcome: "selected", optionId: "blue" },
        }));
        const { ctx, sessionId } = await newTestSession(client, { auth: { terminal: true } });
        try {
            await expect(ctx.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "ask" }],
            })).resolves.toEqual({ stopReason: "end_turn" });
            expect(client.elicitationRequests).toHaveLength(1);
            expect(client.permissionRequests).toHaveLength(0);
            expect(client.requests().some((r) => r.method === "userInput/cancel")).toBe(false);
            expect(client.requests().some((r) => r.method === "userInput/answer")).toBe(false);
            expect(client.requests().some((r) => r.method === "turn/cancel")).toBe(true);
            const posted = client.updates
                .filter((u) => u.update.sessionUpdate === "agent_message_chunk")
                .map((u) => u.update.content.text)
                .join("");
            expect(posted).toMatch("Pick a color");
            expect(posted).not.toMatch("hello world");
        }
        finally {
            await client.agent.dispose();
        }
    });
    it("stops the same way when Method not found is wrapped as an internal error", async () => {
        const client = sdkClient();
        client.setElicitationResponder(() => {
            throw RequestError.internalError({ details: "Method not found" });
        });
        client.setPermissionResponder(() => ({
            outcome: { outcome: "selected", optionId: "red" },
        }));
        const { ctx, sessionId } = await newTestSession(client, { auth: { terminal: true } });
        try {
            await expect(ctx.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "ask" }],
            })).resolves.toEqual({ stopReason: "end_turn" });
            expect(client.permissionRequests).toHaveLength(0);
            expect(client.requests().some((r) => r.method === "userInput/answer")).toBe(false);
            expect(client.requests().some((r) => r.method === "turn/cancel")).toBe(true);
        }
        finally {
            await client.agent.dispose();
        }
    });
});
describe("SDK user input when elicitation is unavailable", () => {
    it("fails instead of hanging when the client never answers elicitation", async () => {
        const binary = join(fixturesDir, "fake-msp.cjs");
        chmodSync(binary, 0o755);
        const capture = join(mkdtempSync(join(tmpdir(), "muse-ui-")), "requests.jsonl");
        const client = connectTestClient({
            backend: "sdk",
            museBinary: binary,
            skipSdkHostCheck: true,
            env: {
                ...process.env,
                FAKE_MSP_MODE: "userInput",
                FAKE_MSP_CAPTURE: capture,
                MUSE_CODE_ACP_STALL_MS: "300",
                MUSE_CODE_ACP_INPUT_MS: "300",
            },
        });
        client.setElicitationResponder(() => new Promise(() => { }));
        const { ctx, sessionId } = await newTestSession(client, { auth: { terminal: true } });
        try {
            await expect(ctx.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "ask" }],
            })).rejects.toThrow(/still pending/);
            expect(client.agent.sessions.get(sessionId)?.activeTurn).toBeNull();
        }
        finally {
            await client.agent.dispose();
        }
    });
    it("does not hang on a permission dialog that would never be answered", async () => {
        const binary = join(fixturesDir, "fake-msp.cjs");
        chmodSync(binary, 0o755);
        const capture = join(mkdtempSync(join(tmpdir(), "muse-ui-")), "requests.jsonl");
        const client = connectTestClient({
            backend: "sdk",
            museBinary: binary,
            skipSdkHostCheck: true,
            env: {
                ...process.env,
                FAKE_MSP_MODE: "userInput",
                FAKE_MSP_CAPTURE: capture,
                MUSE_CODE_ACP_STALL_MS: "300",
                MUSE_CODE_ACP_INPUT_MS: "300",
            },
        });
        client.setElicitationResponder(() => {
            throw Object.assign(new Error("Method not found"), { code: -32601 });
        });
        client.setPermissionResponder(() => new Promise(() => { }));
        const { ctx, sessionId } = await newTestSession(client, { auth: { terminal: true } });
        try {
            await expect(ctx.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "ask" }],
            })).resolves.toEqual({ stopReason: "end_turn" });
            expect(client.permissionRequests).toHaveLength(0);
            expect(client.agent.sessions.get(sessionId)?.activeTurn).toBeNull();
        }
        finally {
            await client.agent.dispose();
        }
    });
    it("stops a multi-select question in chat without cancelling it into the model", async () => {
        const client = sdkClient("userInputMultiple");
        client.setElicitationResponder(() => {
            throw Object.assign(new Error("Method not found"), { code: -32601 });
        });
        client.setPermissionResponder(() => {
            throw new Error("request_permission must not be called for a question");
        });
        const { ctx, sessionId } = await newTestSession(client, { auth: { terminal: true } });
        try {
            await expect(ctx.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "ask" }],
            })).resolves.toEqual({ stopReason: "end_turn" });
            expect(client.permissionRequests).toHaveLength(0);
            expect(client.requests().some((r) => r.method === "userInput/cancel")).toBe(false);
            expect(client.requests().some((r) => r.method === "userInput/answer")).toBe(false);
            expect(client.requests().some((r) => r.method === "turn/cancel")).toBe(true);
        }
        finally {
            await client.agent.dispose();
        }
    });
});
