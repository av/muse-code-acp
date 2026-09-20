import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { museDataDir } from "./session-store.js";
import { isReasoningEffort } from "./config-options.js";
import { validSafety } from "./safety-settings.js";
// ACP-only effort and safety-mode choices live outside native Muse logs.
function preferencePath(sessionId, env) {
    return join(dirname(museDataDir(env)), "muse-code-acp", "sessions", `${encodeURIComponent(sessionId)}.json`);
}
export function readSessionPreferences(sessionId, env) {
    let doc;
    try {
        doc = JSON.parse(readFileSync(preferencePath(sessionId, env), "utf8"));
    }
    catch (error) {
        if (error.code === "ENOENT")
            return { schemaVersion: 1 };
        throw error;
    }
    if (!doc ||
        doc.schemaVersion !== 1 ||
        (doc.userTitle !== undefined &&
            (!doc.userTitle ||
                typeof doc.userTitle.text !== "string" ||
                !doc.userTitle.text.trim() ||
                doc.userTitle.text.length > 512 ||
                typeof doc.userTitle.updatedAt !== "string" ||
                !Number.isFinite(Date.parse(doc.userTitle.updatedAt)))) ||
        (doc.modelSelection !== undefined &&
            (!doc.modelSelection ||
                typeof doc.modelSelection !== "object" ||
                typeof doc.modelSelection.model !== "string" ||
                !doc.modelSelection.model.trim() ||
                (doc.modelSelection.providerId !== undefined &&
                    typeof doc.modelSelection.providerId !== "string") ||
                (doc.modelSelection.profileId != null &&
                    typeof doc.modelSelection.profileId !== "string"))) ||
        (doc.providerBinding !== undefined &&
            (typeof doc.providerBinding !== "string" || !/^[a-f0-9]{64}$/.test(doc.providerBinding))) ||
        (doc.safety !== undefined && !validSafety(doc.safety)) ||
        (doc.reasoningEffort !== undefined && !isReasoningEffort(doc.reasoningEffort)) ||
        (doc.modeId !== undefined &&
            !["default", "readOnly", "plan", "bypassApprovals", "rejectApprovals"].includes(doc.modeId)))
        throw new Error("Invalid stored ACP session preference");
    return doc;
}
export function readSessionEffort(sessionId, env) {
    return readSessionPreferences(sessionId, env).reasoningEffort;
}
export function writeSessionPreferences(sessionId, change, env) {
    const doc = { ...readSessionPreferences(sessionId, env), ...change };
    const path = preferencePath(sessionId, env);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
        writeFileSync(temp, JSON.stringify(doc), { mode: 0o600 });
        renameSync(temp, path);
    }
    finally {
        rmSync(temp, { force: true });
    }
}
export function writeSessionEffort(sessionId, reasoningEffort, env) {
    writeSessionPreferences(sessionId, { reasoningEffort }, env);
}
export function writeSessionMode(sessionId, modeId, env) {
    writeSessionPreferences(sessionId, { modeId }, env);
}
