import { museMcpServers, readConfiguredMcpServers } from "./mcp-overlay.js";
/** Only retain recognized categories from host startup errors, never raw diagnostic text. */
export function mcpStartupFailure(error) {
    const text = String(error);
    if (!text.includes("Required MCP server") || !text.includes("failed during startup"))
        return;
    if (text.includes("authentication failed"))
        return "authentication rejected";
    if (text.includes("violated the MCP protocol"))
        return "invalid MCP response";
    if (text.includes("could not be reached"))
        return "server unreachable or process unavailable";
    return "MCP startup failed";
}
/** Inventory only: the public MSP has no connection-status observation method. */
export function mcpStatus(servers, env, lastFailure) {
    try {
        const configured = { ...readConfiguredMcpServers(env), ...museMcpServers(servers) };
        const rows = Object.entries(configured).map(([name, value]) => {
            const entry = typeof value === "object" && value !== null ? value : {};
            const type = entry.type ?? (entry.command ? "stdio" : undefined);
            const transport = type === "http" || type === "stdio" ? type : "unsupported or unknown";
            return `${JSON.stringify(name)}: ${transport}; configured; connection unknown`;
        });
        return [
            "MCP configuration",
            ...(lastFailure ? [`Last execution observed: ${lastFailure}.`] : []),
            ...rows,
            rows.length
                ? "Current connection state is not exposed by the public Muse SDK. Configuration does not prove connectivity."
                : "No MCP servers configured.",
        ].join("\n");
    }
    catch {
        return "MCP configuration unavailable: settings could not be read or are invalid. Connection state is unknown.";
    }
}
