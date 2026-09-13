import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
describe("Electron boundary",()=>{it("uses an isolated renderer and a preload bridge",async()=>{const source=await readFile(new URL("../electron/main.ts",import.meta.url),"utf8");expect(source).toContain("contextIsolation:true");expect(source).toContain("nodeIntegration:false");const preload=await readFile(new URL("../electron/preload.ts",import.meta.url),"utf8");expect(preload).toContain("contextBridge.exposeInMainWorld");});});
