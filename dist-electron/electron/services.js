import { createServer } from "node:http";
import { access, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { app, dialog, shell } from "electron";
import { buildProject, createProject, detectProject, loadPages, migrateProject as engineMigrateProject, paths, readProject, savePage as engineSavePage, validateProject } from "@learning-site/engine";
import { applyOfficialUpdate, inspectProject, OFFICIAL_UPSTREAM, syncOrigin } from "./git-workflow.js";
const DATA = () => join(app.getPath("userData"), "projects.json");
const draftPath = (root) => join(app.getPath("userData"), "drafts", `${createHash("sha256").update(resolve(root)).digest("hex")}.json`);
const exists = async (path) => access(path).then(() => true).catch(() => false);
const safe = (root, target) => { const base = resolve(root), candidate = resolve(target); if (candidate !== base && !candidate.startsWith(base + "\\") && !candidate.startsWith(base + "/"))
    throw new Error("Unsafe path"); return candidate; };
export async function git(root, args) { safe(root, root); return new Promise((resolveResult, reject) => { const child = spawn("git", args, { cwd: root, windowsHide: true }); let out = "", err = ""; child.stdout.on("data", d => out += d); child.stderr.on("data", d => err += d); child.on("error", () => reject(new Error("Git is not available. Install Git for Windows and try again."))); child.on("close", code => code === 0 ? resolveResult(out.trim()) : reject(new Error((err || out || "Git command failed").replace(/https?:\/\/[^\s@]+@/g, "https://***@")))); }); }
export async function classify(path) { const type = await detectProject(path); return type === "unknown" ? "unsupported" : type; }
export async function registry() { try {
    return JSON.parse(await readFile(DATA(), "utf8"));
}
catch {
    return [];
} }
async function save(items) { await mkdir(app.getPath("userData"), { recursive: true }); await writeFile(DATA(), JSON.stringify(items, null, 2)); }
export async function remember(path) { const absolute = resolve(path); if (!await exists(absolute))
    throw new Error("The selected project folder no longer exists."); const items = await registry(), known = items.find(p => p.path.toLowerCase() === absolute.toLowerCase()); const kind = await classify(absolute), origin = await git(absolute, ["remote", "get-url", "origin"]).catch(() => undefined), upstream = await git(absolute, ["remote", "get-url", "upstream"]).catch(() => undefined), branch = await git(absolute, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(() => undefined); const item = { ...known, id: known?.id ?? randomUUID(), path: absolute, name: known?.name ?? basename(absolute), kind, lastOpened: new Date().toISOString(), origin, upstream, branch: branch?.trim() || known?.branch, autoUpdates: known?.autoUpdates ?? true, autoPush: known?.autoPush ?? true, trusted: known?.trusted ?? false, state: known?.state ?? "UNKNOWN" }; await save([item, ...items.filter(p => p.id !== item.id)]); return item; }
export async function create(path, title, locale) { await createProject(path, { title, locale }); await git(path, ["init"]).catch(() => undefined); return remember(path); }
async function initializeEmptyRepositoryFromOfficial(root) {
    if (await git(root, ["rev-parse", "--verify", "HEAD"]).then(() => true).catch(() => false))
        throw new Error("Initial setup is available only for an empty repository.");
    const existing = await git(root, ["remote", "get-url", "upstream"]).catch(() => undefined);
    if (existing && existing.trim().replace(/\/$/, "").replace(/\.git$/, "") !== OFFICIAL_UPSTREAM.replace(/\.git$/, ""))
        throw new Error("The existing upstream remote is not the official Learning Site repository.");
    if (!existing)
        await git(root, ["remote", "add", "upstream", OFFICIAL_UPSTREAM]);
    await git(root, ["fetch", "upstream", "--tags", "--prune"]);
    const head = await git(root, ["symbolic-ref", "--quiet", "refs/remotes/upstream/HEAD"]).catch(() => "refs/remotes/upstream/main");
    const branch = head.trim().replace(/^refs\/remotes\/upstream\//, "") || "main";
    await git(root, ["show-ref", "--verify", `refs/remotes/upstream/${branch}`]);
    await git(root, ["checkout", "-B", branch, `upstream/${branch}`]);
    await git(root, ["push", "-u", "origin", branch]);
    return branch;
}
export async function clone(url, destination) { if (!/^((https:\/\/|git@)[\w.-]+[/:])[\w./-]+(?:\.git)?$/.test(url))
    throw new Error("Enter a valid Git HTTPS or SSH URL."); if (await exists(destination))
    throw new Error("The destination folder already exists."); await git(resolve(destination, ".."), ["clone", url, destination]); const hasHead = await git(destination, ["rev-parse", "--verify", "HEAD"]).then(() => true).catch(() => false); if (!hasHead)
    await initializeEmptyRepositoryFromOfficial(destination); return remember(destination); }
export async function remove(id) { await save((await registry()).filter(p => p.id !== id)); }
export async function updateRegistryProject(id, changes) { const items = await registry(), index = items.findIndex(item => item.id === id); if (index < 0)
    throw new Error("Project is not registered."); const item = { ...items[index] }; for (const key of ["autoUpdates", "autoPush", "trusted"])
    if (typeof changes[key] === "boolean")
        item[key] = changes[key]; items[index] = item; await save(items); return items[index]; }
export async function deleteLocal(id, confirmation) { const item = (await registry()).find(p => p.id === id); if (!item)
    throw new Error("Project is not registered."); if (confirmation !== item.name)
    throw new Error("Type the exact project name to delete its local clone."); const root = resolve(item.path); if (root === resolve(root, "..") || root.length < 4 || !await exists(join(root, ".git")))
    throw new Error("Refusing to delete an unsafe or non-Git project path."); await rm(root, { recursive: true, force: false, maxRetries: 2 }); await remove(id); }
export async function pages(root) { return loadPages(root); }
export async function draft(root) { try {
    return JSON.parse(await readFile(draftPath(root), "utf8"));
}
catch {
    return undefined;
} }
export async function saveDraft(root, page) { const file = draftPath(root); await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify({ ...page, savedAt: new Date().toISOString() }, null, 2)); }
export async function discardDraft(root) { await rm(draftPath(root), { force: true }); }
export async function savePage(root, page) { const previous = (await loadPages(root)).find(item => item.frontmatter.id === page.frontmatter.id); await engineSavePage(root, page); if (previous && previous.sourcePath !== page.sourcePath)
    await rm(safe(join(root, "content"), join(root, "content", previous.sourcePath))); }
export async function deletePage(root, sourcePath) { const file = safe(join(root, "content"), join(root, "content", sourcePath)); await rm(file); }
export async function migrateSafely(root) {
    const kind = await classify(root);
    if (kind !== "legacy")
        throw new Error("Only a detected legacy Learning Site project can be migrated.");
    const status = await git(root, ["status", "--porcelain"]);
    if (status) {
        await git(root, ["add", "-A"]);
        await git(root, ["commit", "-m", "Recovery commit before Learning Site migration"]);
    }
    const branch = `learning-site-migration-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 17)}`;
    await git(root, ["checkout", "-b", branch]);
    const summary = await engineMigrateProject(root);
    const validation = await validateProject(root);
    if (!validation.valid)
        throw new Error(`Migration validation failed: ${validation.issues.map(issue => issue.message).join("; ")}`);
    const generated = await buildProject(root, "production");
    if (!await exists(join(generated.outputDir, "index.html")))
        throw new Error("Migration did not generate a deployable public/index.html.");
    await git(root, ["add", "-A"]);
    await git(root, ["commit", "-m", "Migrate project to Learning Site Engine"]);
    return { ...summary, branch, output: generated.outputDir };
}
export const migrateProject = migrateSafely;
export async function settings(root) { return readProject(root); }
function validNavigation(nodes) { if (!Array.isArray(nodes))
    return false; const identifiers = new Set(); const visit = (items) => items.every(item => { if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || identifiers.has(item.id))
    return false; identifiers.add(item.id); const children = item.children; return children === undefined || (Array.isArray(children) && visit(children)); }); return visit(nodes); }
export async function saveSettings(root, settings) { const p = paths(root); const site = settings.site; if (!site || typeof site !== "object")
    throw new Error("Invalid site settings."); const navigation = settings.navigation; if (navigation !== undefined && (!navigation || typeof navigation !== "object" || !validNavigation(navigation.items)))
    throw new Error("Navigation must contain uniquely identified folders and pages."); await writeFile(p.site, JSON.stringify(site, null, 2)); if (navigation)
    await writeFile(p.navigation, JSON.stringify(navigation, null, 2)); }
const themesRoot = () => app.isPackaged ? join(process.resourcesPath, "themes") : resolve(app.getAppPath(), "..", "learning-site-themes");
export async function themes() { const root = themesRoot(), registry = JSON.parse(await readFile(join(root, "registry.json"), "utf8")); return registry.themes.map(theme => ({ id: theme.id, name: theme.name, version: theme.version, engine: theme.engine, manifest: theme.manifest, preview: theme.preview })); }
export async function selectTheme(root, id) { const available = await themes(); const entry = available.find(theme => theme.id === id); if (!entry)
    throw new Error("Theme is not installed or is incompatible."); const registry = JSON.parse(await readFile(join(themesRoot(), "registry.json"), "utf8")); const full = registry.themes.find(theme => theme.id === id); const theme = JSON.parse(await readFile(join(themesRoot(), full.theme), "utf8")); const current = await readProject(root); await writeFile(paths(root).theme, JSON.stringify(theme, null, 2)); await writeFile(paths(root).site, JSON.stringify({ ...current.site, theme: id }, null, 2)); }
export async function media(root) { const index = paths(root).mediaIndex; try {
    return JSON.parse(await readFile(index, "utf8"));
}
catch {
    return [];
} }
export async function importImage(root) { const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }] }); if (result.canceled)
    return null; const source = result.filePaths[0]; const name = `${Date.now()}-${basename(source).replace(/[^\w.-]/g, "-")}`, target = safe(paths(root).media, join(paths(root).media, name)); await cp(source, target); const items = await media(root); const value = { id: randomUUID(), path: name, mimeType: { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" }[extname(name).toLowerCase()] ?? "application/octet-stream" }; await writeFile(paths(root).mediaIndex, JSON.stringify([...items, value], null, 2)); return value; }
export async function mediaReferences(root, path) { const normalized = cleanRelative(path), encoded = encodeURIComponent(normalized).replace(/%2F/gi, "/"); const references = []; for (const page of await loadPages(root)) {
    if (page.body.includes(`/media/${normalized}`) || page.body.includes(`/media/${encoded}`) || page.body.includes(`/assets/images/${normalized}`) || page.body.includes(`/assets/images/${encoded}`))
        references.push(page.sourcePath);
} return references; }
export async function deleteImage(root, path, force = false) { const normalized = cleanRelative(path), references = await mediaReferences(root, normalized); if (references.length && !force)
    throw new Error(`This image is used by: ${references.join(", ")}. Remove those references first.`); await rm(safe(paths(root).media, join(paths(root).media, normalized))); const items = await media(root); await writeFile(paths(root).mediaIndex, JSON.stringify(items.filter(i => i.path !== normalized), null, 2)); }
export async function chooseFavicon(root) { const image = await importImage(root); if (!image)
    return; await cp(join(paths(root).media, image.path), join(root, "favicon" + extname(image.path))); }
let previewServer;
export async function preview(root) { await buildProject(root, "preview"); previewServer?.close(); previewServer = createServer(async (req, res) => { const requested = decodeURIComponent((req.url ?? "/").split("?")[0]); const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, ""); const file = safe(paths(root).public, join(paths(root).public, relative)); try {
    const info = await stat(file);
    const content = await readFile(info.isDirectory() ? join(file, "index.html") : file);
    res.end(content);
}
catch {
    res.statusCode = 404;
    res.end("Not found");
} }); await new Promise(done => previewServer.listen(0, "127.0.0.1", () => done())); const address = previewServer.address(); const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`; await shell.openExternal(url); return url; }
export async function importLegacyRegistry() { const candidates = [join(process.env.LOCALAPPDATA ?? "", "LearningSiteLauncher", "projects.json"), join(process.env.APPDATA ?? "", "LearningSiteLauncher", "projects.json")]; let added = []; for (const file of candidates) {
    try {
        const raw = JSON.parse(await readFile(file, "utf8"));
        const entries = Array.isArray(raw) ? raw : raw.projects;
        if (Array.isArray(entries))
            for (const entry of entries) {
                const path = typeof entry.path === "string" ? entry.path : entry.local_path;
                if (typeof path === "string" && await exists(path))
                    added.push(await remember(path));
            }
    }
    catch { /* absent legacy registry is normal */ }
} return added; }
const workflowRunner = (root) => (args, check = true) => check ? git(root, args) : git(root, args).catch(() => undefined);
export async function projectStatus(root, checkOfficialUpdates = true) { return inspectProject(workflowRunner(root), checkOfficialUpdates); }
export async function syncProject(root, push = true) { return syncOrigin(workflowRunner(root), push); }
export async function updateProject(root, tag) { await applyOfficialUpdate(workflowRunner(root), tag); return projectStatus(root); }
const contentRoot = (root) => paths(root).content;
const cleanRelative = (value) => { const normalized = value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, ""); if (!normalized || normalized.split("/").some(part => !part || part === "." || part === ".." || /[<>:"|?*]/.test(part)))
    throw new Error("Enter a safe folder or file name."); return normalized; };
export async function folders(root) { const base = contentRoot(root), found = []; const visit = async (current) => { for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.isDirectory()) {
        const path = join(current, entry.name);
        found.push(relative(base, path).replaceAll("\\", "/"));
        await visit(path);
    }
} }; await visit(base); return found.sort((a, b) => a.localeCompare(b)); }
export async function createFolder(root, name, parent = "") { const folder = parent ? `${cleanRelative(parent)}/${cleanRelative(name)}` : cleanRelative(name); await mkdir(safe(contentRoot(root), join(contentRoot(root), folder)), { recursive: false }); return folder; }
export async function renameFolder(root, from, to) { const source = safe(contentRoot(root), join(contentRoot(root), cleanRelative(from))), target = safe(contentRoot(root), join(dirname(source), cleanRelative(to))); if (await exists(target))
    throw new Error("A folder with this name already exists."); await rename(source, target); return relative(contentRoot(root), target).replaceAll("\\", "/"); }
export async function movePage(root, sourcePath, targetFolder = "") { const source = safe(contentRoot(root), join(contentRoot(root), cleanRelative(sourcePath))), folder = targetFolder ? safe(contentRoot(root), join(contentRoot(root), cleanRelative(targetFolder))) : contentRoot(root), target = safe(contentRoot(root), join(folder, basename(source))); if (await exists(target))
    throw new Error("A page with this file name already exists in that folder."); await mkdir(folder, { recursive: true }); await rename(source, target); return relative(contentRoot(root), target).replaceAll("\\", "/"); }
export async function setPublication(root, ids, published) { const current = await loadPages(root); for (const page of current.filter(item => ids.includes(item.frontmatter.id))) {
    page.frontmatter.published = published;
    page.frontmatter.updatedAt = new Date().toISOString();
    await engineSavePage(root, page);
} return pages(root); }
export async function trashPage(root, sourcePath) { const source = safe(contentRoot(root), join(contentRoot(root), cleanRelative(sourcePath))), trash = join(root, ".learning-site", "trash", "pages"), target = join(trash, `${Date.now()}-${basename(source)}`); await mkdir(trash, { recursive: true }); await rename(source, target); return relative(trash, target).replaceAll("\\", "/"); }
export { buildProject, validateProject };
