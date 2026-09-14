import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const source = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

describe("renderer-to-main IPC contract", () => {
  it("registers a main-process handler for every renderer IPC capability", async () => {
    const preload = await source("electron/preload.cts");
    const main = await source("electron/main.ts");
    const channels = [...preload.matchAll(/call\("([\w:]+)"\)/g)].map(
      (match) => match[1],
    );

    expect(channels.length).toBeGreaterThan(30);
    for (const channel of new Set(channels))
      expect(main).toContain(`handle("${channel}"`);
  });

  it("does not give the renderer unrestricted IPC access", async () => {
    const preload = await source("electron/preload.cts");
    expect(preload).not.toContain("ipcRenderer.send");
    expect(preload).not.toContain("ipcRenderer.on");
  });
});
