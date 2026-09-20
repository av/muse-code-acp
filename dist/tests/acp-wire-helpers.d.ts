/**
 * Spawned ACP stdio contract harness — drives `dist/index.js` over real NDJSON.
 */
import { ClientContext, SessionNotification } from "@agentclientprotocol/sdk";
export declare const agentEntrypoint: string;
export interface WireTranscript {
    acpInbound: string[];
    mspRequests: unknown[];
    stderr: string;
}
export interface WireFixture {
    ctx: ClientContext;
    updates: SessionNotification[];
    workspace: string;
    getTranscript(): WireTranscript;
    dispose(): Promise<void>;
}
export interface WireOptions {
    backend?: "exec" | "sdk";
    fakeMspMode?: string;
    env?: Record<string, string | undefined>;
    /** Split each client→agent write in half to exercise NDJSON buffering. */
    fragmentWrites?: boolean;
    clientCapabilities?: Record<string, unknown>;
}
/**
 * Launch the built ACP entrypoint with a fake MSP child and connect a real
 * ACP client over stdin/stdout NDJSON.
 */
export declare function createWireFixture(options?: WireOptions): Promise<WireFixture>;
//# sourceMappingURL=acp-wire-helpers.d.ts.map