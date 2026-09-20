import { parseOutputRequest } from "./stored-output.js";
import { parseCompatibleSteering } from "./steering-protocol.js";
import { parseTaskRequest } from "./async-tasks.js";
import { type FailureObservation } from "./turn-failure.js";
import { SessionProgress } from "./session-progress.js";
import { AuthenticateRequest, AuthenticateResponse, CancelNotification, ForkSessionRequest, ForkSessionResponse, ResumeSessionRequest, ResumeSessionResponse, CloseSessionRequest, CloseSessionResponse, ClientApp, ClientCapabilities, CreateElicitationRequest, CreateElicitationResponse, LogoutRequest, LogoutResponse, InitializeRequest, InitializeResponse, ListSessionsRequest, ListSessionsResponse, LoadSessionRequest, LoadSessionResponse, McpServer, NewSessionRequest, NewSessionResponse, PromptRequest, PromptResponse, RequestPermissionRequest, RequestPermissionResponse, SessionNotification, SetSessionConfigOptionRequest, SetSessionConfigOptionResponse, SetSessionModeRequest, SetSessionModeResponse, Stream } from "@agentclientprotocol/sdk";
import { SessionConfig } from "./config-options.js";
import { Logger } from "./logger.js";
import { type ModelDiscoveryResult } from "./model-discovery.js";
import { MuseModeId } from "./modes.js";
import { MuseExecHandle } from "./muse-exec.js";
import { MuseSdkHandle, MuseSdkHost } from "./muse-sdk.js";
import { MuseMcpOverlay } from "./mcp-overlay.js";
import type { GoalObservation } from "./goal-state.js";
import { SteeringQueue } from "./steering-queue.js";
import { parseSteeringRequest } from "./steering-protocol.js";
export type { Logger } from "./logger.js";
/**
 * Client-facing surface the agent calls back into. This is the subset of ACP
 * client methods the agent actually uses, expressed as a narrow interface so
 * tests can supply lightweight mocks. In production it is backed by
 * {@link ClientConnection} over the SDK's typed `AgentContext`.
 */
export interface AcpClient {
    sessionUpdate(params: SessionNotification): Promise<void>;
    requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
    createElicitation(params: CreateElicitationRequest): Promise<CreateElicitationResponse>;
}
export interface SessionState {
    authObservation?: "unknown" | "acceptedForTurn" | "rejected";
    latestFailure?: FailureObservation | null;
    /** Working directory every Muse turn for this session runs in. */
    cwd: string;
    /** The Muse session id; minted by us and identical to the ACP session id. */
    museSessionId: string;
    /** Live CLI or SDK turn, including its owned Muse child process. */
    activeTurn: MuseExecHandle | MuseSdkHandle | null;
    /** Set by `session/cancel`; forces the turn to settle with `cancelled`. */
    cancelRequested: boolean;
    turnFinished: Promise<void> | null;
    safetyChanging?: boolean;
    /** Active ACP session mode; decides the safety flags of the next spawn. */
    modeId: MuseModeId;
    /** Model + reasoning effort applied to every spawn for this session. */
    config: SessionConfig;
    modelDiscovery?: ModelDiscoveryResult;
    modelRefresh?: {
        dispose(): Promise<void>;
    };
    /** ACP-provided MCP servers injected into Muse for each turn. */
    mcpServers: McpServer[];
    mcpFailure?: string;
    goal?: GoalObservation;
    progress?: SessionProgress;
    /** Live per-turn Muse configuration overlay, if this session uses MCP. */
    activeMcpOverlay: MuseMcpOverlay | null;
    sdkHost?: {
        owner: MuseSdkHost;
        identity: string;
        overlay: MuseMcpOverlay;
    };
    steering?: SteeringQueue<MuseSdkHandle, {
        turnId: string;
        status: string;
    }>;
}
/**
 * Engine knobs threaded into every `muse exec` spawn. Production leaves them
 * empty (muse's own defaults + user settings apply); tests inject the echo
 * provider, a fake binary, and an isolated XDG data dir.
 */
