import { mkdir, readFile, writeFile, rename, cp, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
export async function json(path) { return JSON.parse(await readFile(path, "utf8")); }
export async function writeJson(path, value) { await mkdir(dirname(path), { recursive: true }); const temp = `${path}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8"); await rename(temp, path); }
export async function text(path) { return readFile(path, "utf8"); }
export async function writeText(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value, "utf8"); }
export async function exists(path) { try {
    await stat(path);
    return true;
}
catch {
    return false;
} }
export async function copyTree(source, destination) { await cp(source, destination, { recursive: true, force: true, errorOnExist: false }); }
export async function files(root) { const entries = await readdir(root, { withFileTypes: true }); const nested = await Promise.all(entries.map(async (e) => e.isDirectory() ? (await files(join(root, e.name))).map(x => join(e.name, x)) : [e.name])); return nested.flat(); }
