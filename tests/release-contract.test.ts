import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const source = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");
describe("production release contract", () => {
  it("packages an installer, updater, and bundled official themes", async () => {
    const pkg = JSON.parse(await source("package.json"));
    expect(pkg.main).toContain("dist-electron");
    expect(pkg.build.win.target).toContain("nsis");
    expect(pkg.build.publish[0].provider).toBe("github");
    expect(pkg.build.extraResources[0].to).toBe("themes");
    expect(pkg.dependencies["electron-updater"]).toBeTruthy();
    expect(pkg.build.win.artifactName).toContain("Learning-Site-Editor-Setup");
  });
  it("release workflow validates, tests, packages, checksums, and publishes", async () => {
    const workflow = await source(".github/workflows/release.yml");
    for (const required of [
      "npm run lint",
      "npm test",
      "npm run package",
      "Get-FileHash",
      "softprops/action-gh-release",
      "release/latest.yml",
      "release/*.blockmap",
    ]) {
      expect(workflow).toContain(required);
    }
  });
  it("keeps file and process capabilities out of the renderer", async () => {
    const preload = await source("electron/preload.cts");
    const main = await source("electron/main.ts");
    expect(preload).not.toMatch(/node:fs|child_process|shell\.openExternal/);
    expect(main).toMatch(/contextIsolation\s*:\s*true/);
    expect(main).toMatch(/nodeIntegration\s*:\s*false/);
    expect(main).toContain("preload.cjs");
    expect(main).toContain("git:projectStatus");
    expect(main).toContain("git:updateProject");
  });
  it("uses a checkpointed migration flow", async () => {
    const services = await source("electron/services.ts");
    for (const required of [
      "Recovery commit before Learning Site migration",
      "checkout",
      "Migration validation failed",
      "Migrate project to Learning Site Engine",
    ]) {
      expect(services).toContain(required);
    }
  });
});
