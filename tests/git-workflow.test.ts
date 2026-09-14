import { describe, expect, it } from "vitest";
import {
  inspectProject,
  stableTags,
  type GitRun,
} from "../electron/git-workflow.js";

describe("Git update workflow", () => {
  it("keeps only stable semver tags in newest-first order", () => {
    expect(
      stableTags(
        "a\trefs/tags/v1.0.0\nb\trefs/tags/v2.1.0\nc\trefs/tags/v2.1.0-beta\nd\trefs/tags/v1.0.0^{}\n",
      ),
    ).toEqual(["v2.1.0", "v1.0.0"]);
  });
  it("does not fetch the official upstream when project updates are disabled", async () => {
    const calls: string[][] = [];
    const run: GitRun = async (args) => {
      calls.push(args);
      if (args.join(" ") === "symbolic-ref --quiet --short HEAD") return "main";
      if (args.join(" ") === "remote get-url origin")
        return "https://github.com/example/site.git";
      if (args.join(" ") === "remote get-url upstream")
        return "https://github.com/galtauba/LearningSite.git";
      if (args.join(" ") === "status --porcelain") return "";
      if (args.join(" ") === "rev-list --left-right --count main...origin/main")
        return "0 0";
      return "";
    };
    const status = await inspectProject(run, false);
    expect(status.state).toBe("READY");
    expect(
      calls.some((args) => args[0] === "fetch" && args[1] === "upstream"),
    ).toBe(false);
  });
  it("recognizes a new empty origin without checking an upstream", async () => {
    const calls: string[][] = [];
    const run: GitRun = async (args) => {
      calls.push(args);
      if (args.join(" ") === "remote get-url origin")
        return "https://github.com/example/new-site.git";
      if (args.join(" ") === "symbolic-ref --quiet --short HEAD")
        throw new Error("no commits");
      throw new Error("not configured");
    };
    const status = await inspectProject(run, true);
    expect(status.state).toBe("UNINITIALIZED");
    expect(status.origin).toContain("new-site");
    expect(calls.some((args) => args[0] === "fetch")).toBe(false);
  });
});
