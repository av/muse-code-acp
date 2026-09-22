import { TurnScopedLifecycle } from "./turn-lifecycle.js";
/** Tracks pending user-input IDs so late answers cannot settle a later turn. */
export class UserInputLifecycle extends TurnScopedLifecycle {
}
/**
 * Build an ACP form elicitation from an MSP user-input request.
 * Multi-question prompts become a single object schema keyed by question id.
 */
export function userInputToElicitation(sessionId, request) {
    const properties = {};
    const required = [];
    for (const question of request.questions) {
        required.push(question.id);
        if (question.selection.mode === "multiple") {
            properties[question.id] = {
                type: "array",
                title: question.header || question.question,
                description: question.question,
                items: { type: "string", enum: question.options.map((option) => option.label) },
                minItems: question.selection.minSelections ?? 1,
                maxItems: question.selection.maxSelections ?? question.options.length,
            };
        }
        else if (question.options.length > 0) {
            properties[question.id] = {
                type: "string",
                title: question.header || question.question,
                description: question.question,
                enum: question.options.map((option) => option.label),
            };
        }
        else {
            properties[question.id] = {
                type: "string",
                title: question.header || question.question,
                description: question.question,
                maxLength: 500,
            };
        }
    }
    const message = request.questions.map((q) => q.question).join("\n") ||
        `Muse requested input for ${request.toolName}`;
    const requestedSchema = {
        type: "object",
        properties,
        required,
    };
    return {
        mode: "form",
        message,
        sessionId,
        requestedSchema,
        _meta: {
            museUserInputId: request.userInputId,
            museTurnId: request.turnId,
            museToolCallId: request.toolCallId,
            museToolName: request.toolName,
        },
    };
}
export function elicitationToAnswers(request, response) {
    if (response.action === "cancel" || response.action === "decline") {
        return "cancel";
    }
    if (response.action !== "accept") {
        return "cancel";
    }
    const content = (response.content ?? {});
    const answers = [];
    for (const question of request.questions) {
        const value = content[question.id];
        if (question.selection.mode === "multiple") {
            if (!Array.isArray(value) ||
                value.length < (question.selection.minSelections ?? 1) ||
                value.length > (question.selection.maxSelections ?? question.options.length) ||
                new Set(value).size !== value.length ||
                value.some((label) => typeof label !== "string" || !question.options.some((o) => o.label === label))) {
                throw new Error(`elicitation invalid selections for ${question.id}`);
            }
            answers.push({ questionId: question.id, selectedLabels: value });
            continue;
        }
        if (typeof value !== "string" || value.length === 0) {
            throw new Error(`elicitation missing required answer for ${question.id}`);
        }
        if (question.options.length > 0) {
            if (!question.options.some((option) => option.label === value)) {
                throw new Error(`elicitation selected unknown option for ${question.id}`);
            }
            answers.push({ questionId: question.id, selectedLabel: value });
        }
        else {
            if (value.length > 500) {
                throw new Error(`elicitation answer exceeds 500 characters for ${question.id}`);
            }
            answers.push({ questionId: question.id, freeText: value });
        }
    }
    return answers;
}
/**
 * True when an elicitation RPC failed because the client has no elicitation
 * endpoint at all (e.g. Kandev answers `elicitation.create` with JSON-RPC
 * -32601 "Method not found"). The error may arrive wrapped (e.g. code -32603
 * with "Method not found" in `data.details`), so the phrase is matched
 * anywhere in the message or data payload. Validation failures and declined
 * answers never contain that phrase — they must keep failing the prompt.
 *
 * Do not reroute the question through `session/request_permission`. Clients
 * that auto-approve permissions (Kandev's Muse profile does) answer that RPC
 * with an allow option and no person, and the model treats it as the user's
 * choice. `userInput/cancel` is also wrong here: it unblocks the model, which
 * then picks for the user. The SDK stops the turn and posts the question.
 */
export function isElicitationUnsupported(error) {
    if (!error || typeof error !== "object")
        return false;
    const record = error;
    if (record.code === -32601)
        return true;
    return containsMethodNotFound(record.message) || containsMethodNotFound(record.data);
}
function containsMethodNotFound(value, depth = 0) {
    if (value == null || depth > 3)
        return false;
    if (typeof value === "string")
        return /method not found/i.test(value);
    if (typeof value === "object") {
        return Object.values(value).some((entry) => containsMethodNotFound(entry, depth + 1));
    }
    return false;
}
/**
 * Render an MSP user-input request as a chat message, for clients without an
 * elicitation endpoint. The user reads the question here and replies in chat;
 * the answer arrives on the next turn.
 */
export function userInputToChatMessage(request) {
    const lines = [];
    for (const question of request.questions) {
        const title = question.header || question.question;
        lines.push(`**${title}**`);
        if (title !== question.question)
            lines.push(question.question);
        if (question.options.length > 0) {
            question.options.forEach((option, index) => {
                lines.push(`${index + 1}. ${option.label}`);
            });
        }
        else {
            lines.push("_Reply in chat with your answer._");
        }
        lines.push("");
    }
    lines.push("_I stopped here so I do not pick for you. Reply in chat with your choice and I will continue on the next turn._");
    return lines.join("\n");
}
/** Answer a pending MSP user-input request over the public Connection API. */
export async function answerUserInput(connection, sessionId, request, answers) {
    await connection.command("userInput/answer", { sessionId, userInputId: request.userInputId, answers }, { maxAttempts: 1 });
}
/** Cancel a pending MSP user-input request over the public Connection API. */
export async function cancelUserInput(connection, sessionId, request, reason) {
    await connection.command("userInput/cancel", { sessionId, userInputId: request.userInputId, reason }, { maxAttempts: 1 });
}
/** Answer or cancel a pending MSP user-input request over the public Connection API. */
export async function settleUserInput(connection, sessionId, request, response) {
    const answers = elicitationToAnswers(request, response);
    if (answers === "cancel") {
        await cancelUserInput(connection, sessionId, request, "client declined");
        return;
    }
    await answerUserInput(connection, sessionId, request, answers);
}
