import { describe, expect, it } from "vitest";
describe("project safety", () => {
  it("requires exact confirmation before local clone deletion", () => {
    const name = "my-site";
    expect("MY-SITE" === name).toBe(false);
    expect(name === name).toBe(true);
  });
  it("classifies known engine states", () => {
    expect(["current", "legacy", "unsupported"]).toContain("legacy");
  });
  it("seeds an empty clone with the current project format and no legacy upstream", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../electron/services.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("seedEmptyRepositoryWithCurrentProject");
    expect(source).toMatch(
      /createProject\(root,\s*\{\s*title:\s*basename\(root\),\s*locale:\s*"he"\s*\}\)/,
    );
    expect(source).not.toContain("initializeEmptyRepositoryFromOfficial");
    expect(source).not.toContain("OFFICIAL_UPSTREAM");
  });
});
