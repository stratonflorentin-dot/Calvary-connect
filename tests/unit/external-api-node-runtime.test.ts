import { describe, expect, it } from "vitest";
import { resolveApiAnythingNodeExecutable } from "@/lib/external-apis";

describe("API Anything Node executable", () => {
  it("uses an explicit executable override when configured", () => {
    expect(resolveApiAnythingNodeExecutable("/runtime/node", " /opt/node/bin/node ")).toBe("/opt/node/bin/node");
  });

  it("uses the current runtime executable when it exists", () => {
    expect(resolveApiAnythingNodeExecutable(process.execPath, undefined)).toBe(process.execPath);
  });

  it("falls back to PATH when the runtime executable is missing", () => {
    expect(resolveApiAnythingNodeExecutable("/var/lang/bin/node", undefined)).toBe("node");
  });
});
