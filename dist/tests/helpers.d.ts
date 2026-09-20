import { ClientContext, CreateElicitationRequest, CreateElicitationResponse, RequestPermissionRequest, RequestPermissionResponse, SessionNotification } from "@agentclientprotocol/sdk";
import { Logger, MuseAcpAgent, MuseAgentOptions } from "../acp-agent.js";
export declare const fixturesDir: string;
export declare function silentLogger(): Logger;
/** Logger that records log lines (e.g. to assert spawned argv). */
export declare function capturingLogger(lines: string[]): Logger;
/** True when the real muse CLI is installed (live echo-provider tests). */
export declare function museAvailable(): boolean;
/** The blocking fake `muse exec` used by deterministic cancellation tests. */
export declare function fakeMuseBinary(): string;
export type PermissionResponder = (params: RequestPermissionRequest) => RequestPermissionResponse | Promise<RequestPermissionResponse>;
export type ElicitationResponder = (params: CreateElicitationRequest) => CreateElicitationResponse | Promise<CreateElicitationResponse>;
export interface TestClient {
    /** Every session/update notification the agent sent, in order. */
    updates: SessionNotification[];
    /** Permission requests the agent sent to the client, in order. */
    permissionRequests: RequestPermissionRequest[];
    /** Elicitation requests the agent sent to the client, in order. */
    elicitationRequests: CreateElicitationRequest[];
    agent: MuseAcpAgent;
    setPermissionResponder(responder: PermissionResponder): void;
    setElicitationResponder(responder: ElicitationResponder): void;
    /** Context for sending agent-side requests (initialize, session/new, …). */
    connect(): Promise<ClientContext>;
}
/**
 * Connects an in-process ACP client to a fresh agent instance. Drives the
 * real SDK connection layer (schema validation included) without a transport.
 */
export declare function connectTestClient(options?: MuseAgentOptions, logger?: Logger): TestClient;
export declare function initialized(testClient: TestClient, clientCapabilities?: Record<string, unknown>): Promise<ClientContext>;
/** initialize + session/new in a fresh temp cwd — the common test opening. */
export declare function newTestSession(testClient: TestClient, clientCapabilities?: Record<string, unknown>): Promise<{
    ctx: ClientContext;
    sessionId: string;
    cwd: string;
    modes: import("@agentclientprotocol/sdk").SessionModeState | null | undefined;
    configOptions: import("@agentclientprotocol/sdk").SessionConfigOption[] | null | undefined;
}>;
//# sourceMappingURL=helpers.d.ts.map