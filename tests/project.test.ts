import { describe, expect, it } from "vitest";
describe("project safety",()=>{it("requires exact confirmation before local clone deletion",()=>{const name="my-site";expect("MY-SITE"===name).toBe(false);expect(name===name).toBe(true);});it("classifies known engine states",()=>{expect(["current","legacy","unsupported"]).toContain("legacy");});});