export interface MuseAgentOptions {
    /** Opt-in SDK migration; the CLI backend remains the default. */
    backend?: "exec" | "sdk";
    museBinary?: string;
    provider?: "meta" | "echo";
    env?: Record<string, string | undefined>;
    /** Tests with fake-msp skip the real `muse serve --help` probe. */
    skipSdkHostCheck?: boolean;
}
export declare class MuseAcpAgent {
    readonly client: AcpClient;
    readonly logger: Logger;
    readonly options: MuseAgentOptions;
    readonly sessions: Map<string, SessionState>;
    private readonly bindingSessions;
    private readonly backgroundTasks;
    private disposed;
    private readonly discoveryAbort;
    private disposal;
    readonly backend: "exec" | "sdk";
    private readonly modelDiscovery;
    private readonly providers;
    /** Client capabilities from initialize; omitted keys are unsupported. */
    clientCapabilities: ClientCapabilities;
    constructor(client: AcpClient, logger?: Logger, options?: MuseAgentOptions);
    private providerEnv;
    private prepareProvider;
    private authStatus;
    private publishAuth;
    private progressFor;
    private safetyGuard;
    private validateSafety;
    private sessionModes;
    private sessionConfigOptions;
    private supportsFork;
    initialize(params: InitializeRequest): Promise<InitializeResponse>;
    /**
     * For both methods `authenticate` checks credential configuration only: browser
     * login runs client-side (terminal method / `--cli login`), and env keys
     * are provided by the client's environment — the adapter cannot verify an account without public host evidence.
     */
    authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse>;
    logout(_params: LogoutRequest): Promise<LogoutResponse>;
    private validateMcp;
    private publishGoal;
    private inspectGoal;
    private catalogIdentity;
    private publishCatalog;
    newSession(params: NewSessionRequest): Promise<NewSessionResponse>;
    /**
     * Fire-and-forget: muse skills (per workspace) become ACP slash commands.
     * Invocation is prompt passthrough — `/skill-id …` reaches muse verbatim.
     */
    private advertiseCommands;
    private trackRead;
    private readSavedSession;
    listSessions(params: ListSessionsRequest): Promise<ListSessionsResponse>;
    loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse>;
    private withSessionBinding;
    private loadSessionState;
    forkSession(params: ForkSessionRequest): Promise<ForkSessionResponse>;
    resumeSession(params: ResumeSessionRequest): Promise<ResumeSessionResponse>;
    private resumeSessionState;
    setSessionConfigOption(params: SetSessionConfigOptionRequest): Promise<SetSessionConfigOptionResponse>;
    setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse>;
    private assertWorkflowTools;
    private changeMode;
    compatibleSteer(params: ReturnType<typeof parseCompatibleSteering>): Promise<{
        outcome: "injected";
    }>;
    steer(params: ReturnType<typeof parseSteeringRequest>): Promise<{
        turnId: string;
        status: string;
    }>;
    prompt(params: PromptRequest): Promise<PromptResponse>;
    /**
     * Classifies an exit-1 turn using the run's own terminal record. Note: exit
     * codes describe run completion, not code correctness — an exit-0 turn where
     * the agent reports failing tests is still `end_turn`; only run-level
     * failures land here.
     */
    private turnFailure;
    readOutput(params: ReturnType<typeof parseOutputRequest>): Promise<import("./stored-output.js").OutputPage>;
    controlTask({ sessionId, target }: ReturnType<typeof parseTaskRequest>): Promise<{
        status: string;
    }>;
    cancel(params: CancelNotification): Promise<void>;
    closeSession(params: CloseSessionRequest): Promise<CloseSessionResponse>;
    private assertRunning;
    requireSession(sessionId: string): SessionState;
    dispose(): Promise<void>;
}
/**
 * Builds the ACP agent app and connects it to `target` (a transport stream in
 * production, a `ClientApp` for in-process tests). The handlers close over
 * `agent`, which is assigned synchronously right after `connect()` returns —
 * before the connection processes any inbound message.
 */
export declare function createAgentConnection(target: Stream | ClientApp, logger?: Logger, options?: MuseAgentOptions): {
    connection: import("@agentclientprotocol/sdk").AgentConnection;
    agent: MuseAcpAgent;
};
export declare function runAcp(logger?: Logger): {
    connection: import("@agentclientprotocol/sdk").AgentConnection;
    agent: MuseAcpAgent;
};
//# sourceMappingURL=acp-agent.d.ts.map