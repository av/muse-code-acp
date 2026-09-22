import type { McpServer } from "@agentclientprotocol/sdk";
import type { MuseUserInputAnswer, MuseUserInputRequest } from "./muse-user-input.js";
/** Kandev's own question card. ACP elicitation is not what renders it. */
export declare const KANDEV_QUESTION_TOOL = "ask_user_question_kandev";
export interface KandevQuestionEndpoint {
    url: string;
    headers: Record<string, string>;
}
/**
 * The HTTP MCP server Kandev injects into the ACP session under the name
 * `kandev`. That server's ask_user_question tool is the question card Claude,
 * Codex, and Grok use.
 */
export declare function kandevQuestionEndpoint(servers: readonly McpServer[]): KandevQuestionEndpoint | undefined;
interface KandevQuestion {
    id: string;
    prompt: string;
    title?: string;
    options: Array<{
        label: string;
        description: string;
        option_id: string;
    }>;
}
/** Map a Muse question onto Kandev's card. Free text and more than six choices cannot. */
export declare function toKandevQuestions(request: MuseUserInputRequest): KandevQuestion[] | undefined;
export declare function kandevResultToAnswers(request: MuseUserInputRequest, result: unknown): MuseUserInputAnswer[] | "cancel" | "reject";
/**
 * Ask through Kandev's MCP question tool and wait until the person answers.
 * One MCP session per question; the call stays open for as long as the card does.
 */
export declare function askKandevQuestion(endpoint: KandevQuestionEndpoint, request: MuseUserInputRequest, fetchImpl?: typeof fetch): Promise<MuseUserInputAnswer[] | "cancel" | "reject">;
export {};
//# sourceMappingURL=kandev-question.d.ts.map