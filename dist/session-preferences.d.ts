import { type SafetySettings } from "./safety-settings.js";
type Preferences = {
    schemaVersion: 1;
    userTitle?: {
        text: string;
        updatedAt: string;
    };
    reasoningEffort?: string;
    modeId?: "default" | "readOnly" | "plan" | "bypassApprovals" | "rejectApprovals";
    safety?: SafetySettings;
    providerBinding?: string;
    modelSelection?: {
        model: string;
        providerId?: string;
        profileId?: string | null;
    };
};
export declare function readSessionPreferences(sessionId: string, env: Record<string, string | undefined>): Preferences;
export declare function readSessionEffort(sessionId: string, env: Record<string, string | undefined>): string | undefined;
export declare function writeSessionPreferences(sessionId: string, change: Pick<Preferences, "reasoningEffort" | "modeId" | "safety" | "providerBinding" | "modelSelection" | "userTitle">, env: Record<string, string | undefined>): void;
export declare function writeSessionEffort(sessionId: string, reasoningEffort: string, env: Record<string, string | undefined>): void;
export declare function writeSessionMode(sessionId: string, modeId: NonNullable<Preferences["modeId"]>, env: Record<string, string | undefined>): void;
export {};
//# sourceMappingURL=session-preferences.d.ts.map