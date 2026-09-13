import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { app } from "electron";
export const redact = (value) => value
    .replace(/https?:\/\/[^\s@]+@/g, "https://***@")
    .replace(/(?:token|password|secret|authorization)\s*[=:]\s*[^\s,;]+/gi, "$1=***")
    .replace(/[A-Za-z0-9_-]{30,}/g, "***");
export async function logError(scope, error) {
    const message = redact(error instanceof Error ? error.message : String(error));
    const directory = join(app.getPath("logs"), "learning-site-editor");
    await mkdir(directory, { recursive: true });
    await appendFile(join(directory, "editor.log"), `${new Date().toISOString()} ${scope}: ${message}\n`, "utf8");
}
