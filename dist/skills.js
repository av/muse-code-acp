import { runMuseCapture } from "./muse-run.js";
export async function listMuseSkills(cwd, env = process.env, museBinary, logger = console) {
    const stdout = await runMuseCapture(["skills", "list", "--json", "--workspace", cwd], env, museBinary);
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch (err) {
        logger.log(`skills list produced unparseable JSON: ${err}`);
        return [];
    }
    const skills = parsed?.skills;
    if (!Array.isArray(skills)) {
        return [];
    }
    return skills.flatMap((raw) => {
        const skill = raw;
        if (typeof skill.id !== "string") {
            return [];
        }
        return [
            {
                id: skill.id,
                description: typeof skill.description === "string" ? skill.description : "",
                scope: typeof skill.scope === "string" ? skill.scope : "unknown",
                activation: typeof skill.activation === "string" ? skill.activation : "off",
            },
        ];
    });
}
const DESCRIPTION_MAX = 200;
export function skillsToCommands(skills) {
    return skills
        .filter((skill) => skill.activation === "on")
        .map((skill) => ({
        name: skill.id,
        description: truncate(skill.description || `${skill.scope} muse skill`, DESCRIPTION_MAX),
        input: { hint: "input for the skill" },
    }));
}
function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
