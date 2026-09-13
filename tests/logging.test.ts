import { describe, expect, it } from "vitest";
import { redact } from "../electron/logging.ts";
describe("diagnostic redaction",()=>{it("removes credentials and token values",()=>{const output=redact("https://alice:password@example.test/repo token=abc123 password=hunter2 ghp_abcdefghijklmnopqrstuvwxyz123456");expect(output).not.toContain("alice");expect(output).not.toContain("hunter2");expect(output).not.toContain("abcdefghijklmnopqrstuvwxyz");expect(output).toContain("***");});});
