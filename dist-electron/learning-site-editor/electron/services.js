import { createServer } from "node:http";
import { access, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { app, dialog, shell } from "electron";
import { buildProject, createProject, detectProject, migrateProject as engineMigrateProject, validateProject } from "@learning-site/engine";
import { paths, readProject } from "../../learning-site-engine/src/project.js";
import { loadPages, savePage } from "../../learning-site-engine/src/content.js";
const DATA = () => join(app.getPath("userData"), "projects.json");
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
    throw new Error("The selected project folder no longer exists."); const items = await registry(), known = items.find(p => p.path.toLowerCase() === absolute.toLowerCase()); const kind = await classify(absolute), origin = await git(absolute, ["remote", "get-url", "origin"]).catch(() => undefined); const item = { id: known?.id ?? randomUUID(), path: absolute, name: basename(absolute), kind, lastOpened: new Date().toISOString(), origin }; await save([item, ...items.filter(p => p.id !== item.id)]); return item; }
export async function create(path, title, locale) { await createProject(path, { title, locale }); await git(path, ["init"]).catch(() => undefined); return remember(path); }
export async function clone(url, destination) { if (!/^((https:\/\/|git@)[\w.-]+[/:])[\w./-]+(?:\.git)?$/.test(url))
    throw new Error("Enter a valid Git HTTPS or SSH URL."); if (await exists(destination))
    throw new Error("The destination folder already exists."); await git(resolve(destination, ".."), ["clone", url, destination]); return remember(destination); }
export async function remove(id) { await save((await registry()).filter(p => p.id !== id)); }
export async function deleteLocal(id, confirmation) { const item = (await registry()).find(p => p.id === id); if (!item)
    throw new Error("Project is not registered."); if (confirmation !== item.name)
    throw new Error("Type the exact project name to delete its local clone."); const root = resolve(item.path); if (root === resolve(root, "..") || root.length < 4 || !await exists(join(root, ".git")))
    throw new Error("Refusing to delete an unsafe or non-Git project path."); await rm(root, { recursive: true, force: false, maxRetries: 2 }); await remove(id); }
export async function pages(root) { return loadPages(root); }
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
    const branch = `learning-site-migration-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
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
export async function saveSettings(root, settings) { const p = paths(root); const site = settings.site; if (!site || typeof site !== "object")
    throw new Error("Invalid site settings."); await writeFile(p.site, JSON.stringify(site, null, 2)); }
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
export async function deleteImage(root, path) { await rm(safe(paths(root).media, join(paths(root).media, path))); const items = await media(root); await writeFile(paths(root).mediaIndex, JSON.stringify(items.filter(i => i.path !== path), null, 2)); }
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
export { buildProject, validateProject, savePage };
