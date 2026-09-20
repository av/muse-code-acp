export const BUILTIN_COMMANDS = [
    { name: "models", description: "Refresh model choices without a model request" },
    { name: "skills", description: "List available Muse skills without a model request" },
    {
        name: "logout",
        description: "Log out stored Muse credentials and close adapter sessions; exported keys remain configured",
    },
    {
        name: "rename",
        description: "Set a persistent adapter-owned session title",
        input: { hint: "title" },
    },
    {
        name: "status",
        description: "Inspect requested settings and observed usage/context without a model request",
    },
    {
        name: "goal",
        description: "Inspect goal status, or execute a task once (persistent controls unavailable)",
        input: { hint: "[status | task]" },
    },
    {
        name: "mcp",
        description: "Inspect MCP configuration or ask a question about it",
        input: { hint: "[status | question]" },
    },
    {
        name: "plan",
        description: "Enter plan mode; optionally start a planning task",
        input: { hint: "[objective]" },
    },
    {
        name: "review",
        description: "Review working-tree changes with optional focus",
        input: { hint: "[review instructions]" },
    },
    {
        name: "review-branch",
        description: "Review changes from a branch merge base",
        input: { hint: "[ref (default: upstream)] [focus]" },
    },
    {
        name: "review-commit",
        description: "Review a commit",
        input: { hint: "[ref (default: HEAD)] [focus]" },
    },
];
const names = new Set(BUILTIN_COMMANDS.map((command) => command.name));
/** Only explicit command-leading top-level text is executable; attachments are data. */
export function parseSlashCommand(prompt) {
    const matches = prompt.flatMap((block, index) => {
        if (block.type !== "text")
            return [];
        const match = /^\/([\w-]+)(?:\s+([\s\S]*))?$/.exec(block.text.trim());
        if (!match || !names.has(match[1].toLowerCase()))
            return [];
        return [{ index, name: match[1].toLowerCase(), args: match[2]?.trim() ?? "" }];
    });
    if (!matches.length)
        return;
    const different = new Set(matches.map((m) => m.name));
    const selected = matches.find((m) => m.name === "plan") ?? matches[0];
    const blocks = prompt.map((block) => ({ ...block }));
    const result = { blocks, index: selected.index };
    if (different.size > 1 && selected.name !== "plan")
        return {
            ...result,
            stop: true,
            notice: "Several different commands were requested. Send one operation at a time; no task has been started.",
        };
    for (const match of matches)
        blocks[match.index] = {
            type: "text",
            text: match.index !== selected.index &&
                /^(goal|mcp)$/.test(match.name) &&
                /^status$/i.test(match.args)
                ? ""
                : match.args,
        };
    const extraText = blocks.some((block, index) => index !== selected.index && block.type === "text" && block.text.trim());
    const attachments = blocks.some((block) => block.type !== "text");
    const args = selected.args;
    if (selected.name === "models" ||
        selected.name === "skills" ||
        selected.name === "logout" ||
        selected.name === "rename") {
        if (extraText || attachments || (selected.name !== "rename" && args))
            return {
                ...result,
                stop: true,
                notice: "Send this local command alone; accompanying instructions and attachments were not executed.",
            };
        return { ...result, stop: true, local: { kind: selected.name, argument: args } };
    }
    if (selected.name === "status")
        return {
            ...result,
            status: "status",
            stop: true,
            notice: args || extraText || attachments
                ? "This local status query does not execute accompanying instructions or process attachments."
                : undefined,
        };
    if (selected.name === "plan") {
        result.workflow = { kind: "plan", text: args };
        result.barePlan = !args && !extraText && !attachments;
        if (different.size > 1) {
            result.barePlan = false;
            result.notice =
                "This request includes planning and other commands. This turn will only plan; it will not execute the other operations.";
            // Preserve the requested operations as planning inputs, not dispatched commands.
            for (const match of matches)
                if (match.name !== "plan")
                    blocks[match.index] = {
                        type: "text",
                        text: `Requested operation to plan: /${match.name} ${match.args}`,
                    };
        }
        return result;
    }
    if (selected.name === "goal" || selected.name === "mcp") {
        const isGoal = selected.name === "goal";
        if (isGoal && matches.some((match) => /^(pause|resume|clear|edit)(?:\s|$)/i.test(match.args)))
            return {
                ...result,
                stop: true,
                notice: "Persistent goal controls are unavailable on this Muse integration. No goal was changed. Use /goal status to inspect the observed state, or send a task to execute once.",
            };
        const status = /^status$/i.test(args) || (!args && !extraText);
        if (status) {
            blocks[selected.index] = { type: "text", text: "" };
            result.status = selected.name;
            result.stop = !extraText;
            if (attachments && result.stop)
                result.notice = "Attached context was not processed by this local status query.";
        }
        else if (isGoal) {
            result.notice =
                "Persistent goal creation is unavailable. I will execute this task once in the current mode; no persistent goal or background loop will be created.";
        }
        else {
            result.status = "mcp";
            result.notice =
                "I will use the available MCP diagnostics to address this request. This does not invoke a native MCP control command.";
        }
        return result;
    }
    if (selected.name === "review") {
        result.workflow = { kind: "review", target: "workingTree" };
        return result;
    }
    const ref = args.match(/^\S+/)?.[0];
    const focus = args.slice(ref?.length ?? 0).trim();
    if (ref && (ref.startsWith("-") || ref.includes("\0")))
        return {
            ...result,
            stop: true,
            notice: `Use /${selected.name} with a Git reference, followed by optional review instructions. References cannot begin with '-'.`,
        };
    const target = selected.name === "review-branch" ? "branch" : "commit";
    result.workflow = {
        kind: "review",
        target,
        ref: ref ?? (target === "branch" ? "@{upstream}" : "HEAD"),
    };
    blocks[selected.index] = { type: "text", text: focus };
    if (!ref)
        result.notice = `Review target: ${result.workflow.ref}.`;
    return result;
}
