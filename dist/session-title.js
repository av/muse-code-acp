import { RequestError } from "@agentclientprotocol/sdk";
import { readSessionPreferences, writeSessionPreferences } from "./session-preferences.js";
export function renameSession(sessionId, title, env) {
    const text = title.trim();
    if (!text ||
        text.length > 512 ||
        Array.from(text).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
        throw RequestError.invalidParams(undefined, "A session title must be 1–512 characters on one line");
    const userTitle = { text, updatedAt: new Date().toISOString() };
    writeSessionPreferences(sessionId, { userTitle }, env);
    return userTitle;
}
export function applySessionTitle(info, env) {
    const title = readSessionPreferences(info.sessionId, env).userTitle;
    return title ? { ...info, title: title.text } : info;
}
export function applyTitleUpdate(notification, env) {
    if (notification.update.sessionUpdate !== "session_info_update" ||
        notification.update.title === undefined)
        return notification;
    const title = readSessionPreferences(notification.sessionId, env).userTitle;
    return title
        ? { ...notification, update: { ...notification.update, title: title.text } }
        : notification;
}
