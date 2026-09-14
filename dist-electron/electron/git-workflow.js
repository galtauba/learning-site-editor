export const OFFICIAL_UPSTREAM = "https://github.com/galtauba/LearningSite.git";
const tagVersion = (tag) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
    return match
        ? [Number(match[1]), Number(match[2]), Number(match[3])]
        : undefined;
};
const compare = (a, b) => {
    const av = tagVersion(a), bv = tagVersion(b);
    if (!av || !bv)
        return 0;
    return av[0] - bv[0] || av[1] - bv[1] || av[2] - bv[2];
};
export const stableTags = (raw) => [
    ...new Set(raw
        .split(/\r?\n/)
        .map((line) => line
        .split("\t")
        .at(-1)
        ?.replace(/^refs\/tags\//, "")
        .replace(/\^\{\}$/, "") ?? "")
        .filter((tag) => Boolean(tagVersion(tag)))),
].sort((a, b) => compare(b, a));
const optional = async (run, args) => run(args, false).catch(() => undefined);
export async function checkpoint(run, label) {
    const dirty = await optional(run, ["status", "--porcelain"]);
    if (!dirty?.trim())
        return undefined;
    const branch = await run(["symbolic-ref", "--quiet", "--short", "HEAD"]);
    const head = await run(["rev-parse", "--short", "HEAD"]);
    const name = `learning-site/checkpoint/${label}-${head}`;
    await run(["branch", name, branch.trim()]);
    return name;
}
export async function officialVersions(run) {
    const upstream = await optional(run, ["remote", "get-url", "upstream"]);
    if (!upstream)
        return {};
    await run(["fetch", "upstream", "--tags", "--prune"]);
    const tags = stableTags((await run(["tag", "--list", "v*"])) ?? "");
    const latest = tags[0];
    let installed;
    for (const tag of tags) {
        if (await optional(run, ["merge-base", "--is-ancestor", tag, "HEAD"])) {
            installed = tag;
            break;
        }
    }
    return { installed, latest };
}
export async function inspectProject(run, checkOfficialUpdates = true) {
    try {
        const origin = (await optional(run, ["remote", "get-url", "origin"]))?.trim(), upstream = (await optional(run, ["remote", "get-url", "upstream"]))?.trim(), branch = (await optional(run, ["symbolic-ref", "--quiet", "--short", "HEAD"]))?.trim();
        if (!branch)
            return {
                branch: "",
                origin,
                upstream,
                dirty: true,
                ahead: 0,
                behind: 0,
                state: "UNINITIALIZED",
            };
        const dirty = Boolean((await optional(run, ["status", "--porcelain"]))?.trim());
        let ahead = 0, behind = 0;
        if (origin) {
            await run(["fetch", "origin", "--prune"]);
            const counts = (await optional(run, [
                "rev-list",
                "--left-right",
                "--count",
                `${branch}...origin/${branch}`,
            ]))
                ?.trim()
                .split(/\s+/)
                .map(Number) ?? [];
            ahead = counts[0] ?? 0;
            behind = counts[1] ?? 0;
        }
        const versions = checkOfficialUpdates ? await officialVersions(run) : {};
        const state = dirty
            ? "DIRTY"
            : ahead && behind
                ? "DIVERGED"
                : ahead
                    ? "LOCAL_AHEAD"
                    : behind
                        ? "REMOTE_AHEAD"
                        : versions.latest &&
                            (!versions.installed ||
                                compare(versions.latest, versions.installed) > 0)
                            ? "UPSTREAM_UPDATE_AVAILABLE"
                            : "READY";
        return {
            branch,
            origin,
            upstream,
            dirty,
            ahead,
            behind,
            installedVersion: versions.installed,
            latestVersion: versions.latest,
            state,
        };
    }
    catch {
        return { branch: "", dirty: false, ahead: 0, behind: 0, state: "OFFLINE" };
    }
}
export async function syncOrigin(run, push = true) {
    const origin = (await optional(run, ["remote", "get-url", "origin"]))?.trim();
    if (!origin)
        throw new Error("This project has no origin remote.");
    const branch = (await optional(run, ["symbolic-ref", "--quiet", "--short", "HEAD"]))?.trim();
    if (!branch)
        throw new Error("This repository has no first commit yet. Set the Git name and email, then create the initial commit before synchronizing.");
    const dirty = Boolean((await optional(run, ["status", "--porcelain"]))?.trim());
    if (dirty)
        await checkpoint(run, "pre-recovery");
    await run(["fetch", "origin", "--prune"]);
    const counts = (await optional(run, [
        "rev-list",
        "--left-right",
        "--count",
        `${branch}...origin/${branch}`,
    ]))
        ?.trim()
        .split(/\s+/)
        .map(Number) ?? [], ahead = counts[0] ?? 0, behind = counts[1] ?? 0;
    if (behind) {
        await checkpoint(run, "pre-origin-merge");
        await run(["merge", "--no-edit", `origin/${branch}`]);
    }
    if (push && (ahead || behind))
        await run(["push", "-u", "origin", branch]);
    return ahead && behind
        ? "Merged diverged origin."
        : behind
            ? "Merged origin changes."
            : ahead
                ? "Pushed local commits."
                : "Already synchronized.";
}
export async function applyOfficialUpdate(run, tag) {
    const status = await inspectProject(run);
    if (!status.upstream)
        throw new Error("Official upstream is not configured.");
    if (!tagVersion(tag))
        throw new Error("Only stable version tags can be applied.");
    await checkpoint(run, "pre-upstream-update");
    await run(["fetch", "upstream", "--tags", "--prune"]);
    await run(["merge", "--no-edit", tag]);
    if (status.origin)
        await run(["push", "-u", "origin", status.branch]);
}
