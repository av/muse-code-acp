import { type SessionNotification } from "@agentclientprotocol/sdk";
import type { MuseSdkTranslator } from "./muse-sdk-events.js";
import { type ProgressFacts } from "./session-progress.js";
import { MuseClient, spawnMspConnection, type Session, type Connection } from "@muse-code/sdk";
import type { MuseSdkOptions } from "./muse-sdk.js";
import { type GoalObservation } from "./goal-state.js";
import { type SessionStateObservation } from "./session-state-observer.js";
import { type HostCompatibility } from "./host-compatibility.js";
type HostOptions = Pick<MuseSdkOptions, "sessionId" | "cwd" | "model" | "readOnly" | "env" | "museBinary" | "logger" | "checkHost" | "safety" | "providerId" | "profileId"> & {
    idleTimeoutMs?: number;
    maxTurns?: number;
    onClose?: () => void | Promise<void>;
    onCatalogConnection?: (connection: Connection) => void;
    onGoal?: (goal: GoalObservation) => void | Promise<void>;
    initialGoal?: GoalObservation;
    onProgress?: (facts: ProgressFacts) => Promise<void>;
    onTaskUpdate?: (notification: SessionNotification) => Promise<void>;
    onSessionState?: (state: SessionStateObservation) => Promise<void>;
};
type InitializedHost = Awaited<ReturnType<ReturnType<typeof spawnMspConnection>["initialize"]>>;
interface HostLease {
    host: InitializedHost;
    client: MuseClient;
    session: Session;
}
/** A single ACP session owns this process and its spawn-time configuration. */
export declare class MuseSdkHost {
    private readonly options;
    readonly generation: `${string}-${string}-${string}-${string}-${string}`;
    private retained;
    private taskDelivery;
    get workflowCancellationSupported(): boolean;
    retainProgress(turnId: string, translator: MuseSdkTranslator): void;
    controlTask(target: string): Promise<{
        status: string;
    }>;
    private observeTasks;
    private handshake?;
    private initialized?;
    private lease?;
    private closing?;
    private stopped;
    private busy;
    private completedTurns;
    private idleTimer?;
    private finalStderr;
    private failActive?;
    private goalTimer?;
    private goalDelivery?;
    private lastGoal?;
    private lastGoalState?;
    private compatibility?;
    private compatibilityAnnounced;
    private readonly stateObserver?;
    /**
     * The host/SDK comparison, once per host. Announced on the first turn of a
     * lease and not repeated for reused hosts, which would be noise.
     */
    takeCompatibilityAnnouncement(): HostCompatibility | undefined;
    get hasActiveTurn(): boolean;
    get catalogConnection(): Connection | undefined;
    constructor(options: HostOptions);
    watchPolicyPersistence(approvalId: string, cursor?: string): void;
    observeSessionState(): Promise<void>;
    get closed(): boolean;
    get reusable(): boolean;
    get stderr(): string;
    acquire(options: MuseSdkOptions, fail: (error: unknown) => void, preparing?: () => void): Promise<HostLease>;
    release(keepAlive: boolean): Promise<void>;
    close(): Promise<void>;
    private ensureOpen;
    private open;
    private applyPolicy;
    private observeGoal;
}
export {};
//# sourceMappingURL=muse-sdk-host.d.ts.map