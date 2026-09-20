import { type ClientCapabilities } from "@agentclientprotocol/sdk";
export declare const COMPAT_STEER_METHOD = "_session/steering";
export declare function supportsCompatibleSteering(capabilities: ClientCapabilities): boolean;
export declare const STEER_METHOD = "_muse/steer";
export declare const STEERING_CAPABILITY = "muse/steering";
export declare function supportsSteering(capabilities: ClientCapabilities): boolean;
export declare function parseSteeringRequest(raw: unknown): {
    sessionId: string;
    expectedTurnId: string;
    input: import("./prompt-content.js").MuseInputPart[];
};
export declare function parseCompatibleSteering(raw: unknown): {
    sessionId: string;
    expectedTurnId: string | undefined;
    input: import("./prompt-content.js").MuseInputPart[];
};
//# sourceMappingURL=steering-protocol.d.ts.map