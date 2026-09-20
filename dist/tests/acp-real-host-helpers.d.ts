/**
 * Spawn the built ACP entrypoint against a real Muse binary (no fake MSP).
 */
import { ClientContext, SessionNotification } from "@agentclientprotocol/sdk";
export declare function expectLegacyContinuation(prompt: Promise<unknown>): Promise<void>;
export interface RealHostAgent {
    ctx: ClientContext;
    updates: SessionNotification[];
    dispose(): Promise<void>;
}
export declare function spawnAcpAgent(options: {
    env: Record<string, string | undefined>;
    cwd: string;
}): Promise<RealHostAgent>;
//# sourceMappingURL=acp-real-host-helpers.d.ts.map